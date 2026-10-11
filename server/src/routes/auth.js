// Kayıt ve giriş işlemleri
const express = require('express');
const { track } = require('../lib/analytics');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { escapeHtml } = require('../lib/html');
const { signFileToken } = require('../lib/fileToken');
const { disconnectUser } = require('../socket');
const { requireAuth } = require('../middleware/auth');
const { reverifyInfo } = require('../lib/reverify');
const { checkTotp } = require('../lib/twoFactor');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { sendMail, isRealSmtpConfigured } = require('../lib/mailer');
const crypto = require('crypto');
const fsp = require('fs/promises');
const { toTitleCaseTR, normalizeEmail } = require('../lib/text');
const { parseBirthDate } = require('../lib/age');
const { ALLOWED_INTENTS } = require('../lib/intents');
const { isSchoolEmail } = require('../lib/schoolEmail');

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

// Hesap yokken karşılaştırılacak sabit özet (giriş yanıt süresini eşitlemek için)
const DUMMY_HASH = bcrypt.hashSync('kampus-olmayan-hesap', 10);

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
const schoolEmailError = (university) =>
  `Doğrulama kodu yalnızca okul e-postana gönderilir. ${university.name} için @${university.emailDomain} ile biten adresini gir.`;

const router = express.Router();

