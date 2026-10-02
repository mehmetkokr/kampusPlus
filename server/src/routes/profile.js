// Profil görüntüleme ve güncelleme
const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { isPremiumActive } = require('../lib/premium');
const { runDocumentOcr } = require('../lib/ocr');
const fsp = require('fs/promises');
const path = require('path');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('../lib/paths');
const { parseBirthDate, withLiveAge } = require('../lib/age');
const { discoverableUserWhere } = require('../lib/privacy');
const { ALLOWED_INTENTS, wantsDating, visibleIntentFor } = require('../lib/intents');

const MAX_PHOTOS = 6;

// Galeriden silinen fotoğrafı diskten de kaldır (bağlantıyı bilen erişemesin)
async function removeUploadedFile(url) {
  if (!url) return;
  // /uploads/... herkese açık klasör; /api/files/... kimlik belgesi gibi özel dosyalar
  const dir = url.startsWith('/uploads/') ? PUBLIC_UPLOADS : url.startsWith('/api/files/') ? PRIVATE_UPLOADS : null;
  if (!dir) return;
  await fsp.unlink(path.join(dir, path.basename(url))).catch(() => {});
}

// İlgi alanı / hobi listesi: virgülle ayrılmış, en fazla 10 benzersiz öğe,
// her biri en fazla 40 karakter. undefined gelirse alan değiştirilmez.
const MAX_TAGS = 10;
function cleanTags(value) {
  if (value === undefined) return undefined;
  const seen = new Set();
  const tags = String(value || '')
    .split(',')
    .map((s) => s.trim().slice(0, 40))
    .filter((s) => s && !seen.has(s.toLocaleLowerCase('tr')) && seen.add(s.toLocaleLowerCase('tr')));
  return tags.slice(0, MAX_TAGS).join(', ') || null;
}

// Galerinin ilk fotoğrafını ana profil fotoğrafı (photoUrl) olarak eşitle
async function syncMainPhoto(userId) {
  const first = await prisma.userPhoto.findFirst({ where: { userId }, orderBy: { position: 'asc' } });
  await prisma.user.update({ where: { id: userId }, data: { photoUrl: first ? first.url : null } });
  return first ? first.url : null;
}

async function listPhotos(userId) {
  return prisma.userPhoto.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    select: { id: true, url: true, position: true },
  });
}

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
        intent: true,
        verificationStatus: true,
        studentDocStatus: true,
        rejectionReason: true,
        isAdmin: true,
        photos: { orderBy: { position: 'asc' }, select: { id: true, url: true, position: true } },
        notifyMatches: true,
        notifyMessages: true,
        profileVisibility: true,
        showActivityStatus: true,
  swipeEnabled: true,
        swipeEnabled: true,
        theme: true,
        language: true,
        university: { select: { id: true, name: true } },
        isPremium: true,
        premiumUntil: true,
        birthDate: true,
        weeklySummaryEnabled: true,
      },
    });
    // isPremium alanını, süresi dolmuş olsa bile ham haliyle değil,
    // gerçek (anlık) durumuyla döndür.
    res.json(withLiveAge({ ...user, isPremium: isPremiumActive(user) }));
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
  intent: true,
  photos: { orderBy: { position: 'asc' }, select: { id: true, url: true, position: true } },
  verificationStatus: true,
  studentDocStatus: true,
  rejectionReason: true,
  isAdmin: true,
  notifyMatches: true,
  notifyMessages: true,
  notifyPostActivity: true,
  profileVisibility: true,
  showActivityStatus: true,
  swipeEnabled: true,
  theme: true,
  language: true,
  university: { select: { id: true, name: true } },
  birthDate: true,
  weeklySummaryEnabled: true,
};

