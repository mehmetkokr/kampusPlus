// Yeni "Keşfet" sayfası: swipe/eşleşme mekaniğinden farklı olarak sosyal bir
// akış (Instagram'ın "Keşfet" sekmesine benzer). Performans için tüm bölümler
// tek bir istekte (/home) toplanır, ayrıca ayrı bir arama endpoint'i vardır.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getOnlineUserIds } = require('../socket');
const { isPremiumActive } = require('../lib/premium');
const { discoverableUserWhere, sharesActivity } = require('../lib/privacy');

const router = express.Router();

const CARD_SELECT = {
  id: true,
  fullName: true,
  photoUrl: true,
  department: true,
  classYear: true,
  verificationStatus: true,
  studentDocStatus: true,
  showActivityStatus: true,
  lastSeenAt: true,
  createdAt: true,
  universityId: true,
  university: { select: { id: true, name: true } },
};

// Yeşil tik yalnızca öğrenci belgesi admin tarafından onaylanan hesaplara verilir
// İlgi alanı / hobi etiketleri virgülle ayrılmış metin olarak saklanır.
// Karşılaştırma büyük-küçük harf duyarsız (profilde listeden seçildikleri
// için birebir eşleşirler).
const tagKey = (t) => t.trim().toLocaleLowerCase('tr');
const splitTags = (v) => (v || '').split(',').map((t) => t.trim()).filter(Boolean);
const userTags = (u) => [...splitTags(u.interests), ...splitTags(u.hobbies)];

function isVerified(u) {
  return u.studentDocStatus === 'approved';
}

