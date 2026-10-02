// Admin Paneli API'leri
// Tüm route'lar requireAdmin ile korunur (isAdmin=true olmayan hiç giremez).
const express = require('express');
const prisma = require('../lib/prisma');
const { createNotification } = require('../lib/notifications');
const { requireAdmin } = require('../middleware/adminAuth');
const { sendMail } = require('../lib/mailer');
const { getOnlineUserIds } = require('../socket');

const router = express.Router();
router.use(requireAdmin);

// ============================================================
// DASHBOARD
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalDirectMessages, totalClubMessages, totalUniversities, pendingReports, pendingVerifications] =
      await Promise.all([
        prisma.user.count(),
        prisma.post.count(),
        prisma.message.count(),
        prisma.clubMessage.count(),
        prisma.university.count(),
        prisma.report.count({ where: { status: 'pending' } }),
        prisma.user.count({ where: { OR: [{ verificationStatus: 'manual_review' }, { studentDocStatus: 'pending' }] } }),
      ]);

    res.json({
      totalUsers,
      totalPosts,
      // "Toplam mesaj" - eşleşme ve kulüp sohbetlerindeki tüm mesajların toplamı
      totalMessages: totalDirectMessages + totalClubMessages,
      totalUniversities,
      pendingReports,
      pendingVerifications,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İstatistikler alınamadı.' });
  }
});

// Basit büyüme grafiği için: son 14 gündeki günlük yeni kullanıcı sayısı
router.get('/stats/signups', async (req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });

    const counts = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      counts[key] = 0;
    }
    users.forEach((u) => {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (counts[key] !== undefined) counts[key]++;
    });

    res.json(Object.entries(counts).map(([date, count]) => ({ date, count })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Grafik verisi alınamadı.' });
  }
});

