// Admin paneli: pazarlama ve büyüme analitiği.
// admin.js içinde requireAdmin'den SONRA bağlanır; buraya yalnızca adminler ulaşır.
//
// "Aktif kullanıcı" = seçilen dönemde uygulamayı açmış (lastSeenAt), şu an
// çevrimiçi olan ya da dönem içinde bir şey yapmış (beğeni, mesaj, gönderi,
// kulüp mesajı) herkes. lastSeenAt yalnızca bağlantı kapanınca yazıldığı için
// eylemlerle birleştirmek sayıyı gerçeğe yaklaştırır.
const express = require('express');
const prisma = require('../lib/prisma');
const { getOnlineUserIds } = require('../socket');

const router = express.Router();
const DAY = 24 * 60 * 60 * 1000;
const NOT_ADMIN = { isAdmin: false };

function parseDays(v) {
  const n = Number(v);
  return [7, 30, 90].includes(n) ? n : 30;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Yerel saatle YYYY-AA-GG (grafikteki günler Türkiye saatine göre)
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur > 0 ? null : 0);

// Şu an çevrimiçi olan öğrenciler (yöneticiler hariç)
async function onlineStudentIds() {
  const online = getOnlineUserIds().map(Number);
  if (!online.length) return [];
  const admins = await prisma.user.findMany({ where: { id: { in: online }, isAdmin: true }, select: { id: true } });
  const adminSet = new Set(admins.map((a) => a.id));
  return online.filter((id) => !adminSet.has(id));
}

async function activeUserIds(from, to) {
  const range = { gte: from, lt: to };
  const [seen, likes, messages, posts, clubMessages] = await Promise.all([
    prisma.user.findMany({ where: { ...NOT_ADMIN, lastSeenAt: range }, select: { id: true } }),
    prisma.like.findMany({ where: { createdAt: range }, select: { fromUserId: true }, distinct: ['fromUserId'] }),
    prisma.message.findMany({ where: { createdAt: range }, select: { senderId: true }, distinct: ['senderId'] }),
    prisma.post.findMany({ where: { createdAt: range }, select: { authorId: true }, distinct: ['authorId'] }),
    prisma.clubMessage.findMany({ where: { createdAt: range }, select: { senderId: true }, distinct: ['senderId'] }),
  ]);
  const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
  const ids = new Set([
    ...seen.map((u) => u.id),
    ...likes.map((r) => r.fromUserId),
    ...messages.map((r) => r.senderId),
    ...posts.map((r) => r.authorId),
    ...clubMessages.map((r) => r.senderId),
  ]);
  admins.forEach((a) => ids.delete(a.id));
  return ids;
}

