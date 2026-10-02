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

// Pazarlama analitiği ve kampanyalar (ayrı dosyalarda, aynı yetki kontrolüyle)
router.use(require('./adminInsights'));
router.use(require('./adminCampaigns'));

const DAY = 24 * 60 * 60 * 1000;

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
// Liste ve CSV dışa aktarma aynı filtreleri kullanır
//   search, university, status (doğrulama), badge (none|pending|approved|rejected),
//   premium (yes|no), role (admin|banned|active), joined (gün), inactive (gün)
function userListWhere(q) {
  const now = new Date();
  const and = [];
  const search = (q.search || '').trim();
  if (search) and.push({ OR: [{ fullName: { contains: search } }, { email: { contains: search } }, { department: { contains: search } }] });
  if (q.university) and.push({ universityId: Number(q.university) });
  // "manual_review" kuyruğu: erişim bekleyen hesaplar + rozet (belge) başvuruları
  if (q.status === 'manual_review') and.push({ OR: [{ verificationStatus: 'manual_review' }, { studentDocStatus: 'pending' }] });
  else if (q.status) and.push({ verificationStatus: q.status });
  if (['none', 'pending', 'approved', 'rejected'].includes(q.badge)) and.push({ studentDocStatus: q.badge });
  if (q.premium === 'yes') and.push({ isPremium: true, OR: [{ premiumUntil: null }, { premiumUntil: { gt: now } }] });
  if (q.premium === 'no') and.push({ OR: [{ isPremium: false }, { premiumUntil: { lte: now } }] });
  if (q.role === 'admin') and.push({ isAdmin: true });
  if (q.role === 'banned') and.push({ isBanned: true });
  if (q.role === 'active') and.push({ isBanned: false, isAdmin: false });
  if (Number(q.joined) > 0) and.push({ createdAt: { gte: new Date(now.getTime() - Number(q.joined) * DAY) } });
  if (Number(q.inactive) > 0) {
    const before = new Date(now.getTime() - Number(q.inactive) * DAY);
    and.push({ OR: [{ lastSeenAt: { lt: before } }, { lastSeenAt: null, createdAt: { lt: before } }] });
  }
  return { AND: and };
}

const USER_SORTS = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  lastSeen: { lastSeenAt: { sort: 'desc', nulls: 'last' } },
  name: { fullName: 'asc' },
};

// CSV'de 'ne arıyor' alanı okunabilir olsun
const INTENT_TR = {
  friendship: 'Arkadaşlık', coffee: 'Bir Kahve', study: 'Çalışma Arkadaşı', event: 'Etkinlik Arkadaşı',
  club: 'Kulüp Arkadaşı', sports: 'Spor Arkadaşı', project: 'Proje Ortağı', language: 'Dil Pratiği',
  travel: 'Gezi Arkadaşı', roommate: 'Ev Arkadaşı', dating: 'Flört', relationship: 'Uzun Süreli İlişki',
};

const premiumActive = (u, now = new Date()) => !!u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > now);

