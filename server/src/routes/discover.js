// Yeni "Keşfet" sayfası: swipe/eşleşme mekaniğinden farklı olarak sosyal bir
// akış (Instagram'ın "Keşfet" sekmesine benzer). Performans için tüm bölümler
// tek bir istekte (/home) toplanır, ayrıca ayrı bir arama endpoint'i vardır.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { getOnlineUserIds } = require('../socket');
const { isPremiumActive, isBoosting, incognitoVisibleTo } = require('../lib/premium');
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

    const blockedIds = new Set([...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)]);

    // Birbirinden bağımsız bölümler aynı anda hazırlanır (sırayla beklemek
    // yük altında ana sayfayı yavaşlatıyordu; bkz. npm run load-test)
    const [suggested, [newUsersToday, newPostsToday, newClubsToday], onlineUsers, [swipeCount, myClubCount], trendingClubs, recentPosts] = await Promise.all([
      (async () => {
        // ---------- Önerilen Kişiler ----------
        const visibleWhere = discoverableUserWhere(me.universityId);
        const candidateWhere = {
          ...visibleWhere,
          universityId: me.universityId,
          id: { notIn: excludeIds },
          verificationStatus: { in: ['auto_verified', 'verified'] },
          // gizli moddakiler yalnızca beğendiklerine görünür; yıllık doğrulama koşulu korunur
          AND: [...(visibleWhere.AND || []), incognitoVisibleTo(me.id)],
        };
        if (department) candidateWhere.department = department;
        if (classYear) candidateWhere.classYear = Number(classYear);

        // Boost'taki profiller önce alınır (60 kişilik sınıra takılmasınlar) ve
        // listenin başında gösterilir
        const suggestSelect = { ...CARD_SELECT, interests: true, hobbies: true, boostUntil: true, _count: { select: { followers: true } } };
        const boostedNow = await prisma.user.findMany({
          where: { ...candidateWhere, boostUntil: { gt: new Date() } },
          select: suggestSelect,
          orderBy: { boostUntil: 'desc' },
          take: 10,
        });
        const candidates = [
          ...boostedNow,
          ...(await prisma.user.findMany({
            where: { ...candidateWhere, id: { notIn: [...excludeIds, ...boostedNow.map((b) => b.id)] } },
            select: suggestSelect,
            take: 60,
          })),
        ];

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
            boosted: isBoosting(c),
            online: sharesActivity(c) && onlineIds.has(c.id),
            lastActiveLabel: sharesActivity(c) ? lastActiveLabel(c.lastSeenAt, onlineIds.has(c.id)) : null,
          };
        });
        // Ortak arkadaş, sonra ortak ilgi alanı sayısına göre öne çıkar
        suggested.sort((a, b) => Number(b.boosted) - Number(a.boosted) || b.mutualCount - a.mutualCount || b.commonTags.length - a.commonTags.length);
        // Kimin boost satın aldığı başkalarına açıklanmaz: işaret yalnızca sıralamada kullanılır
        suggested = suggested.slice(0, 20).map(({ boosted: _boosted, ...rest }) => rest);
        return suggested;
      })(),
      (async () => {
        // ---------- Bugün Kampüste ----------
        const [newUsersToday, newPostsToday, newClubsToday] = await Promise.all([
          prisma.user.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
          prisma.post.count({
            where: { author: { universityId: me.universityId }, createdAt: { gte: startOfToday } },
          }),
          prisma.club.count({ where: { universityId: me.universityId, createdAt: { gte: startOfToday } } }),
        ]);
        return [newUsersToday, newPostsToday, newClubsToday];
      })(),
      (async () => {
        // ---------- Şu an aktif (çevrimiçi, kendi üniversitemden) ----------
        // Takip ettiklerim de dahil (önerilerden farklı olarak); yalnızca ben ve
        // engelleşilen kişiler hariç.
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
        return onlineUsers;
      })(),
      (async () => {
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
        return [swipeCount, myClubCount];
      })(),
      (async () => {
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
        return trendingClubs;
      })(),
      (async () => {
        // ---------- Son Paylaşımlar (kendi üniversitemden, herkese açık akış) ----------
        const recentPostsRaw = await prisma.post.findMany({
          where: {
            visibility: 'campus',
            // Dondurulmuş ya da askıya alınmış hesapların gönderileri görünmez
            author: { universityId: me.universityId, isFrozen: false, isBanned: false, id: { notIn: [...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)] } },
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
        return recentPosts;
      })(),
    ]);

    res.json({
      suggestedUsers: suggested,
      stats: {
        newUsersToday,
        newPostsToday,
        newClubsToday,
      },
      onlineUsers,
      quick: { swipeCount, myClubCount },
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
// GET /api/discover/search?q=... — kullanıcı, üniversite veya bölüm adına göre ara
// ---------------------------------------------------------
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
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
        incognitoVisibleTo(req.userId),
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