function lastActiveLabel(lastSeenAt, online) {
  if (online) return 'Şimdi aktif';
  if (!lastSeenAt) return null;
  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Az önce aktifti';
  if (mins < 60) return `Son aktif: ${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Son aktif: ${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `Son aktif: ${days} gün önce`;
}

// ---------------------------------------------------------
// GET /api/discover/home
// Query: department, classYear (isteğe bağlı filtreler)
// ---------------------------------------------------------
router.get('/home', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const { department, classYear } = req.query;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [blockedByMe, blockingMe, followingRows] = await Promise.all([
      prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } }),
      prisma.follow.findMany({ where: { followerId: req.userId }, select: { followingId: true } }),
    ]);
    const excludeIds = [
      req.userId,
      ...blockedByMe.map((b) => b.blockedId),
      ...blockingMe.map((b) => b.blockerId),
      ...followingRows.map((f) => f.followingId),
    ];
    const myFollowingIds = new Set(followingRows.map((f) => f.followingId));
    const onlineIds = new Set(getOnlineUserIds());

    // ---------- Önerilen Kişiler ----------
    const candidateWhere = {
      ...discoverableUserWhere(me.universityId),
      universityId: me.universityId,
      id: { notIn: excludeIds },
      verificationStatus: { in: ['auto_verified', 'verified'] },
    };
    if (department) candidateWhere.department = department;
    if (classYear) candidateWhere.classYear = Number(classYear);

    const candidates = await prisma.user.findMany({
      where: candidateWhere,
      select: { ...CARD_SELECT, interests: true, hobbies: true, _count: { select: { followers: true } } },
      take: 60,
    });

    // Ortak takip edilen kişi sayısını hesapla (basit "ortak arkadaş" yaklaşımı)
    const candidateFollowingRows = await prisma.follow.findMany({
      where: { followerId: { in: candidates.map((c) => c.id) } },
      select: { followerId: true, followingId: true },
    });
    const followingByCandidate = new Map();
    for (const row of candidateFollowingRows) {
      if (!followingByCandidate.has(row.followerId)) followingByCandidate.set(row.followerId, new Set());
      followingByCandidate.get(row.followerId).add(row.followingId);
    }

    // Ortak ilgi alanı / hobiler (büyük-küçük harf duyarsız)
    const myTags = new Set([...splitTags(me.interests), ...splitTags(me.hobbies)].map(tagKey));

    let suggested = candidates.map((c) => {
      const seenTags = new Set();
      const commonTags = [...splitTags(c.hobbies), ...splitTags(c.interests)].filter((t) => {
        const k = tagKey(t);
        if (!myTags.has(k) || seenTags.has(k)) return false;
        seenTags.add(k);
        return true;
      });
      const theirFollowing = followingByCandidate.get(c.id) || new Set();
      let mutualCount = 0;
      for (const id of myFollowingIds) {
        if (theirFollowing.has(id)) mutualCount += 1;
      }
      return {
        id: c.id,
        fullName: c.fullName,
        photoUrl: c.photoUrl,
        department: c.department,
        classYear: c.classYear,
        university: c.university,
        verified: isVerified(c),
        followerCount: c._count.followers,
        mutualCount,
        commonTags,
        online: sharesActivity(c) && onlineIds.has(c.id),
        lastActiveLabel: sharesActivity(c) ? lastActiveLabel(c.lastSeenAt, onlineIds.has(c.id)) : null,
      };
    });
    // Ortak arkadaş, sonra ortak ilgi alanı sayısına göre öne çıkar
    suggested.sort((a, b) => b.mutualCount - a.mutualCount || b.commonTags.length - a.commonTags.length);
    suggested = suggested.slice(0, 20);

    // ---------- Bugün Kampüste ----------
    const [newUsersToday, newPostsToday, newClubsToday] = await Promise.all([
      prisma.user.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
      prisma.post.count({
        where: { author: { universityId: me.universityId }, createdAt: { gte: startOfToday } },
      }),
      prisma.club.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
    ]);

    // ---------- Şu an aktif (çevrimiçi, kendi üniversitemden) ----------
    // Takip ettiklerim de dahil (önerilerden farklı olarak); yalnızca ben ve
    // engelleşilen kişiler hariç.
    const blockedIds = new Set([...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)]);
    const onlineRows = await prisma.user.findMany({
      where: {
        ...discoverableUserWhere(me.universityId),
        id: { in: [...onlineIds].filter((id) => id !== req.userId && !blockedIds.has(id)) },
        universityId: me.universityId,
        showActivityStatus: true,
      },
      select: { id: true, fullName: true, photoUrl: true, studentDocStatus: true },
      take: 30,
    });
    // Takip ettiklerim önce
    const onlineUsers = onlineRows
      .map((u) => ({ id: u.id, fullName: u.fullName, photoUrl: u.photoUrl, verified: isVerified(u), following: myFollowingIds.has(u.id) }))
      .sort((a, b) => Number(b.following) - Number(a.following));

    // ---------- Hızlı erişim kutuları ----------
    // Kart Modu'nda sırada bekleyen kişi sayısı (henüz beğenmediklerim) ve
    // üye olduğum kulüp sayısı.
    const [likedRows, myClubCount] = await Promise.all([
      prisma.like.findMany({ where: { fromUserId: req.userId }, select: { toUserId: true } }),
      prisma.clubMembership.count({ where: { userId: req.userId, status: 'active' } }),
    ]);
    const campusPeopleWhere = {
      AND: [discoverableUserWhere(me.universityId)],
      universityId: me.universityId,
      verificationStatus: { in: ['auto_verified', 'verified'] },
      id: { notIn: [req.userId, ...blockedIds] },
    };
    const swipeCount = await prisma.user.count({
      where: { ...campusPeopleWhere, swipeEnabled: true, id: { notIn: [req.userId, ...blockedIds, ...likedRows.map((l) => l.toUserId)] } },
    });

    // ---------- İlgi alanına göre keşfet ----------
    // Kendi ilgi alanı ve hobilerimin her biri için kampüste bunu seçmiş kişi
    // sayısı ve birkaç avatar. Kampüs küçük olsa da kişinin kendi etiketleriyle
    // dolduğu için bölüm boş kalmaz.
    const campusTagRows = await prisma.user.findMany({
      where: { ...campusPeopleWhere, AND: [discoverableUserWhere(me.universityId), { OR: [{ interests: { not: null } }, { hobbies: { not: null } }] }] },
      select: { interests: true, hobbies: true, photoUrl: true },
      take: 3000,
    });
    const myUniqueTags = [...new Map(userTags(me).map((t) => [tagKey(t), t])).values()];
    const interestTiles = myUniqueTags
      .map((tag) => {
        const k = tagKey(tag);
        const people = campusTagRows.filter((u) => userTags(u).some((x) => tagKey(x) === k));
        return { tag, count: people.length, avatars: people.filter((p) => p.photoUrl).slice(0, 3).map((p) => p.photoUrl) };
      })
      .sort((a, b) => b.count - a.count);

    // ---------- Trend Kulüpler ----------
    const clubs = await prisma.club.findMany({
      where: { universityId: me.universityId },
      select: {
        id: true,
        name: true,
        iconEmoji: true,
        category: true,
        _count: { select: { memberships: { where: { status: 'active' } } } },
      },
    });
    const trendingClubs = clubs
      .map((c) => ({ id: c.id, name: c.name, iconEmoji: c.iconEmoji, category: c.category, memberCount: c._count.memberships }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 8);

    // ---------- Son Paylaşımlar (kendi üniversitemden, herkese açık akış) ----------
    const recentPostsRaw = await prisma.post.findMany({
      where: {
        visibility: 'campus',
        author: { universityId: me.universityId, id: { notIn: [...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)] } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        author: { select: { id: true, fullName: true, photoUrl: true, university: { select: { name: true } } } },
        likes: { select: { userId: true } },
        _count: { select: { comments: true } },
      },
    });
    const recentPosts = recentPostsRaw.map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      createdAt: p.createdAt,
      author: p.author,
      likeCount: p.likes.length,
      commentCount: p._count.comments,
      likedByMe: p.likes.some((l) => l.userId === req.userId),
    }));

    res.json({
      suggestedUsers: suggested,
      stats: {
        newUsersToday,
        newPostsToday,
        newClubsToday,
      },
      onlineUsers,
      quick: { swipeCount, myClubCount },
      interestTiles,
      trendingClubs,
      recentPosts,
      isPremium: isPremiumActive(me),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Keşfet verileri alınamadı.' });
  }
});

// ---------------------------------------------------------
// GET /api/discover/by-tag?tag=Kahve — kendi kampüsümde bu ilgi alanını ya da
// hobiyi seçmiş öğrenciler (Keşfet'teki "İlgi alanına göre keşfet" kutuları)
// ---------------------------------------------------------
router.get('/by-tag', requireAuth, async (req, res) => {
  try {
    const tag = String(req.query.tag || '').trim().slice(0, 40);
    if (!tag) return res.json({ tag, users: [] });

    const [me, blockedByMe, blockingMe, followingRows] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId }, select: { universityId: true } }),
      prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } }),
      prisma.follow.findMany({ where: { followerId: req.userId }, select: { followingId: true } }),
    ]);
    const following = new Set(followingRows.map((f) => f.followingId));
    const rows = await prisma.user.findMany({
      where: {
        AND: [discoverableUserWhere(me.universityId), { OR: [{ interests: { contains: tag } }, { hobbies: { contains: tag } }] }],
        universityId: me.universityId,
        verificationStatus: { in: ['auto_verified', 'verified'] },
        id: { notIn: [req.userId, ...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)] },
      },
      select: { ...CARD_SELECT, interests: true, hobbies: true },
      take: 200,
    });
    // "contains" kaba bir ön süzgeç (ör. "Kamp" "Kamping"i de yakalar); kesin eşleşme burada
    const k = tagKey(tag);
    const users = rows
      .filter((u) => userTags(u).some((x) => tagKey(x) === k))
      .slice(0, 60)
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        photoUrl: u.photoUrl,
        department: u.department,
        classYear: u.classYear,
        verified: isVerified(u),
        following: following.has(u.id),
      }));
    res.json({ tag, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Liste alınamadı.' });
  }
});

// ---------------------------------------------------------
// GET /api/discover/search?q=... — kullanıcı, üniversite veya bölüm adına göre ara
// ---------------------------------------------------------
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [], lockedCount: 0, isPremium: false });

    const [me, blockedByMe, blockingMe] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId }, select: { universityId: true, isPremium: true, premiumUntil: true } }),
      prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } }),
    ]);
    const excludeIds = [req.userId, ...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)];
    const premium = isPremiumActive(me);

    const baseWhere = {
      AND: [
        discoverableUserWhere(me.universityId),
        {
          OR: [
            { fullName: { contains: q } },
            { department: { contains: q } },
            { university: { name: { contains: q } } },
          ],
        },
      ],
      id: { notIn: excludeIds },
      verificationStatus: { in: ['auto_verified', 'verified'] },
    };
    // Ücretsiz kullanıcı: sonuçlar kendi üniversitesiyle sınırlı, diğer
    // üniversitelerden kaç eşleşme olduğu ise kilitli bir sayı olarak dönüyor
    // (Premium'a geçiş için bir teşvik/teaser niteliğinde).
    const scopedWhere = premium ? baseWhere : { ...baseWhere, universityId: me.universityId };

    // Kendi kampüsümün kulüpleri (ad veya kategoriye göre)
    const clubs = await prisma.club.findMany({
      where: { universityId: me.universityId, OR: [{ name: { contains: q } }, { category: { contains: q } }] },
      select: { id: true, name: true, iconEmoji: true, category: true, _count: { select: { memberships: { where: { status: 'active' } } } } },
      take: 6,
    });

    const [users, lockedCount] = await Promise.all([
      prisma.user.findMany({
        where: scopedWhere,
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          department: true,
          verificationStatus: true,
          studentDocStatus: true,
          university: { select: { id: true, name: true } },
        },
        take: 25,
      }),
      premium ? Promise.resolve(0) : prisma.user.count({ where: { ...baseWhere, universityId: { not: me.universityId } } }),
    ]);

    res.json({
      results: users.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        photoUrl: u.photoUrl,
        department: u.department,
        verified: isVerified(u),
        university: u.university,
      })),
      clubs: clubs.map((c) => ({ id: c.id, name: c.name, iconEmoji: c.iconEmoji, category: c.category, memberCount: c._count.memberships })),
      lockedCount,
      isPremium: premium,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Arama yapılamadı.' });
  }
});

module.exports = router;
