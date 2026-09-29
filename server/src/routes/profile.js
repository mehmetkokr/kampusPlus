// Profil görüntüleme ve güncelleme
const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { isPremiumActive } = require('../lib/premium');
const { syncUserClassmateGroup } = require('../lib/classmateGroups');
const { runDocumentOcr } = require('../lib/ocr');

const router = express.Router();

// Kendi profilini getir
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        age: true,
        department: true,
        classYear: true,
        bio: true,
        photoUrl: true,
        interests: true,
        hobbies: true,
        instagramUrl: true,
        twitterUrl: true,
        linkedinUrl: true,
        intent: true,
        verificationStatus: true,
        rejectionReason: true,
        isAdmin: true,
        notifyMatches: true,
        notifyMessages: true,
        profileVisibility: true,
        showActivityStatus: true,
        theme: true,
        language: true,
        university: { select: { id: true, name: true } },
        isPremium: true,
        premiumUntil: true,
        birthDate: true,
        currentStreak: true,
        longestStreak: true,
        weeklySummaryEnabled: true,
        // Grup C: profil boost + öncelikli doğrulama durumu
        boostedUntil: true,
        verificationPriority: true,
      },
    });
    // isPremium alanını, süresi dolmuş olsa bile ham haliyle değil,
    // gerçek (anlık) durumuyla döndür.
    res.json({ ...user, isPremium: isPremiumActive(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profil alınamadı.' });
  }
});

const PROFILE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  age: true,
  department: true,
  classYear: true,
  bio: true,
  photoUrl: true,
  interests: true,
  hobbies: true,
  instagramUrl: true,
  twitterUrl: true,
  linkedinUrl: true,
  intent: true,
  verificationStatus: true,
  rejectionReason: true,
  isAdmin: true,
  notifyMatches: true,
  notifyMessages: true,
  notifyPostActivity: true,
  profileVisibility: true,
  showActivityStatus: true,
  theme: true,
  language: true,
  university: { select: { id: true, name: true } },
  birthDate: true,
  currentStreak: true,
  longestStreak: true,
  weeklySummaryEnabled: true,
  boostedUntil: true,
  verificationPriority: true,
};

// Profili güncelle (bio, ilgi alanları, hobiler, sosyal medya, amaç, bölüm, sınıf, yaş)
router.put('/me', requireAuth, async (req, res) => {
  try {
    const {
      bio,
      interests,
      hobbies,
      intent,
      department,
      classYear,
      age,
      instagramUrl,
      twitterUrl,
      linkedinUrl,
      birthDate,
    } = req.body;

    const ALLOWED_INTENTS = ['friendship', 'dating', 'study', 'event', 'club'];
    let intentValue;
    if (intent !== undefined) {
      const selected = (intent || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ALLOWED_INTENTS.includes(s));
      intentValue = selected.length > 0 ? selected.join(',') : 'friendship';
    }

    let ageValue;
    if (age !== undefined) {
      const parsed = age === '' || age === null ? null : Number(age);
      if (parsed !== null && (Number.isNaN(parsed) || parsed < 16 || parsed > 100)) {
        return res.status(400).json({ error: 'Geçerli bir yaş giriniz (16-100).' });
      }
      ageValue = parsed;
    }

    // Doğum günü bildirimi için doğum tarihi (isteğe bağlı). Tarih değiştiğinde
    // "bu yıl zaten bildirim gitti" bayrağı da sıfırlanır - aksi halde kullanıcı
    // yanlış girdiği tarihi düzeltse bile o yıl için bir daha bildirim alamaz.
    let birthDateValue;
    let resetBirthdayFlag = false;
    if (birthDate !== undefined) {
      if (birthDate === '' || birthDate === null) {
        birthDateValue = null;
      } else {
        const parsedDate = new Date(birthDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Geçerli bir doğum tarihi giriniz.' });
        }
        birthDateValue = parsedDate;
      }
      resetBirthdayFlag = true;
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        bio,
        interests,
        hobbies,
        intent: intentValue,
        department,
        classYear: classYear ? Number(classYear) : undefined,
        age: ageValue,
        instagramUrl: instagramUrl || null,
        twitterUrl: twitterUrl || null,
        linkedinUrl: linkedinUrl || null,
        birthDate: birthDateValue,
        lastBirthdayNotifiedYear: resetBirthdayFlag ? null : undefined,
      },
      select: PROFILE_SELECT,
    });

    res.json({ message: 'Profil güncellendi.', user: updated });

    // Bölüm veya sınıf değişmiş olabilir - ders arkadaşı grubunu buna göre
    // yeniden senkronize et. Yanıt gönderildikten sonra çalışır, isteği bekletmez.
    if (department !== undefined || classYear !== undefined) {
      syncUserClassmateGroup(req.userId).catch((err) => console.error('Ders arkadaşı grubu senkronize edilemedi:', err));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profil güncellenemedi.' });
  }
});