// Profili güncelle (bio, ilgi alanları, hobiler, sosyal medya, amaç).
// Üniversite, bölüm ve sınıf kayıt sırasında belirlenir ve buradan değiştirilemez;
// yaş doğum tarihinden hesaplanır. Doğum tarihi yalnızca hiç girilmemişse bir kez eklenebilir.
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { bio, interests, hobbies, intent, instagramUrl, twitterUrl, birthDate } = req.body;

    let intentValue;
    if (intent !== undefined) {
      const selected = (intent || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ALLOWED_INTENTS.includes(s));
      intentValue = selected.length > 0 ? selected.join(',') : 'friendship';
    }

    // Doğum tarihi: kayıtta alınır; bu değişiklikten önce kaydolmuş ve hiç
    // girmemiş kullanıcılar bir kez ekleyebilir, sonradan değiştirilemez.
    let birthDateValue;
    let ageValue;
    if (birthDate) {
      const current = await prisma.user.findUnique({ where: { id: req.userId }, select: { birthDate: true } });
      if (current.birthDate) {
        return res.status(400).json({ error: 'Doğum tarihi bir kez girildikten sonra değiştirilemez.' });
      }
      const birth = parseBirthDate(birthDate);
      if (birth.error) return res.status(400).json({ error: birth.error });
      birthDateValue = birth.date;
      ageValue = birth.age;
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        bio,
        interests: cleanTags(interests),
        hobbies: cleanTags(hobbies),
        intent: intentValue,
        age: ageValue,
        // Gönderilmeyen alan değişmez (kısmi güncelleme, ör. başlangıç adımları)
        instagramUrl: instagramUrl === undefined ? undefined : instagramUrl || null,
        twitterUrl: twitterUrl === undefined ? undefined : twitterUrl || null,
        birthDate: birthDateValue,
      },
      select: PROFILE_SELECT,
    });

    res.json({ message: 'Profil güncellendi.', user: withLiveAge(updated) });
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
    const { profileVisibility, showActivityStatus, swipeEnabled } = req.body;
    const ALLOWED_VISIBILITY = ['everyone', 'university', 'nobody'];

    if (profileVisibility !== undefined && !ALLOWED_VISIBILITY.includes(profileVisibility)) {
      return res.status(400).json({ error: 'Geçersiz gizlilik seçeneği.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        profileVisibility: profileVisibility ?? undefined,
        showActivityStatus: typeof showActivityStatus === 'boolean' ? showActivityStatus : undefined,
        swipeEnabled: typeof swipeEnabled === 'boolean' ? swipeEnabled : undefined,
      },
      select: PROFILE_SELECT,
    });

    // Çevrimiçi durumu gizlendiyse, açık sohbet ekranlarında da hemen gizlensin
    if (showActivityStatus === false) {
      req.app.get('io')?.emit('presence_update', { userId: req.userId, online: false, lastSeenAt: null });
    }

    res.json({ message: 'Gizlilik tercihleri güncellendi.', user: withLiveAge(updated) });
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

    const [ownedClubs, ownedEvents] = await Promise.all([
      prisma.club.count({ where: { creatorId: req.userId } }),
      prisma.event.count({ where: { creatorId: req.userId } }),
    ]);

    if (ownedClubs > 0 || ownedEvents > 0) {
      return res.status(409).json({
        error: 'Hesabını silmeden önce sahibi olduğun kulüp veya etkinlikleri başka birine devretmeli ya da silmelisin.',
      });
    }

    // Silinen hesabın fotoğraf dosyaları diskte kalmasın (profil, galeri,
    // gönderi ve hikaye fotoğrafları): kayıtlar cascade ile silinir ama dosyalar değil.
    // Eşleşmeler silinince içindeki tüm sohbet mesajları da silinir; bu yüzden
    // iki tarafın da gönderdiği sohbet ekleri (fotoğraf, ses, dosya) temizlenir.
    // Kulüp sohbetinde yalnızca bu hesabın kendi mesajları silinir.
    const attachment = { OR: [{ photoUrl: { not: null } }, { audioUrl: { not: null } }, { fileUrl: { not: null } }] };
    const attachmentFields = { photoUrl: true, audioUrl: true, fileUrl: true };
    const [photos, posts, stories, chatFiles, clubChatFiles] = await Promise.all([
      prisma.userPhoto.findMany({ where: { userId: req.userId }, select: { url: true } }),
      prisma.post.findMany({ where: { authorId: req.userId, imageUrl: { not: null } }, select: { imageUrl: true } }),
      prisma.story.findMany({ where: { authorId: req.userId }, select: { imageUrl: true } }),
      prisma.message.findMany({
        where: { ...attachment, match: { OR: [{ userAId: req.userId }, { userBId: req.userId }] } },
        select: attachmentFields,
      }),
      prisma.clubMessage.findMany({ where: { ...attachment, senderId: req.userId }, select: attachmentFields }),
    ]);
    const fileUrls = new Set([
      me.photoUrl,
      me.studentDocUrl,
      ...photos.map((p) => p.url),
      ...posts.map((p) => p.imageUrl),
      ...stories.map((s) => s.imageUrl),
      ...[...chatFiles, ...clubChatFiles].flatMap((m) => [m.photoUrl, m.audioUrl, m.fileUrl]),
    ]);

    await prisma.user.delete({ where: { id: req.userId } });
    await Promise.all([...fileUrls].map((url) => removeUploadedFile(url)));
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
    const count = await prisma.userPhoto.count({ where: { userId: req.userId } });
    if (count >= MAX_PHOTOS) {
      await removeUploadedFile(photoUrl);
      return res.status(400).json({ error: `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin. Önce birini sil.` });
    }

    // Yeni ana fotoğraf galerinin en başına geçer
    await prisma.$transaction([
      prisma.userPhoto.updateMany({ where: { userId: req.userId }, data: { position: { increment: 1 } } }),
      prisma.userPhoto.create({ data: { userId: req.userId, url: photoUrl, position: 0 } }),
    ]);
    await syncMainPhoto(req.userId);

    res.json({ message: 'Fotoğraf yüklendi.', photoUrl, photos: await listPhotos(req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf yüklenemedi.' });
  }
});

