// Kayıt ve giriş işlemleri
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { sendMail, isRealSmtpConfigured } = require('../lib/mailer');
const crypto = require('crypto');
const fsp = require('fs/promises');
const { toTitleCaseTR, normalizeEmail } = require('../lib/text');
const { parseBirthDate } = require('../lib/age');
const { ALLOWED_INTENTS } = require('../lib/intents');

// ---------------------------------------------------------
// Kayıt e-posta doğrulama kodu
// 6 haneli kod e-postaya gönderilir; 10 dakika geçerlidir, en fazla 5 yanlış
// deneme hakkı vardır, 60 saniyede bir yeniden istenebilir. Veritabanında
// kodun kendisi değil SHA-256 özeti saklanır.
// ---------------------------------------------------------
const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 60 * 1000;
const CODE_MAX_ATTEMPTS = 5;
const PASSWORD_MIN = 8;

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const sendCodeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla kod istendi. Lütfen daha sonra tekrar deneyin.' },
});

// Doğrulama başarısızsa, isteğe iliştirilmiş belge diskte kalmasın
async function discardUpload(req) {
  if (req.file?.path) await fsp.unlink(req.file.path).catch(() => {});
}

// E-postayı büyük/küçük harfe duyarsız bul. Yeni kayıtlar küçük harfle saklanır;
// bu değişiklikten önce karışık harfle kaydolmuş hesaplar için ham hâli de denenir.
async function findUserByEmail(rawEmail) {
  const normalized = normalizeEmail(rawEmail);
  return (
    (await prisma.user.findUnique({ where: { email: normalized } })) ||
    (rawEmail.trim() !== normalized ? await prisma.user.findUnique({ where: { email: rawEmail.trim() } }) : null)
  );
}

// Kayıt yalnızca seçilen üniversitenin okul e-postasıyla yapılabilir.
// Alt alan adları da okulun adresidir (ör. ogr.mku.edu.tr → mku.edu.tr).
function isSchoolEmail(email, university) {
  const uniDomain = university?.emailDomain?.toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return !!(uniDomain && emailDomain && (emailDomain === uniDomain || emailDomain.endsWith('.' + uniDomain)));
}

const schoolEmailError = (university) =>
  `Doğrulama kodu yalnızca okul e-postana gönderilir. ${university.name} için @${university.emailDomain} ile biten adresini gir.`;

const router = express.Router();

// Giriş denemesi kaba kuvvet (brute-force) saldırılarına karşı sınırlanır.
// 15 dakikada aynı IP'den en fazla 10 deneme.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' },
});

// Kayıt işlemi de aynı şekilde sınırlanır (otomatik hesap oluşturma spam'ini engellemek için).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' },
});

// Şifremi unuttum: hem e-posta sızdırma saldırılarına hem de mail spam'ine
// karşı IP başına sıkı bir sınır.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' },
});

// ----------------------------
// KAYIT OL
// ----------------------------
// Kullanıcı e-posta, şifre, isim, üniversite seçer.
// Öğrenci belgesi de aynı anda yüklenebilir (opsiyonel - domain otomatik
// doğrulanırsa belgeye gerek kalmayabilir).
// POST /api/auth/register/send-code — kayıttan önce e-postaya doğrulama kodu gönder
router.post('/register/send-code', sendCodeLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
    }
    const university = req.body.universityId
      ? await prisma.university.findUnique({ where: { id: Number(req.body.universityId) } })
      : null;
    if (!university) {
      return res.status(400).json({ error: 'Önce üniversiteni seç.' });
    }
    if (!isSchoolEmail(email, university)) {
      return res.status(400).json({ error: schoolEmailError(university), field: 'email' });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
    }

    const existing = await prisma.emailVerificationCode.findUnique({ where: { email } });
    if (existing) {
      const wait = CODE_RESEND_MS - (Date.now() - new Date(existing.lastSentAt).getTime());
      if (wait > 0) {
        return res.status(429).json({ error: `Yeni kod için ${Math.ceil(wait / 1000)} saniye bekle.`, retryAfter: Math.ceil(wait / 1000) });
      }
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    await prisma.emailVerificationCode.upsert({
      where: { email },
      update: { codeHash: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, lastSentAt: now },
      create: { email, codeHash: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), lastSentAt: now },
    });

    await sendMail({
      to: email,
      subject: `kampüs+ doğrulama kodun: ${code}`,
      text: `Merhaba,\n\nkampüs+ kaydını tamamlamak için doğrulama kodun: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      html: `<p>Merhaba,</p><p>kampüs+ kaydını tamamlamak için doğrulama kodun:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    });

    res.json({
      sent: true,
      expiresInSec: CODE_TTL_MS / 1000,
      resendInSec: CODE_RESEND_MS / 1000,
      // Geliştirme ortamında SMTP yoksa kod sunucu konsoluna yazılır (koda kendisi yanıtta dönmez)
      devConsole: !isRealSmtpConfigured(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Doğrulama kodu gönderilemedi.' });
  }
});