// Bildirim tercihlerini güncelle (Ayarlar sayfası)
router.put('/me/notifications', requireAuth, async (req, res) => {
  try {
    const { notifyMatches, notifyMessages, notifyPostActivity, weeklySummaryEnabled } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        notifyMatches: typeof notifyMatches === 'boolean' ? notifyMatches : undefined,
        notifyMessages: typeof notifyMessages === 'boolean' ? notifyMessages : undefined,
        notifyPostActivity: typeof notifyPostActivity === 'boolean' ? notifyPostActivity : undefined,
        weeklySummaryEnabled: typeof weeklySummaryEnabled === 'boolean' ? weeklySummaryEnabled : undefined,
      },
      select: PROFILE_SELECT,
    });
    res.json({ message: 'Bildirim tercihleri güncellendi.', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tercihler güncellenemedi.' });
  }
});

// Gizlilik tercihlerini güncelle (profil görünürlüğü, çevrimiçi durumu)
router.put('/me/privacy', requireAuth, async (req, res) => {
  try {
    const { profileVisibility, showActivityStatus } = req.body;
    const ALLOWED_VISIBILITY = ['everyone', 'university', 'nobody'];

    if (profileVisibility !== undefined && !ALLOWED_VISIBILITY.includes(profileVisibility)) {
      return res.status(400).json({ error: 'Geçersiz gizlilik seçeneği.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        profileVisibility: profileVisibility ?? undefined,
        showActivityStatus: typeof showActivityStatus === 'boolean' ? showActivityStatus : undefined,
      },
      select: PROFILE_SELECT,
    });
    res.json({ message: 'Gizlilik tercihleri güncellendi.', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tercihler güncellenemedi.' });
  }
});

// Tema ve dil tercihini güncelle
router.put('/me/appearance', requireAuth, async (req, res) => {
  try {
    const { theme, language } = req.body;
    const ALLOWED_THEMES = ['dark', 'light'];
    const ALLOWED_LANGUAGES = ['tr', 'en'];

    if (theme !== undefined && !ALLOWED_THEMES.includes(theme)) {
      return res.status(400).json({ error: 'Geçersiz tema seçeneği.' });
    }
    if (language !== undefined && !ALLOWED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Geçersiz dil seçeneği.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        theme: theme ?? undefined,
        language: language ?? undefined,
      },
      select: PROFILE_SELECT,
    });
    res.json({ message: 'Görünüm tercihleri güncellendi.', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tercihler güncellenemedi.' });
  }
});

// Hesabı dondur — profil keşfet/akış gibi alanlarda gizlenir, tekrar giriş
// yapıldığında otomatik olarak yeniden aktifleşir.
router.post('/me/freeze', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { isFrozen: true } });
    res.json({ message: 'Hesabın donduruldu. Tekrar giriş yaptığında otomatik olarak aktifleşecek.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hesap dondurulamadı.' });
  }
});

// Hesabı kalıcı olarak sil
// Kulüp/grup/etkinlik gibi topluluk kaynaklarının sahibiyse (Restrict ilişki),
// önce o kaynaklar devredilmeli ya da silinmeli - aksi halde diğer üyelerin
// verisi sessizce sahipsiz kalır. Bu yüzden burada kontrol edip anlamlı bir
// hata mesajıyla durduruyoruz.
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Hesabını silmek için şifreni girmelisin.' });
    }

    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    const passwordOk = await bcrypt.compare(password, me.passwordHash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Şifre hatalı.' });
    }

    const [ownedClubs, ownedGroups, ownedEvents] = await Promise.all([
      prisma.club.count({ where: { creatorId: req.userId } }),
      prisma.groupChat.count({ where: { creatorId: req.userId } }),
      prisma.event.count({ where: { creatorId: req.userId } }),
    ]);

    if (ownedClubs > 0 || ownedGroups > 0 || ownedEvents > 0) {
      return res.status(409).json({
        error:
          'Hesabını silmeden önce sahibi olduğun kulüp, grup sohbeti veya etkinlikleri başka birine devretmeli ya da silmelisin.',
      });
    }

    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Hesabın kalıcı olarak silindi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hesap silinemedi.' });
  }
});