router.get('/users', async (req, res) => {
  try {
    const { status = '', page = '1', pageSize = '20', sort = 'newest' } = req.query;
    const take = Math.min(Number(pageSize) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const where = userListWhere(req.query);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          photoUrl: true,
          department: true,
          classYear: true,
          intent: true,
          verificationStatus: true,
          studentDocStatus: true,
          ocrAutoCheckPassed: true,
          isAdmin: true,
          isBanned: true,
          isFrozen: true,
          isPremium: true,
          premiumUntil: true,
          lastSeenAt: true,
          createdAt: true,
          university: { select: { id: true, name: true } },
        },
        // Manuel inceleme kuyruğunda en eski talep en önce
        orderBy: status === 'manual_review' ? { createdAt: 'asc' } : USER_SORTS[sort] || USER_SORTS.newest,
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    const now = new Date();
    res.json({
      users: users.map((u) => ({ ...u, premiumActive: premiumActive(u, now) })),
      total,
      page: Number(page) || 1,
      pageSize: take,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
  }
});

// GET /admin/users/export.csv — filtrelenmiş listeyi Excel uyumlu CSV olarak indir
router.get('/users/export.csv', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: userListWhere(req.query),
      select: {
        id: true, fullName: true, email: true, department: true, classYear: true, intent: true,
        studentDocStatus: true, isPremium: true, premiumUntil: true, isBanned: true, createdAt: true, lastSeenAt: true,
        university: { select: { name: true } },
      },
      orderBy: USER_SORTS[req.query.sort] || USER_SORTS.newest,
      take: 50000,
    });
    const now = new Date();
    const cell = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      // Excel formül enjeksiyonuna karşı (=, +, -, @ ile başlayan hücreler)
      const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const header = ['ID', 'Ad Soyad', 'E-posta', 'Üniversite', 'Bölüm', 'Sınıf', 'Ne arıyor', 'Rozet', 'Premium', 'Askıda', 'Kayıt', 'Son görülme'];
    const rows = users.map((u) => [
      u.id, u.fullName, u.email, u.university?.name, u.department, u.classYear,
      (u.intent || '').split(',').filter(Boolean).map((i) => INTENT_TR[i] || i).join(', '),
      u.studentDocStatus === 'approved' ? 'Evet' : 'Hayır', premiumActive(u, now) ? 'Evet' : 'Hayır',
      u.isBanned ? 'Evet' : 'Hayır', date(u.createdAt), date(u.lastSeenAt),
    ]);
    const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kampus-kullanicilar-${date(now)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'CSV oluşturulamadı.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        department: true,
        classYear: true,
        age: true,
        bio: true,
        photoUrl: true,
        interests: true,
        hobbies: true,
        intent: true,
        verificationStatus: true,
        rejectionReason: true,
        studentDocUrl: true,
        studentDocStatus: true,
        // Grup D: OCR ön kontrolü - hesabı doğrulamaz, sadece admin'e ipucu verir.
        ocrExtractedText: true,
        ocrAutoCheckPassed: true,
        ocrProcessedAt: true,
        isAdmin: true,
        isBanned: true,
        isFrozen: true,
        isPremium: true,
        premiumUntil: true,
        premiumSince: true,
        swipeEnabled: true,
        profileVisibility: true,
        lastSeenAt: true,
        createdAt: true,
        university: { select: { id: true, name: true } },
        photos: { select: { id: true, url: true }, orderBy: { position: 'asc' }, take: 6 },
      },
    });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const [likesGiven, likesReceived, matches, messages, posts, clubs, followers, reportsAgainst, payments] = await Promise.all([
      prisma.like.count({ where: { fromUserId: id } }),
      prisma.like.count({ where: { toUserId: id } }),
      prisma.match.count({ where: { OR: [{ userAId: id }, { userBId: id }] } }),
      prisma.message.count({ where: { senderId: id } }),
      prisma.post.count({ where: { authorId: id } }),
      prisma.clubMembership.count({ where: { userId: id, status: 'active' } }),
      prisma.follow.count({ where: { followingId: id } }),
      prisma.report.count({ where: { targetType: 'user', targetId: id } }),
      prisma.paymentLog.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    res.json({
      ...user,
      premiumActive: premiumActive(user),
      stats: { likesGiven, likesReceived, matches, messages, posts, clubs, followers, reportsAgainst },
      payments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kullanıcı alınamadı.' });
  }
});

// Doğrulama durumunu güncelle, admin/ban durumunu değiştir
router.patch('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { verificationStatus, isAdmin, isBanned, rejectionReason, premiumDays, revokePremium } = req.body;

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
      data.rejectionReason = verificationStatus === 'rejected' ? rejectionReason.trim() : null;
    }
    if (isAdmin !== undefined) data.isAdmin = !!isAdmin;
    if (isBanned !== undefined) data.isBanned = !!isBanned;

    const previous = await prisma.user.findUnique({
      where: { id },
      select: { verificationStatus: true, studentDocStatus: true, email: true, fullName: true, isPremium: true, premiumUntil: true, premiumSince: true },
    });
    if (!previous) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Hediye Premium (kampanya / ödül): mevcut süreye eklenir, gelir sayılmaz
    const giftDays = Number(premiumDays);
    if (premiumDays !== undefined) {
      if (!Number.isInteger(giftDays) || giftDays < 1 || giftDays > 365) {
        return res.status(400).json({ error: 'Premium süresi 1–365 gün olmalı.' });
      }
      const now = new Date();
      const base = previous.isPremium && previous.premiumUntil && new Date(previous.premiumUntil) > now ? new Date(previous.premiumUntil) : now;
      data.isPremium = true;
      data.premiumUntil = new Date(base.getTime() + giftDays * DAY);
      data.premiumSince = previous.premiumSince || now;
    } else if (revokePremium === true) {
      data.isPremium = false;
      data.premiumUntil = null;
    }

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
        isPremium: true,
        premiumUntil: true,
      },
    });

    if (premiumDays !== undefined) {
      await prisma.paymentLog.create({ data: { userId: id, plan: `gift_${giftDays}d`, amount: 0, provider: 'admin_gift' } });
      await createNotification(req.app.get('io'), {
        userId: id,
        type: 'announcement',
        targetType: 'campaign',
        message: JSON.stringify({
          title: 'Sana Premium hediye ettik',
          body: `${giftDays} günlük kampüs· Premium hesabına tanımlandı. Keyfini çıkar!`,
          link: '/settings',
        }),
      });
    }

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
          visibility: true,
          author: { select: { id: true, fullName: true, email: true, university: { select: { name: true } } } },
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
    res.status(500).json({ error: 'Gönderiler alınamadı.' });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Gönderi silindi.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gönderi silinemedi.' });
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
          } else if (r.targetType === 'comment') {
            target = await prisma.comment.findUnique({
              where: { id: r.targetId },
              select: { id: true, content: true, authorId: true },
            });
          } else if (r.targetType === 'club') {
            target = await prisma.club.findUnique({
              where: { id: r.targetId },
              select: { id: true, name: true, creatorId: true },
            });
          }
        } catch {
          target = null;
        }
        // Şikayet edilen içeriğin sahibi (askıya alma işlemi için)
        const ownerId = target ? reportTargetOwnerId(r.targetType, target) : null;
        const owner = ownerId
          ? await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, fullName: true, email: true, isBanned: true } })
          : null;
        const previousReports = ownerId
          ? await prisma.report.count({ where: { targetType: 'user', targetId: ownerId } })
          : 0;
        return { ...r, target, owner, previousReports };
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