router.post('/register', registerLimiter, upload.private.single('studentDoc'), verifyFileSignature, async (req, res) => {
  try {
    const { password, passwordConfirm, universityId, classYear, intent, birthDate, code } = req.body;
    const email = normalizeEmail(req.body.email);
    const fullName = toTitleCaseTR(req.body.fullName);
    const department = req.body.department ? toTitleCaseTR(req.body.department) : null;

    if (!email || !password || !fullName || !universityId) {
      await discardUpload(req);
      return res.status(400).json({ error: 'E-posta, şifre, isim ve üniversite zorunludur.' });
    }
    if (password.length < PASSWORD_MIN) {
      await discardUpload(req);
      return res.status(400).json({ error: `Şifre en az ${PASSWORD_MIN} karakter olmalı.` });
    }
    if (passwordConfirm !== undefined && passwordConfirm !== password) {
      await discardUpload(req);
      return res.status(400).json({ error: 'Şifreler birbiriyle eşleşmiyor.' });
    }

    // E-posta doğrulama kodu
    const record = await prisma.emailVerificationCode.findUnique({ where: { email } });
    if (!record || new Date(record.expiresAt) < new Date()) {
      await discardUpload(req);
      return res.status(400).json({ error: 'Doğrulama kodunun süresi doldu. Yeni kod iste.', codeError: 'expired' });
    }
    if (record.attempts >= CODE_MAX_ATTEMPTS) {
      await discardUpload(req);
      return res.status(429).json({ error: 'Çok fazla hatalı deneme yapıldı. Yeni kod iste.', codeError: 'locked' });
    }
    if (!code || hashCode(String(code).trim()) !== record.codeHash) {
      const updated = await prisma.emailVerificationCode.update({ where: { email }, data: { attempts: { increment: 1 } } });
      await discardUpload(req);
      const left = CODE_MAX_ATTEMPTS - updated.attempts;
      return res.status(400).json({
        error: left > 0 ? `Kod hatalı. ${left} deneme hakkın kaldı.` : 'Kod hatalı. Deneme hakkın bitti, yeni kod iste.',
        codeError: left > 0 ? 'invalid' : 'locked',
      });
    }

    // Bölüm ve sınıf kayıttan sonra değiştirilemediği için kayıtta zorunludur
    if (!department || !classYear) {
      return res.status(400).json({ error: 'Bölüm ve sınıf bilgisi zorunludur.' });
    }

    const birth = parseBirthDate(birthDate);
    if (birth.error) {
      return res.status(400).json({ error: birth.error });
    }

    const selectedIntents = (intent || 'friendship')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ALLOWED_INTENTS.includes(s));
    const intentValue = selectedIntents.length > 0 ? selectedIntents.join(',') : 'friendship';

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
    }

    const university = await prisma.university.findUnique({
      where: { id: Number(universityId) },
    });
    if (!university) {
      return res.status(400).json({ error: 'Geçersiz üniversite seçimi.' });
    }
    // Kod okul adresine gittiği ve orada doğrulandığı için hesap kendiliğinden
    // doğrulanmış sayılır; okul dışı adreslerle kayıt kabul edilmez.
    if (!isSchoolEmail(email, university)) {
      await discardUpload(req);
      return res.status(400).json({ error: schoolEmailError(university) });
    }
    const verificationStatus = 'auto_verified';
    // Öğrenci belgesi (onaylı rozet) kayıttan sonra profilden yüklenir
    await discardUpload(req);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        universityId: Number(universityId),
        department,
        classYear: classYear ? Number(classYear) : null,
        birthDate: birth.date,
        age: birth.age,
        intent: intentValue,
        verificationStatus,
      },
    });

    await prisma.emailVerificationCode.delete({ where: { email } }).catch(() => {});

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        verificationStatus: user.verificationStatus,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kayıt sırasında bir hata oluştu.' });
  }
});