// POST /api/profile/me/photos — galeriye fotoğraf ekle (sona)
router.post('/me/photos', requireAuth, upload.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fotoğraf dosyası gerekli.' });
    const url = `/uploads/${req.file.filename}`;
    const existing = await listPhotos(req.userId);
    if (existing.length >= MAX_PHOTOS) {
      await removeUploadedFile(url);
      return res.status(400).json({ error: `En fazla ${MAX_PHOTOS} fotoğraf ekleyebilirsin. Önce birini sil.` });
    }
    const nextPosition = existing.length ? existing[existing.length - 1].position + 1 : 0;
    await prisma.userPhoto.create({ data: { userId: req.userId, url, position: nextPosition } });
    const photoUrl = await syncMainPhoto(req.userId);
    res.status(201).json({ photos: await listPhotos(req.userId), photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf eklenemedi.' });
  }
});

// PUT /api/profile/me/photos/:id/main — seçilen fotoğrafı ana fotoğraf yap
router.put('/me/photos/:id/main', requireAuth, async (req, res) => {
  try {
    const photo = await prisma.userPhoto.findUnique({ where: { id: Number(req.params.id) } });
    if (!photo || photo.userId !== req.userId) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
    const ordered = await listPhotos(req.userId);
    const reordered = [photo, ...ordered.filter((p) => p.id !== photo.id)];
    await prisma.$transaction(
      reordered.map((p, i) => prisma.userPhoto.update({ where: { id: p.id }, data: { position: i } }))
    );
    const photoUrl = await syncMainPhoto(req.userId);
    res.json({ photos: await listPhotos(req.userId), photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ana fotoğraf değiştirilemedi.' });
  }
});

// DELETE /api/profile/me/photos/:id — galeriden fotoğraf sil
router.delete('/me/photos/:id', requireAuth, async (req, res) => {
  try {
    const photo = await prisma.userPhoto.findUnique({ where: { id: Number(req.params.id) } });
    if (!photo || photo.userId !== req.userId) return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
    await prisma.userPhoto.delete({ where: { id: photo.id } });
    await removeUploadedFile(photo.url);
    const photoUrl = await syncMainPhoto(req.userId);
    res.json({ photos: await listPhotos(req.userId), photoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf silinemedi.' });
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
    if (!me.swipeEnabled) {
      return res.status(403).json({ error: "Kart Modu kapalı. Ayarlar'dan açabilirsin.", swipeDisabled: true });
    }

    const [alreadyLiked, blockedByMe, blockingMe] = await Promise.all([
      prisma.like.findMany({ where: { fromUserId: req.userId }, select: { toUserId: true } }),
      prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } }),
    ]);
    const excludeIds = [
      req.userId,
      ...alreadyLiked.map((l) => l.toUserId),
      ...blockedByMe.map((b) => b.blockedId),
      ...blockingMe.map((b) => b.blockerId),
    ];

    const myIntents = (me.intent || 'friendship').split(',').map((s) => s.trim()).filter(Boolean);

    const candidates = await prisma.user.findMany({
      where: {
        ...discoverableUserWhere(me.universityId),
        universityId: me.universityId,
        id: { notIn: excludeIds },
        verificationStatus: { in: ['auto_verified', 'verified'] },
        swipeEnabled: true, // Kart Modu'nu kapatanlar destede görünmez
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
        birthDate: true,
        studentDocStatus: true,
        university: { select: { name: true } },
        photos: { orderBy: { position: 'asc' }, select: { id: true, url: true, position: true } },
      },
      take: 60,
    });

    // En az bir ortak "ne arıyorsun" etiketi olan adayları öne çıkar; ortak
    // etiketi olmayanlar da listenin sonunda yer alır (eskiden tamamen
    // eleniyordu ve kart modu çoğu kullanıcı için boş kalıyordu).
    const overlapCount = (c) => {
      const theirIntents = (c.intent || 'friendship').split(',').map((s) => s.trim());
      return theirIntents.filter((t) => myIntents.includes(t)).length;
    };
    // Flört modu: yalnızca flört arayan biri, flört modunda olmayan kişinin
    // destesinde çıkmaz (tercihi zaten ona görünmeyecekti).
    const iWantDating = wantsDating(me.intent);
    const visibleCandidates = candidates.filter((c) => iWantDating || visibleIntentFor(c.intent, me.intent) !== null);
    const sorted = visibleCandidates
      .map((c) => ({ c, score: overlapCount(c) }))
      .sort((a, b) => b.score - a.score)
      .map(({ c }) => c);

    res.json(
      sorted.slice(0, 20).map((c) => {
        const { birthDate: _b, studentDocStatus, ...rest } = withLiveAge(c);
        return { ...rest, intent: visibleIntentFor(c.intent, me.intent), isStudentVerified: studentDocStatus === 'approved' };
      })
    );
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
      // Onaylı öğrenci rozeti yalnızca e-Devlet barkodlu öğrenci belgesiyle (PDF) verilir
      if (req.file.mimetype !== 'application/pdf') {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Yalnızca e-Devlet öğrenci belgesi (PDF) yükleyebilirsin.' });
      }

      const me = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { verificationStatus: true, studentDocStatus: true, university: { select: { name: true } } },
      });
      // Reddedilen yüklemede dosya diskte kalmasın
      if (me.studentDocStatus === 'approved' || me.studentDocStatus === 'pending') {
        await fsp.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: me.studentDocStatus === 'approved'
            ? 'Öğrenci belgen zaten onaylanmış.'
            : 'Belgen zaten inceleniyor. Sonucu sana bildireceğiz.',
        });
      }

      // E-postası okul alan adıyla doğrulanmış hesap erişimini korur; yalnızca
      // rozet başvurusu incelemeye girer. Erişimi olmayan hesap ise incelemeye alınır.
      const hasAccess = ['auto_verified', 'verified'].includes(me.verificationStatus);
      const docUrl = `/api/files/${req.file.filename}`;
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          studentDocUrl: docUrl,
          studentDocStatus: 'pending',
          verificationStatus: hasAccess ? undefined : 'manual_review',
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

      res.json({
        message: 'Belge yüklendi, incelemeye alındı.',
        verificationStatus: hasAccess ? me.verificationStatus : 'manual_review',
        studentDocStatus: 'pending',
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Belge yüklenemedi.' });
    }
  }
);

module.exports = router;