// Profil fotoğrafı yükle
router.post('/me/photo', requireAuth, upload.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Fotoğraf dosyası gerekli.' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    await prisma.user.update({
      where: { id: req.userId },
      data: { photoUrl },
    });

    res.json({ message: 'Fotoğraf yüklendi.', photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf yüklenemedi.' });
  }
});

// Aynı üniversitedeki, henüz beğenilmemiş/eşleşmemiş kullanıcıları listele
// (Kart kaydırma ekranı için kullanılır)
router.get('/discover', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });

    if (me.verificationStatus !== 'auto_verified' && me.verificationStatus !== 'verified') {
      return res.status(403).json({ error: 'Hesabınız henüz doğrulanmadı.' });
    }

    const alreadyLiked = await prisma.like.findMany({
      where: { fromUserId: req.userId },
      select: { toUserId: true },
    });
    const excludeIds = [req.userId, ...alreadyLiked.map((l) => l.toUserId)];

    const myIntents = (me.intent || 'friendship').split(',').map((s) => s.trim()).filter(Boolean);

    const candidates = await prisma.user.findMany({
      where: {
        universityId: me.universityId,
        id: { notIn: excludeIds },
        verificationStatus: { in: ['auto_verified', 'verified'] },
        isFrozen: false,
      },
      select: {
        id: true,
        fullName: true,
        age: true,
        department: true,
        classYear: true,
        bio: true,
        photoUrl: true,
        interests: true,
        hobbies: true,
        intent: true,
        university: { select: { name: true } },
      },
      take: 60,
    });

    // En az bir ortak "ne arıyorsun" etiketi olan adayları öne çıkar
    const withOverlap = candidates.filter((c) => {
      const theirIntents = (c.intent || 'friendship').split(',').map((s) => s.trim());
      return theirIntents.some((t) => myIntents.includes(t));
    });

    res.json(withOverlap.slice(0, 20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcılar listelenemedi.' });
  }
});

// Tüm cihazlardan çıkış yap: tokenVersion'ı artırarak o ana kadar verilmiş
// tüm JWT'leri (bu cihaz dahil) geçersiz kılar. Kullanıcı ayarlar sayfasından
// tetikler; şifre çalınmış/paylaşılmış olabileceğini düşündüğünde kullanışlıdır.
router.post('/logout-all', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    res.json({ success: true, message: 'Tüm cihazlardan çıkış yapıldı.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız oldu.' });
  }
});

// Öğrenci belgesini yeniden yükle - reddedilen ya da hâlâ "pending" olan
// (yüklemediği için hiç incelemeye girmemiş) hesaplar için. Onay/Red Kuyruğu
// (Grup: OCR doğrulama) akışının tamamlayıcısı: admin reddederse öğrencinin
// tekrar deneyebileceği tek yol burasıdır.
router.post(
  '/verification-document',
  requireAuth,
  upload.private.single('studentDoc'),
  verifyFileSignature,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Belge dosyası bulunamadı.' });
      }

      const me = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { verificationStatus: true, university: { select: { name: true } } },
      });
      if (!['pending', 'rejected'].includes(me.verificationStatus)) {
        return res.status(400).json({ error: 'Hesabın zaten doğrulanmış ya da inceleme sürecinde.' });
      }

      const docUrl = `/api/files/${req.file.filename}`;
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          studentDocUrl: docUrl,
          verificationStatus: 'manual_review',
          rejectionReason: null,
          ocrExtractedText: null,
          ocrAutoCheckPassed: null,
          ocrProcessedAt: null,
        },
      });

      runDocumentOcr(req.file.path, req.file.mimetype, me.university?.name)
        .then(({ extractedText, autoCheckPassed }) => {
          if (extractedText === null && autoCheckPassed === null) return;
          return prisma.user.update({
            where: { id: req.userId },
            data: { ocrExtractedText: extractedText, ocrAutoCheckPassed: autoCheckPassed, ocrProcessedAt: new Date() },
          });
        })
        .catch((err) => console.error('OCR ön kontrolü işlenemedi:', err));

      res.json({ message: 'Belge yüklendi, incelemeye alındı.', verificationStatus: 'manual_review' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Belge yüklenemedi.' });
    }
  }
);

module.exports = router;