// ----------------------------
// GİRİŞ YAP
// ----------------------------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Hesabın askıya alındı. Detaylar için destek ekibiyle iletişime geç.' });
    }

    let reactivated = false;
    if (user.isFrozen) {
      await prisma.user.update({ where: { id: user.id }, data: { isFrozen: false } });
      reactivated = true;
    }

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      reactivated,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        verificationStatus: user.verificationStatus,
        isAdmin: user.isAdmin,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Giriş sırasında bir hata oluştu.' });
  }
});

// ----------------------------
// ŞİFREMİ UNUTTUM
// ----------------------------
// Hesabın var olup olmadığını sızdırmadan her zaman aynı mesajı döneriz.
// Hesap gerçekten varsa, 30 dakika geçerli imzalı bir sıfırlama token'ı
// üretilip kullanıcının e-postasına gönderilir (SMTP tanımlı değilse
// geliştirme kolaylığı için sunucu konsoluna yazdırılır - bkz. lib/mailer.js).
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-posta zorunludur.' });
    }

    const user = await findUserByEmail(email);
    if (user) {
      // tokenVersion token'a gömülür: kullanıcı şifresini sıfırladığında bu
      // sayaç 1 artar ve daha önce gönderilmiş (kullanılmamış) eski token'lar
      // otomatik olarak geçersiz kalır.
      const resetToken = jwt.sign(
        { userId: user.id, purpose: 'password_reset', tokenVersion: user.tokenVersion },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const resetLink = `${clientUrl}/reset-password?token=${resetToken}`;

      await sendMail({
        to: user.email,
        subject: 'kampüs+ Şifre Sıfırlama',
        text: `Şifreni sıfırlamak için bu bağlantıyı kullan (30 dakika geçerlidir): ${resetLink}`,
        html: `<p>Merhaba ${user.fullName},</p><p>Şifreni sıfırlamak için aşağıdaki bağlantıya tıkla. Bu bağlantı 30 dakika geçerlidir.</p><p><a href="${resetLink}">${resetLink}</a></p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
      });
    }

    // Güvenlik amacıyla hesabın var olup olmadığını belli etmeden aynı mesajı döneriz.
    res.json({ message: 'Eğer bu e-posta ile bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İstek işlenirken bir hata oluştu.' });
  }
});

// ----------------------------
// ŞİFRE SIFIRLAMA (linke tıklandıktan sonra)
// ----------------------------
router.post('/reset-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token ve yeni şifre zorunludur.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Şifre en az 8 karakter olmalıdır.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Bağlantının süresi dolmuş veya geçersiz. Yeniden şifre sıfırlama isteği gönder.' });
    }

    if (payload.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Geçersiz token.' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(400).json({ error: 'Kullanıcı bulunamadı.' });
    }

    // tokenVersion uyuşmuyorsa bu token daha önce kullanılmış (veya yeni bir
    // sıfırlama isteği bu token'ı geçersiz kılmış) demektir.
    if (payload.tokenVersion !== user.tokenVersion) {
      return res.status(400).json({ error: 'Bu bağlantı artık geçerli değil. Yeniden şifre sıfırlama isteği gönder.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 }, // bu token'ı ve varsa diğer eski token'ları geçersiz kıl
      },
    });

    res.json({ message: 'Şifren başarıyla güncellendi. Şimdi giriş yapabilirsin.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şifre sıfırlanırken bir hata oluştu.' });
  }
});

module.exports = router;