// POST /admin/reports/:id/action — tek tıkla karar
//   ban_user       içeriğin sahibini askıya al + şikayeti "çözüldü" yap
//   delete_content içeriği sil + şikayeti "çözüldü" yap
//   dismiss        şikayeti reddet (işlem gerekmez)
router.post('/reports/:id/action', async (req, res) => {
  try {
    const { action } = req.body;
    const report = await prisma.report.findUnique({ where: { id: Number(req.params.id) } });
    if (!report) return res.status(404).json({ error: 'Şikayet bulunamadı.' });

    const io = req.app.get('io');
    let message = '';
    if (action === 'dismiss') {
      message = 'Şikayet reddedildi.';
    } else if (action === 'ban_user') {
      const target = await loadReportTarget(report);
      const ownerId = target ? reportTargetOwnerId(report.targetType, target) : null;
      if (!ownerId) return res.status(400).json({ error: 'İçerik silinmiş; askıya alınacak kullanıcı bulunamadı.' });
      if (ownerId === req.userId) return res.status(400).json({ error: 'Kendini askıya alamazsın.' });
      const owner = await prisma.user.update({ where: { id: ownerId }, data: { isBanned: true }, select: { fullName: true } });
      io?.in(`user_${ownerId}`).disconnectSockets(true);
      message = `${owner.fullName} askıya alındı.`;
    } else if (action === 'delete_content') {
      const model = { post: 'post', story: 'story', message: 'message', club_message: 'clubMessage', comment: 'comment', club: 'club' }[report.targetType];
      if (!model) return res.status(400).json({ error: 'Bu şikayet türünde silinecek içerik yok; kullanıcıyı askıya alabilirsin.' });
      const result = await prisma[model].deleteMany({ where: { id: report.targetId } });
      message = result.count ? 'İçerik silindi.' : 'İçerik zaten silinmiş.';
    } else {
      return res.status(400).json({ error: 'Geçersiz işlem.' });
    }

    await prisma.report.update({
      where: { id: report.id },
      data: { status: action === 'dismiss' ? 'dismissed' : 'resolved', reviewedAt: new Date() },
    });
    res.json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem uygulanamadı.' });
  }
});