// Giriş denemesi kaba kuvvet (brute-force) saldırılarına karşı sınırlanır.
// 15 dakikada aynı IP'den en fazla 10 deneme (LOGIN_RATE_LIMIT ile değişir;
// uçtan uca testler aynı adresten çok sayıda giriş yaptığı için yükseltir).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT) || 10,
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
      // "Bu e-posta kayıtlı" demek, kimin üye olduğunu herkese söylemek olurdu.
      // Yanıt kod gönderilmiş gibidir; gerçek sahibine giriş yapmasını söyleyen
      // bir e-posta gider.
      const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
      sendMail({
        to: email,
        subject: 'kampüs·: Bu e-postayla zaten bir hesabın var',
        text: `Merhaba,\n\nBu adresle yeni hesap açılmak istendi ama zaten bir kampüs· hesabın var. Giriş yapmak için: ${loginUrl}\nŞifreni hatırlamıyorsan giriş ekranındaki "Şifremi Unuttum" bağlantısını kullan.\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        html: `<p>Merhaba,</p><p>Bu adresle yeni hesap açılmak istendi ama zaten bir kampüs· hesabın var.</p><p><a href="${escapeHtml(loginUrl)}">Giriş yap</a> · Şifreni hatırlamıyorsan giriş ekranındaki “Şifremi Unuttum” bağlantısını kullan.</p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
      }).catch((err) => console.error('Hesap bilgilendirme e-postası gönderilemedi:', err));
      return res.json({ sent: true, expiresInSec: CODE_TTL_MS / 1000, resendInSec: CODE_RESEND_MS / 1000, devConsole: !isRealSmtpConfigured() });
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

    // Beklenmeden gönderilir: kayıtlı/kayıtsız adres için yanıt süresi aynı olsun
    sendMail({
      to: email,
      subject: `kampüs· doğrulama kodun: ${code}`,
      text: `Merhaba,\n\nkampüs· kaydını tamamlamak için doğrulama kodun: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      html: `<p>Merhaba,</p><p>kampüs· kaydını tamamlamak için doğrulama kodun:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    }).catch((err) => console.error('Doğrulama kodu e-postası gönderilemedi:', err));

    track('code_sent', { anonId: req.headers['x-anon-id'] });

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

    // Kayıt formu kısa tutulur: doğum tarihi, bölüm, sınıf ve "ne arıyorsun"
    // e-posta doğrulandıktan sonraki başlangıç adımında (/profile/me/basics)
    // alınır. Eski istemciler bunları burada göndermeye devam edebilir.
    const birth = birthDate ? parseBirthDate(birthDate) : { date: null, age: null };
    if (birth.error) {
      return res.status(400).json({ error: birth.error });
    }
    const classYearValue = [1, 2, 3, 4, 5].includes(Number(classYear)) ? Number(classYear) : null;

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
        classYear: classYearValue,
        birthDate: birth.date,
        age: birth.age,
        intent: intentValue,
        verificationStatus,
        schoolEmailVerifiedAt: new Date(),
      },
    });

    await prisma.emailVerificationCode.delete({ where: { email } }).catch(() => {});

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    track('signup', { userId: user.id, anonId: req.headers['x-anon-id'] });

    res.status(201).json({
      token,
      fileToken: signFileToken(user),
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
    // Hesap yoksa da aynı sürede yanıt verilir: yanıt süresinden hangi
    // e-postaların kayıtlı olduğu anlaşılamasın
    const passwordOk = await bcrypt.compare(String(password), user ? user.passwordHash : DUMMY_HASH);
    if (!user) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    if (!passwordOk) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Hesabın askıya alındı. Detaylar için destek ekibiyle iletişime geç.' });
    }

    // Yönetici iki adımlı doğrulamayı açtıysa şifreden sonra uygulamadaki kod da istenir
    if (user.isAdmin && user.totpEnabled) {
      if (!req.body.totpCode) return res.json({ twoFactorRequired: true });
      if (!(await checkTotp(user, req.body.totpCode))) {
        return res.status(401).json({ error: 'Doğrulama kodu hatalı.', twoFactorRequired: true });
      }
    }

    let reactivated = false;
    if (user.isFrozen) {
      await prisma.user.update({ where: { id: user.id }, data: { isFrozen: false } });
      reactivated = true;
    }

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      fileToken: signFileToken(user),
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

      sendMail({
        to: user.email,
        subject: 'kampüs·: Şifre sıfırlama',
        text: `Şifreni sıfırlamak için bu bağlantıyı kullan (30 dakika geçerlidir): ${resetLink}`,
        html: `<p>Merhaba ${escapeHtml(user.fullName)},</p><p>Şifreni sıfırlamak için aşağıdaki bağlantıya tıkla. Bu bağlantı 30 dakika geçerlidir.</p><p><a href="${resetLink}">${resetLink}</a></p><p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
      }).catch((err) => console.error('Şifre sıfırlama e-postası gönderilemedi:', err));
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
    disconnectUser(user.id, 'password_changed');

    res.json({ message: 'Şifren başarıyla güncellendi. Şimdi giriş yapabilirsin.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şifre sıfırlanırken bir hata oluştu.' });
  }
});

// ----------------------------
// YILLIK ÖĞRENCİLİK DOĞRULAMASI (lib/reverify.js)
// ----------------------------
// Kod, hesabın kayıtlı okul e-postasına gönderilir. Okul adresi artık
// çalışmıyorsa (mezuniyet) kod ulaşmaz; hesap ek sürenin sonunda listelerden
// gizlenir.
router.post('/reverify/send-code', requireAuth, sendCodeLimiter, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    const email = user.email;
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
      subject: `kampüs· öğrencilik doğrulama kodun: ${code}`,
      text: `Merhaba,

kampüs· hesabının öğrenciliğini yenilemek için kodun: ${code}

Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      html: `<p>Merhaba,</p><p>kampüs· hesabının öğrenciliğini yenilemek için kodun:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir.</p>`,
    });
    // E-posta adresinin bir kısmı gösterilir: kodun nereye gittiği anlaşılsın
    const [local, domain] = email.split('@');
    res.json({ sent: true, to: `${local.slice(0, 2)}***@${domain}`, expiresInSec: CODE_TTL_MS / 1000, devConsole: !isRealSmtpConfigured() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Doğrulama kodu gönderilemedi.' });
  }
});

