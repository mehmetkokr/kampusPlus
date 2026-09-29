// Yeni "Keşfet" sayfası: swipe/eşleşme mekaniğinden farklı olarak sosyal bir
// akış (Instagram'ın "Keşfet" sekmesine benzer). Performans için tüm bölümler
// tek bir istekte (/home) toplanır, ayrıca ayrı bir arama endpoint'i vardır.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getOnlineUserIds } = require('../socket');
const { isPremiumActive } = require('../lib/premium');
const { isBoostActive } = require('../lib/monetization');

const router = express.Router();

const CARD_SELECT = {
  id: true,
  fullName: true,
  photoUrl: true,
  department: true,
  classYear: true,
  verificationStatus: true,
  lastSeenAt: true,
  createdAt: true,
  universityId: true,
  boostedUntil: true,
  university: { select: { id: true, name: true } },
};

function isVerified(u) {
  return u.verificationStatus === 'verified' || u.verificationStatus === 'auto_verified';
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
// Query: category (all|nearby|university|department|new|popular|verified|active)
//        department, classYear (ek filtreler)
// ---------------------------------------------------------
router.get('/home', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const { category = 'all', department, classYear } = req.query;
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
      universityId: me.universityId,
      id: { notIn: excludeIds },
      verificationStatus: { in: ['auto_verified', 'verified'] },
      isFrozen: false,
    };
    if (category === 'department') candidateWhere.department = me.department;
    if (department) candidateWhere.department = department;
    if (classYear) candidateWhere.classYear = Number(classYear);
    if (category === 'new') {
      candidateWhere.createdAt = { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) };
    }

    let candidates = await prisma.user.findMany({
      where: candidateWhere,
      select: { ...CARD_SELECT, _count: { select: { followers: true } } },
      take: 60,
    });

    if (category === 'active') {
      candidates = candidates.filter((c) => onlineIds.has(c.id));
    }

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

    let suggested = candidates.map((c) => {
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
        online: onlineIds.has(c.id),
        lastActiveLabel: lastActiveLabel(c.lastSeenAt, onlineIds.has(c.id)),
        // Grup C: profil boost - aktifse önerilen kişiler listesinde öne alınır.
        isBoosted: isBoostActive(c),
      };
    });

    if (category === 'popular') {
      suggested.sort((a, b) => b.followerCount - a.followerCount);
    } else if (category === 'active') {
      // zaten çevrimiçi olanlarla filtrelendi, en yeni aktiflik önce
      suggested.sort((a, b) => (b.online === a.online ? 0 : b.online ? 1 : -1));
    } else if (category === 'verified') {
      suggested = suggested.filter((s) => s.verified);
    } else {
      // Varsayılan: ortak arkadaş sayısına göre öne çıkar
      suggested.sort((a, b) => b.mutualCount - a.mutualCount);
    }
    // Kategoriden bağımsız olarak boost'lu profiller kendi sıralaması içinde en üste alınır
    // (ör. "popüler" kategorisinde de takipçi sırası korunur, sadece boost'lular öne geçer).
    suggested.sort((a, b) => Number(b.isBoosted) - Number(a.isBoosted));
    suggested = suggested.slice(0, 20);

    // ---------- Bugün Kampüste ----------
    const [newUsersToday, newPostsToday, newClubsToday, newEventsToday] = await Promise.all([
      prisma.user.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
      prisma.post.count({
        where: { author: { universityId: me.universityId }, createdAt: { gte: startOfToday } },
      }),
      prisma.club.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
      prisma.event.count({
        where: { club: { universityId: me.universityId }, createdAt: { gte: startOfToday } },
      }),
    ]);

    // ---------- Popüler Üniversiteler ----------
    const universities = await prisma.university.findMany({
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
    const popularUniversities = universities
      .map((u) => ({ id: u.id, name: u.name, activeStudents: u._count.users }))
      .sort((a, b) => b.activeStudents - a.activeStudents)
      .slice(0, 8);

    // ---------- Aktif Kullanıcılar (çevrimiçi, kendi üniversitemden) ----------
    const onlineUsers = await prisma.user.findMany({
      where: { id: { in: [...onlineIds].filter((id) => id !== req.userId) }, universityId: me.universityId },
      select: { id: true, fullName: true, photoUrl: true },
      take: 20,
    });

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

    // ---------- Günün Önerisi ----------
    const sameDepartmentToday = me.department
      ? await prisma.user.count({
          where: {
            universityId: me.universityId,
            department: me.department,
            id: { not: req.userId },
            createdAt: { gte: startOfToday },
          },
        })
      : 0;

    // ---------- Diğer Üniversiteler (Premium) ----------
    // Ücretsiz kullanıcılar için: sadece kilitli bir önizleme (kaç kişi olduğu +
    // hangi üniversitelerden olduğu) gösterilir, profil bilgisi verilmez.
    // Premium kullanıcılar için: gerçek, tıklanabilir kart listesi döner.
    const premium = isPremiumActive(me);
    const otherUniWhere = {
      universityId: { not: me.universityId },
      id: { notIn: excludeIds },
      verificationStatus: { in: ['auto_verified', 'verified'] },
      isFrozen: false,
    };

    let otherUniversities;
    if (premium) {
      const otherCandidates = await prisma.user.findMany({
        where: otherUniWhere,
        select: { ...CARD_SELECT, _count: { select: { followers: true } } },
        take: 24,
        orderBy: { createdAt: 'desc' },
      });
      otherUniversities = {
        locked: false,
        users: otherCandidates.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          photoUrl: c.photoUrl,
          department: c.department,
          classYear: c.classYear,
          university: c.university,
          verified: isVerified(c),
          followerCount: c._count.followers,
          online: onlineIds.has(c.id),
          lastActiveLabel: lastActiveLabel(c.lastSeenAt, onlineIds.has(c.id)),
        })),
      };
    } else {
      const [lockedCount, byUniversity] = await Promise.all([
        prisma.user.count({ where: otherUniWhere }),
        prisma.user.groupBy({ by: ['universityId'], where: otherUniWhere, _count: true, orderBy: { _count: { universityId: 'desc' } }, take: 5 }),
      ]);
      const uniNames = await prisma.university.findMany({
        where: { id: { in: byUniversity.map((b) => b.universityId) } },
        select: { id: true, name: true },
      });
      const nameById = new Map(uniNames.map((u) => [u.id, u.name]));
      otherUniversities = {
        locked: true,
        lockedCount,
        universityBreakdown: byUniversity.map((b) => ({
          universityId: b.universityId,
          name: nameById.get(b.universityId) || '',
          count: b._count,
        })),
      };
    }

    res.json({
      suggestedUsers: suggested,
      stats: {
        newUsersToday,
        newPostsToday,
        newClubsToday,
        newEventsToday,
      },
      popularUniversities,
      onlineUsers,
      trendingClubs,
      recentPosts,
      otherUniversities,
      isPremium: premium,
      dailyTip: {
        department: me.department || null,
        newInDepartmentToday: sameDepartmentToday,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Keşfet verileri alınamadı.' });
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
      id: { notIn: excludeIds },
      isFrozen: false,
      verificationStatus: { in: ['auto_verified', 'verified'] },
      OR: [
        { fullName: { contains: q } },
        { department: { contains: q } },
        { university: { name: { contains: q } } },
      ],
    };
    // Ücretsiz kullanıcı: sonuçlar kendi üniversitesiyle sınırlı, diğer
    // üniversitelerden kaç eşleşme olduğu ise kilitli bir sayı olarak dönüyor
    // (Premium'a geçiş için bir teşvik/teaser niteliğinde).
    const scopedWhere = premium ? baseWhere : { ...baseWhere, universityId: me.universityId };

    const [users, lockedCount] = await Promise.all([
      prisma.user.findMany({
        where: scopedWhere,
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          department: true,
          verificationStatus: true,
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
      lockedCount,
      isPremium: premium,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Arama yapılamadı.' });
  }
});

module.exports = router;
