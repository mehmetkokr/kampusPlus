// Kayıt ve giriş işlemleri
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { sendMail } = require('../lib/mailer');
const { syncUserClassmateGroup } = require('../lib/classmateGroups');
const { runDocumentOcr } = require('../lib/ocr');

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
router.post('/register', registerLimiter, upload.private.single('studentDoc'), verifyFileSignature, async (req, res) => {
  try {
    const { email, password, fullName, universityId, department, classYear, intent } = req.body;

    if (!email || !password || !fullName || !universityId) {
      return res.status(400).json({ error: 'E-posta, şifre, isim ve üniversite zorunludur.' });
    }

    const ALLOWED_INTENTS = ['friendship', 'dating', 'study', 'event', 'club'];
    const selectedIntents = (intent || 'friendship')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ALLOWED_INTENTS.includes(s));
    const intentValue = selectedIntents.length > 0 ? selectedIntents.join(',') : 'friendship';

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Bu e-posta ile zaten bir hesap var.' });
    }

    const university = await prisma.university.findUnique({
      where: { id: Number(universityId) },
    });
    if (!university) {
      return res.status(400).json({ error: 'Geçersiz üniversite seçimi.' });
    }

    // Otomatik doğrulama: e-posta, üniversitenin resmi domaini ile bitiyorsa
    // otomatik doğrulanmış say. Aksi halde, belge yüklenmişse manuel inceleme
    // bekliyor say; belge de yoksa beklemede kalsın.
    let verificationStatus = 'pending';
    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (university.emailDomain && emailDomain === university.emailDomain.toLowerCase()) {
      verificationStatus = 'auto_verified';
    } else if (req.file) {
      verificationStatus = 'manual_review';
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const studentDocUrl = req.file ? `/api/files/${req.file.filename}` : null;

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        universityId: Number(universityId),
        department: department || null,
        classYear: classYear ? Number(classYear) : null,
        intent: intentValue,
        verificationStatus,
        studentDocUrl,
      },
    });

    const token = jwt.sign({ userId: user.id, tokenVersion: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Bölüm/sınıf bilgisi kayıt sırasında girildiyse ders arkadaşı grubuna
    // otomatik ekle. İsteği bekletmemesi için hatası yutulur (kritik değil,
    // profil güncellendiğinde de tekrar denenir).
    syncUserClassmateGroup(user.id).catch((err) => console.error('Ders arkadaşı grubu senkronize edilemedi:', err));

    // Grup D: OCR doğrulama - manuel incelemeye düşen bir belge yüklendiyse,
    // isteği bekletmeden arka planda OCR çalıştır ve sonucu kullanıcıya işle.
    // Bu SADECE admin'in manuel incelemesini hızlandıran bir ipucudur, hesabı
    // otomatik doğrulamaz (bkz. lib/ocr.js üstündeki güvenlik notu).
    if (req.file && verificationStatus === 'manual_review') {
      runDocumentOcr(req.file.path, req.file.mimetype, university.name)
        .then(({ extractedText, autoCheckPassed }) => {
          if (extractedText === null && autoCheckPassed === null) return; // OCR atlandı (ör. PDF)
          return prisma.user.update({
            where: { id: user.id },
            data: { ocrExtractedText: extractedText, ocrAutoCheckPassed: autoCheckPassed, ocrProcessedAt: new Date() },
          });
        })
        .catch((err) => console.error('OCR ön kontrolü işlenemedi:', err));
    }

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

    const user = await prisma.user.findUnique({ where: { email } });
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

    const user = await prisma.user.findUnique({ where: { email } });
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