router.post('/reverify', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    const email = user.email;
    const record = await prisma.emailVerificationCode.findUnique({ where: { email } });
    if (!record || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Kodun süresi doldu. Yeni kod iste.', codeError: 'expired' });
    }
    if (record.attempts >= CODE_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Çok fazla hatalı deneme yapıldı. Yeni kod iste.', codeError: 'locked' });
    }
    const code = String(req.body?.code || '').trim();
    if (!code || hashCode(code) !== record.codeHash) {
      const updated = await prisma.emailVerificationCode.update({ where: { email }, data: { attempts: { increment: 1 } } });
      const left = CODE_MAX_ATTEMPTS - updated.attempts;
      return res.status(400).json({ error: left > 0 ? `Kod hatalı. ${left} deneme hakkın kaldı.` : 'Kod hatalı. Deneme hakkın bitti, yeni kod iste.', codeError: left > 0 ? 'invalid' : 'locked' });
    }
    await prisma.emailVerificationCode.delete({ where: { email } }).catch(() => {});
    const now = new Date();
    await prisma.user.update({ where: { id: req.userId }, data: { schoolEmailVerifiedAt: now } });
    res.json({ message: 'Öğrenciliğin doğrulandı. Bir yıl boyunca tekrar sormayacağız.', reverify: reverifyInfo({ schoolEmailVerifiedAt: now }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Doğrulama tamamlanamadı.' });
  }
});

// ----------------------------
// E-POSTA DEĞİŞTİRME (ör. lisanstan yüksek lisansa geçince okul adresi değişir)
// ----------------------------
// Yeni adres aynı üniversitenin okul e-postası olmalı; yeni adrese gelen kodla
// doğrulanır. Eski adrese bilgi e-postası gider. Doğrulama yıllık süreyi de
// yeniler (yeni adres yeni bir öğrencilik kanıtıdır).
router.post('/email/send-code', requireAuth, sendCodeLimiter, async (req, res) => {
  try {
    const newEmail = normalizeEmail(req.body?.newEmail || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.', field: 'newEmail' });
    const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { university: true } });
    if (!(await bcrypt.compare(String(req.body?.password || ''), user.passwordHash))) {
      return res.status(400).json({ error: 'Şifren hatalı.', field: 'password' });
    }
    if (newEmail === user.email) return res.status(400).json({ error: 'Bu zaten kayıtlı adresin.', field: 'newEmail' });
    if (!isSchoolEmail(newEmail, user.university)) {
      return res.status(400).json({ error: schoolEmailError(user.university), field: 'newEmail' });
    }
    if (await findUserByEmail(newEmail)) return res.status(409).json({ error: 'Bu e-posta başka bir hesapta kayıtlı.', field: 'newEmail' });

    const existing = await prisma.emailVerificationCode.findUnique({ where: { email: newEmail } });
    if (existing) {
      const wait = CODE_RESEND_MS - (Date.now() - new Date(existing.lastSentAt).getTime());
      if (wait > 0) return res.status(429).json({ error: `Yeni kod için ${Math.ceil(wait / 1000)} saniye bekle.`, retryAfter: Math.ceil(wait / 1000) });
    }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    await prisma.emailVerificationCode.upsert({
      where: { email: newEmail },
      update: { codeHash: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), attempts: 0, lastSentAt: now },
      create: { email: newEmail, codeHash: hashCode(code), expiresAt: new Date(now.getTime() + CODE_TTL_MS), lastSentAt: now },
    });
    await sendMail({
      to: newEmail,
      subject: `kampüs· e-posta değişikliği kodun: ${code}`,
      text: `Merhaba,

kampüs· hesabının e-posta adresini bu adresle değiştirmek için kodun: ${code}

Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
      html: `<p>Merhaba,</p><p>kampüs· hesabının e-posta adresini bu adresle değiştirmek için kodun:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Kod 10 dakika geçerlidir.</p>`,
    });
    res.json({ sent: true, expiresInSec: CODE_TTL_MS / 1000, devConsole: !isRealSmtpConfigured() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Doğrulama kodu gönderilemedi.' });
  }
});

router.post('/email', requireAuth, async (req, res) => {
  try {
    const newEmail = normalizeEmail(req.body?.newEmail || '');
    const record = await prisma.emailVerificationCode.findUnique({ where: { email: newEmail } });
    if (!record || new Date(record.expiresAt) < new Date()) return res.status(400).json({ error: 'Kodun süresi doldu. Yeni kod iste.', codeError: 'expired' });
    if (record.attempts >= CODE_MAX_ATTEMPTS) return res.status(429).json({ error: 'Çok fazla hatalı deneme yapıldı. Yeni kod iste.', codeError: 'locked' });
    const code = String(req.body?.code || '').trim();
    if (!code || hashCode(code) !== record.codeHash) {
      const updated = await prisma.emailVerificationCode.update({ where: { email: newEmail }, data: { attempts: { increment: 1 } } });
      const left = CODE_MAX_ATTEMPTS - updated.attempts;
      return res.status(400).json({ error: left > 0 ? `Kod hatalı. ${left} deneme hakkın kaldı.` : 'Kod hatalı. Deneme hakkın bitti, yeni kod iste.', codeError: left > 0 ? 'invalid' : 'locked' });
    }
    // Kod gönderildikten sonra başka bir hesap bu adresi almış olabilir
    if (await findUserByEmail(newEmail)) return res.status(409).json({ error: 'Bu e-posta başka bir hesapta kayıtlı.' });

    const before = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, fullName: true } });
    await prisma.user.update({ where: { id: req.userId }, data: { email: newEmail, schoolEmailVerifiedAt: new Date() } });
    await prisma.emailVerificationCode.delete({ where: { email: newEmail } }).catch(() => {});
    // Eski adrese bilgi: hesap ele geçirildiyse sahibi fark etsin
    sendMail({
      to: before.email,
      subject: 'kampüs· e-posta adresin değiştirildi',
      text: `Merhaba ${before.fullName},

kampüs· hesabının e-posta adresi ${newEmail} olarak değiştirildi. Bunu sen yapmadıysan hemen bize yaz.`,
      html: `<p>Merhaba ${escapeHtml(before.fullName)},</p><p>kampüs· hesabının e-posta adresi <b>${escapeHtml(newEmail)}</b> olarak değiştirildi. Bunu sen yapmadıysan hemen bize yaz.</p>`,
    }).catch(() => {});
    res.json({ message: 'E-posta adresin değiştirildi. Bundan sonra bu adresle giriş yapacaksın.', email: newEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'E-posta değiştirilemedi.' });
  }
});

// ----------------------------
// ŞİFRE DEĞİŞTİRME (giriş yapmışken, Ayarlar'dan)
// ----------------------------
// Mevcut şifre doğrulanır; diğer cihazlardaki oturumlar kapanır, bu cihaz yeni
// oturum anahtarı alır ve açık kalır.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar dene.' },
});

router.put('/password', requireAuth, changePasswordLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Mevcut ve yeni şifreni yaz.' });
    }
    if (newPassword.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `Yeni şifre en az ${PASSWORD_MIN} karakter olmalı.`, field: 'newPassword' });
    }
    if (newPassword.length > 200) return res.status(400).json({ error: 'Şifre çok uzun.', field: 'newPassword' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ error: 'Mevcut şifren hatalı.', field: 'currentPassword' });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Yeni şifre eskisiyle aynı olamaz.', field: 'newPassword' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), tokenVersion: { increment: 1 } },
      select: { id: true, tokenVersion: true },
    });
    const exceptSocketId = typeof req.headers['x-socket-id'] === 'string' ? req.headers['x-socket-id'] : undefined;
    disconnectUser(user.id, 'password_changed', { exceptSocketId });

    const token = jwt.sign({ userId: updated.id, tokenVersion: updated.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Şifren değiştirildi. Diğer cihazlardaki oturumların kapatıldı.', token, fileToken: signFileToken(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şifre değiştirilemedi.' });
  }
});

module.exports = router;