// DAU/MAU + Premium dönüşüm oranı.
// "Aktif" iki şekilde sayılır: şu an socket ile bağlı (anlık online) ya da
// son X gün içinde lastSeenAt güncellenmiş (socket.js -> disconnect anında
// yazılıyor, bkz. o dosyadaki not). İkisinin birleşimi kullanılır ki uzun
// süredir bağlı kalıp hiç disconnect olmamış kullanıcılar da sayılsın.
router.get('/stats/engagement', async (req, res) => {
  try {
    const onlineIds = getOnlineUserIds();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dauFromLastSeen, mauFromLastSeen, totalUsers, everPremiumCount, activePremiumRows] = await Promise.all([
      prisma.user.findMany({ where: { lastSeenAt: { gte: startOfToday } }, select: { id: true } }),
      prisma.user.findMany({ where: { lastSeenAt: { gte: thirtyDaysAgo } }, select: { id: true } }),
      prisma.user.count(),
      // "Dönüşüm" = premiumSince dolu olan tüm kullanıcılar (bir kez bile satın almış olmak
      // - süresi dolmuş olsa bile "hiç dönüşen" oldu, ticari açıdan asıl istenen rakam budur).
      prisma.user.count({ where: { premiumSince: { not: null } } }),
      // Şu anki gerçekten aktif premium sayısı (isPremiumActive mantığıyla tutarlı).
      prisma.user.findMany({
        where: { isPremium: true },
        select: { premiumUntil: true },
      }),
    ]);

    const activePremiumCount = activePremiumRows.filter((u) => !u.premiumUntil || new Date(u.premiumUntil) > now).length;

    const dau = new Set([...dauFromLastSeen.map((u) => u.id), ...onlineIds]).size;
    const mau = new Set([...mauFromLastSeen.map((u) => u.id), ...onlineIds]).size;

    res.json({
      dau,
      mau,
      totalUsers,
      activePremiumCount,
      everPremiumCount,
      premiumConversionRate: totalUsers > 0 ? Number(((everPremiumCount / totalUsers) * 100).toFixed(1)) : 0,
      activePremiumRate: totalUsers > 0 ? Number(((activePremiumCount / totalUsers) * 100).toFixed(1)) : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkileşim istatistikleri alınamadı.' });
  }
});

// En aktif kampüsler: eşleşme sayısına (eşitlikte üye sayısına) göre.
// SQLite'ta ilişki üzerinden groupBy pratik olmadığından (Match.userA
// üzerinden university'e gruplama), eşleşmeler JS tarafında toplanıyor;
// veri boyutu (kampüs bazlı okul projesi) bunun için yeterince küçük.
router.get('/stats/campuses', async (req, res) => {
  try {
    const [universities, usersByUniversity, matches] = await Promise.all([
      prisma.university.findMany({ select: { id: true, name: true } }),
      prisma.user.groupBy({ by: ['universityId'], _count: { _all: true } }),
      prisma.match.findMany({ select: { userA: { select: { universityId: true } } } }),
    ]);

    const userCountMap = Object.fromEntries(usersByUniversity.map((r) => [r.universityId, r._count._all]));
    const matchCountMap = {};
    for (const m of matches) {
      const uid = m.userA.universityId;
      matchCountMap[uid] = (matchCountMap[uid] || 0) + 1;
    }

    const campuses = universities
      .map((u) => {
        const userCount = userCountMap[u.id] || 0;
        const matchCount = matchCountMap[u.id] || 0;
        return {
          id: u.id,
          name: u.name,
          userCount,
          matchCount,
          // Basit bir "etkinlik skoru" - eşleşme asıl ürün metriği, üye sayısı eşitliği bozar.
          activityScore: matchCount * 2 + userCount * 0.01,
        };
      })
      .sort((a, b) => b.activityScore - a.activityScore);

    res.json(campuses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kampüs istatistikleri alınamadı.' });
  }
});

// ============================================================
// KULLANICILAR
// ============================================================
router.get('/users', async (req, res) => {
  try {
    const { search = '', university = '', status = '', page = '1', pageSize = '20' } = req.query;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = {
      AND: [
        search
          ? {
              OR: [
                { fullName: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {},
        university ? { universityId: Number(university) } : {},
        // "manual_review" kuyruğu: erişim bekleyen hesaplar + rozet (belge) başvuruları
        status === 'manual_review'
          ? { OR: [{ verificationStatus: 'manual_review' }, { studentDocStatus: 'pending' }] }
          : status
            ? { verificationStatus: status }
            : {},
      ],
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          department: true,
          classYear: true,
          verificationStatus: true,
          studentDocStatus: true,
          ocrAutoCheckPassed: true,
          isAdmin: true,
          isBanned: true,
          createdAt: true,
          university: { select: { id: true, name: true } },
        },
        // Manuel inceleme kuyruğunda en eski talep en önce
        orderBy: status === 'manual_review' ? { createdAt: 'asc' } : { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: Number(page) || 1, pageSize: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        email: true,
        fullName: true,
        department: true,
        classYear: true,
        bio: true,
        photoUrl: true,
        interests: true,
        intent: true,
        verificationStatus: true,
        rejectionReason: true,
        studentDocUrl: true,
        // Grup D: OCR ön kontrolü - hesabı doğrulamaz, sadece admin'e ipucu verir.
        ocrExtractedText: true,
        ocrAutoCheckPassed: true,
        ocrProcessedAt: true,
        isAdmin: true,
        isBanned: true,
        createdAt: true,
        university: { select: { id: true, name: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcı alınamadı.' });
  }
});

// Doğrulama durumunu güncelle, admin/ban durumunu değiştir
router.patch('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { verificationStatus, isAdmin, isBanned, rejectionReason } = req.body;

    if (id === req.userId && (isAdmin === false || isBanned === true)) {
      return res.status(400).json({ error: 'Kendi admin yetkinizi kaldıramaz ya da kendinizi banlayamazsınız.' });
    }

    const ALLOWED_STATUSES = ['pending', 'auto_verified', 'manual_review', 'verified', 'rejected'];
    const data = {};
    if (verificationStatus !== undefined) {
      if (!ALLOWED_STATUSES.includes(verificationStatus)) {
        return res.status(400).json({ error: 'Geçersiz doğrulama durumu.' });
      }
      if (verificationStatus === 'rejected' && !rejectionReason?.trim()) {
        return res.status(400).json({ error: 'Reddetmek için kısa bir gerekçe yazmalısın (öğrenciye gösterilecek).' });
      }
      data.verificationStatus = verificationStatus;
      // Onay/Red kuyruğundan çıktığında öncelikli doğrulama işareti de temizlenir
      // (satın alma amacına ulaştı: kuyruktan bir insan tarafından çıkarıldı).
      if (verificationStatus === 'verified' || verificationStatus === 'rejected') {
      }
      data.rejectionReason = verificationStatus === 'rejected' ? rejectionReason.trim() : null;
    }
    if (isAdmin !== undefined) data.isAdmin = !!isAdmin;
    if (isBanned !== undefined) data.isBanned = !!isBanned;

    const previous = await prisma.user.findUnique({ where: { id }, select: { verificationStatus: true, studentDocStatus: true, email: true, fullName: true } });

    // Belge kararı rozet durumunu da belirler. E-postası okul alan adıyla
    // doğrulanmış bir hesabın rozet başvurusu reddedilirse hesap erişimi
    // korunur; yalnızca rozet "rejected" olur.
    if (verificationStatus === 'verified') {
      data.studentDocStatus = 'approved';
    } else if (verificationStatus === 'rejected') {
      data.studentDocStatus = 'rejected';
      if (previous?.verificationStatus === 'auto_verified') delete data.verificationStatus;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        verificationStatus: true,
        rejectionReason: true,
        isAdmin: true,
        isBanned: true,
      },
    });

    // Kullanıcı yasaklandıysa, hâlâ bağlı olan socket bağlantısını hemen
    // kapat — aksi halde token süresi dolana kadar (7 gün) mesajlaşmaya
    // devam edebilir. HTTP istekleri zaten requireAuth'taki isBanned
    // kontrolüyle bir sonraki istekte reddedilir.
    if (data.isBanned) {
      const io = req.app.get('io');
      io?.in(`user_${id}`).disconnectSockets(true);
    }

    // Belge kararı: uygulama içi bildirim (rozet durumu değiştiyse)
    const io = req.app.get('io');
    if (verificationStatus === 'verified' && previous?.studentDocStatus !== 'approved') {
      await createNotification(io, { userId: id, type: 'badge_approved', targetType: 'user', targetId: id });
    } else if (verificationStatus === 'rejected' && previous?.studentDocStatus !== 'rejected') {
      await createNotification(io, { userId: id, type: 'badge_rejected', targetType: 'user', targetId: id, message: updated.rejectionReason || null });
    }

    // Onay/Red kuyruğu: kararı öğrenciye e-posta ile bildir (SMTP yoksa
    // konsola yazılır - bkz. lib/mailer.js). İsteği bekletmemek için
    // beklenmiyor (fire-and-forget).
    if (verificationStatus === 'verified' && previous?.verificationStatus !== 'verified') {
      sendMail({
        to: updated.email,
        subject: 'kampüs+ — Öğrenci belgen onaylandı ✅',
        text: `Merhaba ${updated.fullName},\n\nÖğrenci belgen incelendi ve onaylandı. Artık hesabın tamamen doğrulanmış durumda, kampüs+'ı sınırsız kullanabilirsin.`,
      }).catch((err) => console.error('Onay e-postası gönderilemedi:', err));
    } else if (verificationStatus === 'rejected' && previous?.verificationStatus !== 'rejected') {
      sendMail({
        to: updated.email,
        subject: 'kampüs+ — Öğrenci belgenle ilgili bir sorun var',
        text: `Merhaba ${updated.fullName},\n\nYüklediğin öğrenci belgesi incelendi ve şu sebeple onaylanamadı: "${updated.rejectionReason}".\n\nProfilinden yeni bir belge yükleyerek tekrar deneyebilirsin.`,
      }).catch((err) => console.error('Red e-postası gönderilemedi:', err));
    }

    res.json({ message: 'Kullanıcı güncellendi.', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.userId) {
      return res.status(400).json({ error: 'Kendi hesabınızı buradan silemezsiniz.' });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Kullanıcı silindi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcı silinemedi. Bu kullanıcı bir kulüp/grup/etkinlik sahibi olabilir - önce sahipliği devretmeniz gerekebilir.' });
  }
});

// ============================================================
// ÜNİVERSİTELER
// ============================================================
router.get('/universities', async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, clubs: true } } },
    });
    res.json(universities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Üniversiteler alınamadı.' });
  }
});