function reportTargetOwnerId(type, target) {
  if (!target) return null;
  if (type === 'user') return target.id;
  return target.authorId || target.senderId || target.creatorId || null;
}

async function loadReportTarget(report) {
  const id = report.targetId;
  const select = {
    user: { id: true },
    post: { authorId: true },
    story: { authorId: true },
    comment: { authorId: true },
    message: { senderId: true },
    club_message: { senderId: true },
    club: { creatorId: true },
  }[report.targetType];
  const model = { user: 'user', post: 'post', story: 'story', comment: 'comment', message: 'message', club_message: 'clubMessage', club: 'club' }[report.targetType];
  if (!model) return null;
  return prisma[model].findUnique({ where: { id }, select });
}

// ============================================================
// TEK KULLANICIYA BİLDİRİM
// ============================================================
router.post('/users/:id/notify', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const title = (req.body.title || '').trim();
    const body = (req.body.body || '').trim();
    if (!title || title.length > 80 || !body || body.length > 500) {
      return res.status(400).json({ error: 'Başlık (en fazla 80) ve mesaj (en fazla 500 karakter) zorunlu.' });
    }
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true } });
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    await createNotification(req.app.get('io'), {
      userId: id,
      type: 'announcement',
      targetType: 'campaign',
      message: JSON.stringify({ title, body, link: null }),
    });
    res.json({ message: `${user.fullName} kişisine bildirim gönderildi.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bildirim gönderilemedi.' });
  }
});

// ============================================================
// KULÜPLER ve ETKİNLİKLER
// ============================================================
router.get('/clubs', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const where = {
      AND: [
        search ? { OR: [{ name: { contains: search } }, { university: { name: { contains: search } } }] } : {},
        req.query.university ? { universityId: Number(req.query.university) } : {},
      ],
    };
    const clubs = await prisma.club.findMany({
      where,
      select: {
        id: true,
        name: true,
        category: true,
        iconEmoji: true,
        createdAt: true,
        university: { select: { id: true, name: true } },
        creator: { select: { id: true, fullName: true } },
        _count: { select: { memberships: { where: { status: 'active' } }, events: true, messages: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(clubs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüpler alınamadı.' });
  }
});

router.delete('/clubs/:id', async (req, res) => {
  try {
    await prisma.club.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Kulüp silindi.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'Kulüp silinemedi.' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const now = new Date();
    const past = req.query.scope === 'past';
    const events = await prisma.event.findMany({
      where: { startsAt: past ? { lt: now } : { gte: now } },
      select: {
        id: true,
        title: true,
        location: true,
        startsAt: true,
        club: { select: { id: true, name: true, iconEmoji: true, university: { select: { name: true } } } },
        _count: { select: { rsvps: true } },
      },
      orderBy: { startsAt: past ? 'desc' : 'asc' },
      take: 200,
    });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkinlikler alınamadı.' });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: 'Etkinlik silindi.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Etkinlik bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'Etkinlik silinemedi.' });
  }
});

// ============================================================
// YÖNETİCİLER
// ============================================================
router.get('/admins', async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true, fullName: true, email: true, createdAt: true, lastSeenAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(admins.map((a) => ({ ...a, isMe: a.id === req.userId })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yöneticiler alınamadı.' });
  }
});

router.post('/admins', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    if (!user) return res.status(404).json({ error: 'Bu e-postayla kayıtlı bir kullanıcı bulunamadı.' });
    if (user.isAdmin) return res.status(409).json({ error: `${user.fullName} zaten yönetici.` });
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    res.json({ message: `${user.fullName} artık yönetici.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yönetici eklenemedi.' });
  }
});

module.exports = router;