async function periodCounts(from, to, { includeOnline = false } = {}) {
  const range = { gte: from, lt: to };
  const [newUsers, matches, messages, clubMessages, likes, posts, clubJoins, rsvps, revenue, active] = await Promise.all([
    prisma.user.count({ where: { ...NOT_ADMIN, createdAt: range } }),
    prisma.match.count({ where: { createdAt: range } }),
    prisma.message.count({ where: { createdAt: range } }),
    prisma.clubMessage.count({ where: { createdAt: range } }),
    prisma.like.count({ where: { createdAt: range } }),
    prisma.post.count({ where: { createdAt: range } }),
    prisma.clubMembership.count({ where: { joinedAt: range } }),
    prisma.eventRSVP.count({ where: { createdAt: range } }),
    prisma.paymentLog.aggregate({
      where: { createdAt: range, status: 'success', amount: { gt: 0 } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    activeUserIds(from, to),
  ]);
  if (includeOnline) (await onlineStudentIds()).forEach((id) => active.add(id));
  return {
    newUsers,
    activeUsers: active.size,
    matches,
    messages: messages + clubMessages,
    likes,
    posts,
    clubJoins,
    rsvps,
    revenue: Math.round((revenue._sum.amount || 0) * 100) / 100,
    payments: revenue._count._all,
  };
}

function countBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    for (const key of [].concat(keyFn(item))) {
      if (key === null || key === undefined || key === '') continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

const splitTags = (s) =>
  (s || '')
    .split(',')
    .map((t) => t.trim().toLocaleLowerCase('tr-TR'))
    .filter(Boolean);

// ------------------------------------------------------------
// GET /admin/insights/overview?days=7|30|90
// ------------------------------------------------------------
router.get('/insights/overview', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const now = new Date();
    const from = new Date(startOfDay(now).getTime() - (days - 1) * DAY);
    const prevFrom = new Date(from.getTime() - days * DAY);

    const [current, previous] = await Promise.all([
      periodCounts(from, now, { includeOnline: true }),
      periodCounts(prevFrom, from),
    ]);
    const kpis = Object.fromEntries(
      Object.keys(current).map((k) => [k, { value: current[k], previous: previous[k], change: delta(current[k], previous[k]) }])
    );

    // Günlük seri
    const range = { gte: from, lt: now };
    const [userRows, matchRows, messageRows, clubMessageRows] = await Promise.all([
      prisma.user.findMany({ where: { ...NOT_ADMIN, createdAt: range }, select: { createdAt: true } }),
      prisma.match.findMany({ where: { createdAt: range }, select: { createdAt: true } }),
      prisma.message.findMany({ where: { createdAt: range }, select: { createdAt: true } }),
      prisma.clubMessage.findMany({ where: { createdAt: range }, select: { createdAt: true } }),
    ]);
    const series = [];
    const index = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * DAY);
      const row = { date: dayKey(d), signups: 0, matches: 0, messages: 0 };
      index[row.date] = row;
      series.push(row);
    }
    userRows.forEach((r) => index[dayKey(r.createdAt)] && index[dayKey(r.createdAt)].signups++);
    matchRows.forEach((r) => index[dayKey(r.createdAt)] && index[dayKey(r.createdAt)].matches++);
    [...messageRows, ...clubMessageRows].forEach((r) => index[dayKey(r.createdAt)] && index[dayKey(r.createdAt)].messages++);

    // Aktivasyon hunisi: dönemde kayıt olanlar ilk adımları ne kadar tamamladı
    const cohort = await prisma.user.findMany({
      where: { ...NOT_ADMIN, createdAt: range },
      select: { id: true, photoUrl: true, interests: true, hobbies: true },
    });
    const ids = cohort.map((u) => u.id);
    const [likedRows, matchedRows, messagedRows, clubRows] = ids.length
      ? await Promise.all([
          prisma.like.findMany({ where: { fromUserId: { in: ids } }, select: { fromUserId: true }, distinct: ['fromUserId'] }),
          prisma.match.findMany({ where: { OR: [{ userAId: { in: ids } }, { userBId: { in: ids } }] }, select: { userAId: true, userBId: true } }),
          prisma.message.findMany({ where: { senderId: { in: ids } }, select: { senderId: true }, distinct: ['senderId'] }),
          prisma.clubMembership.findMany({ where: { userId: { in: ids } }, select: { userId: true }, distinct: ['userId'] }),
        ])
      : [[], [], [], []];
    const idSet = new Set(ids);
    const matchedSet = new Set();
    matchedRows.forEach((m) => {
      if (idSet.has(m.userAId)) matchedSet.add(m.userAId);
      if (idSet.has(m.userBId)) matchedSet.add(m.userBId);
    });
    const registered = cohort.length;
    const funnel = [
      { key: 'registered', label: 'Kayıt oldu', count: registered },
      { key: 'photo', label: 'Profil fotoğrafı ekledi', count: cohort.filter((u) => u.photoUrl).length },
      { key: 'interests', label: 'İlgi alanı ekledi', count: cohort.filter((u) => u.interests || u.hobbies).length },
      { key: 'liked', label: 'İlk beğenisini yaptı', count: likedRows.length },
      { key: 'matched', label: 'İlk eşleşmesini yaşadı', count: matchedSet.size },
      { key: 'messaged', label: 'İlk mesajını gönderdi', count: messagedRows.length },
    ].map((s) => ({ ...s, rate: pct(s.count, registered) }));

    // Geri dönüş (tutundurma): kayıttan N gün sonra hâlâ uygulamaya giren oranı
    const retentionPool = await prisma.user.findMany({
      where: { ...NOT_ADMIN, createdAt: { gte: new Date(now.getTime() - 120 * DAY) } },
      select: { createdAt: true, lastSeenAt: true },
    });
    const retention = [1, 7, 30].map((n) => {
      const eligible = retentionPool.filter((u) => now - new Date(u.createdAt) >= n * DAY);
      const returned = eligible.filter((u) => u.lastSeenAt && new Date(u.lastSeenAt) - new Date(u.createdAt) >= n * DAY);
      return { day: n, eligible: eligible.length, returned: returned.length, rate: pct(returned.length, eligible.length) };
    });

    // Kitle profili (tüm öğrenciler)
    const people = await prisma.user.findMany({
      where: { ...NOT_ADMIN, isBanned: false },
      select: { intent: true, classYear: true, interests: true, hobbies: true, age: true, studentDocStatus: true, isPremium: true, premiumUntil: true },
    });
    const ageBucket = (a) => (!a ? null : a < 20 ? '18–19' : a < 22 ? '20–21' : a < 24 ? '22–23' : a < 26 ? '24–25' : '26+');
    const audience = {
      total: people.length,
      intents: countBy(people, (u) => (u.intent || '').split(',').map((s) => s.trim())),
      classYears: countBy(people, (u) => u.classYear).sort((a, b) => a.key - b.key),
      ages: countBy(people, (u) => ageBucket(u.age)).sort((a, b) => a.key.localeCompare(b.key)),
      interests: countBy(people, (u) => [...new Set([...splitTags(u.interests), ...splitTags(u.hobbies)])]).slice(0, 12),
      badgeRate: pct(people.filter((u) => u.studentDocStatus === 'approved').length, people.length),
      premiumActive: people.filter((u) => u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > now)).length,
    };

    // Yapılacaklar
    const [pendingVerifications, pendingReports, activeBanners, newToday] = await Promise.all([
      prisma.user.count({ where: { OR: [{ verificationStatus: 'manual_review' }, { studentDocStatus: 'pending' }] } }),
      prisma.report.count({ where: { status: 'pending' } }),
      prisma.campaign.count({ where: { bannerUntil: { gt: now } } }),
      prisma.user.count({ where: { ...NOT_ADMIN, createdAt: { gte: startOfDay(now) } } }),
    ]);

    res.json({
      days,
      from,
      kpis,
      series,
      funnel,
      retention,
      audience,
      actions: { pendingVerifications, pendingReports, activeBanners, newToday, onlineNow: (await onlineStudentIds()).length },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Genel bakış verileri alınamadı.' });
  }
});

// ------------------------------------------------------------
// GET /admin/insights/campuses?days=7|30|90 — kampüs performansı
// ------------------------------------------------------------
router.get('/insights/campuses', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const now = new Date();
    const from = new Date(startOfDay(now).getTime() - (days - 1) * DAY);

    const [universities, users, matches, clubs, events] = await Promise.all([
      prisma.university.findMany({ select: { id: true, name: true, emailDomain: true } }),
      prisma.user.findMany({
        where: NOT_ADMIN,
        select: { id: true, universityId: true, createdAt: true, lastSeenAt: true, studentDocStatus: true, isPremium: true, premiumUntil: true },
      }),
      prisma.match.findMany({ select: { createdAt: true, userA: { select: { universityId: true } } } }),
      prisma.club.groupBy({ by: ['universityId'], _count: { _all: true } }),
      prisma.event.findMany({ where: { startsAt: { gte: now } }, select: { club: { select: { universityId: true } } } }),
    ]);
    const active = await activeUserIds(from, now);
    (await onlineStudentIds()).forEach((id) => active.add(id));

    const stats = new Map();
    const get = (id) => {
      if (!stats.has(id)) {
        stats.set(id, { users: 0, newUsers: 0, activeUsers: 0, badge: 0, premium: 0, matches: 0, newMatches: 0, clubs: 0, upcomingEvents: 0 });
      }
      return stats.get(id);
    };
    for (const u of users) {
      const s = get(u.universityId);
      s.users++;
      if (new Date(u.createdAt) >= from) s.newUsers++;
      if (active.has(u.id)) s.activeUsers++;
      if (u.studentDocStatus === 'approved') s.badge++;
      if (u.isPremium && (!u.premiumUntil || new Date(u.premiumUntil) > now)) s.premium++;
    }
    for (const m of matches) {
      const s = get(m.userA.universityId);
      s.matches++;
      if (new Date(m.createdAt) >= from) s.newMatches++;
    }
    clubs.forEach((c) => (get(c.universityId).clubs = c._count._all));
    events.forEach((e) => get(e.club.universityId).upcomingEvents++);

    const campuses = universities
      .filter((u) => stats.has(u.id))
      .map((u) => {
        const s = stats.get(u.id);
        return { id: u.id, name: u.name, emailDomain: u.emailDomain, ...s, activeRate: pct(s.activeUsers, s.users) };
      })
      .sort((a, b) => b.users - a.users || b.activeUsers - a.activeUsers);

    res.json({
      days,
      totalUniversities: universities.length,
      liveUniversities: campuses.length,
      totalUsers: users.length,
      campuses,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kampüs verileri alınamadı.' });
  }
});

module.exports = router;