router.post('/universities', async (req, res) => {
  try {
    const { name, emailDomain } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Üniversite adı zorunludur.' });
    }
    const university = await prisma.university.create({
      data: { name: name.trim(), emailDomain: emailDomain?.trim() || null },
    });
    res.status(201).json(university);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu isimde bir üniversite zaten var.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Üniversite eklenemedi.' });
  }
});

router.patch('/universities/:id', async (req, res) => {
  try {
    const { name, emailDomain } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (emailDomain !== undefined) data.emailDomain = emailDomain?.trim() || null;

    const university = await prisma.university.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(university);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Bu isimde bir üniversite zaten var.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Üniversite güncellenemedi.' });
  }
});

router.delete('/universities/:id', async (req, res) => {
  try {
    await prisma.university.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Üniversite silindi.' });
  } catch (err) {
    if (err.code === 'P2003' || err.code === 'P2014') {
      return res.status(409).json({ error: 'Bu üniversitede kayıtlı öğrenciler/kulüpler var, önce onları taşıyın ya da silin.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Üniversite silinemedi.' });
  }
});

// ============================================================
// BÖLÜMLER
// ============================================================
// Not: Bölüm şu an User üzerinde serbest metin alanı (ayrı bir tablo değil).
// Bu endpoint, üniversite bazında girilmiş bölümleri gruplayıp öğrenci
// sayılarıyla birlikte listeler - ilk sürüm için ayrı bir tablo gerektirmez.
router.get('/departments', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { department: { not: null } },
      select: { department: true, university: { select: { id: true, name: true } } },
    });

    const map = new Map(); // key: universityId|department -> { university, department, count }
    for (const u of users) {
      const dept = (u.department || '').trim();
      if (!dept) continue;
      const key = `${u.university.id}|${dept.toLowerCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          university: u.university,
          department: dept,
          studentCount: 0,
        });
      }
      map.get(key).studentCount++;
    }

    const result = Array.from(map.values()).sort((a, b) => b.studentCount - a.studentCount);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bölümler alınamadı.' });
  }
});

// ============================================================
// İLANLAR (akış gönderileri)
// ============================================================
router.get('/posts', async (req, res) => {
  try {
    const { search = '', page = '1', pageSize = '20' } = req.query;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = search
      ? {
          OR: [
            { caption: { contains: search } },
            { author: { fullName: { contains: search } } },
          ],
        }
      : {};

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          createdAt: true,
          author: { select: { id: true, fullName: true, email: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.post.count({ where }),
    ]);

    res.json({ posts, total, page: Number(page) || 1, pageSize: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İlanlar alınamadı.' });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'İlan silindi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İlan silinemedi.' });
  }
});

// ============================================================
// ŞİKAYETLER
// ============================================================
router.get('/reports', async (req, res) => {
  try {
    const { status = '', page = '1', pageSize = '20' } = req.query;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = status ? { status } : {};

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        include: { reporter: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.report.count({ where }),
    ]);

    // Hedef içeriği (varsa) her şikayet için ayrıca çözümle
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let target = null;
        try {
          if (r.targetType === 'user') {
            target = await prisma.user.findUnique({
              where: { id: r.targetId },
              select: { id: true, fullName: true, email: true, isBanned: true },
            });
          } else if (r.targetType === 'post') {
            target = await prisma.post.findUnique({
              where: { id: r.targetId },
              select: { id: true, caption: true, imageUrl: true, authorId: true },
            });
          } else if (r.targetType === 'message') {
            target = await prisma.message.findUnique({
              where: { id: r.targetId },
              select: { id: true, content: true, senderId: true },
            });
          } else if (r.targetType === 'story') {
            target = await prisma.story.findUnique({
              where: { id: r.targetId },
              select: { id: true, imageUrl: true, authorId: true, expiresAt: true },
            });
          } else if (r.targetType === 'club_message') {
            target = await prisma.clubMessage.findUnique({
              where: { id: r.targetId },
              select: { id: true, content: true, senderId: true },
            });
          }
        } catch {
          target = null;
        }
        return { ...r, target };
      })
    );

    res.json({ reports: enriched, total, page: Number(page) || 1, pageSize: take });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şikayetler alınamadı.' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const ALLOWED = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum.' });
    }

    const report = await prisma.report.update({
      where: { id: Number(req.params.id) },
      data: { status, reviewedAt: new Date() },
    });

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şikayet güncellenemedi.' });
  }
});

module.exports = router;
