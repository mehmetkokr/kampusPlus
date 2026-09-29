// Üniversite listesini döndürür - kayıt formunda seçim için kullanılır
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { isPremiumActive } = require('../lib/premium');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const universities = await prisma.university.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    res.json(universities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Üniversiteler alınamadı.' });
  }
});

// GET /api/universities/:id/students — bir üniversitenin doğrulanmış öğrencileri
// (Keşfet sayfasındaki "Popüler Üniversiteler" kartına tıklayınca açılır)
router.get('/:id/students', requireAuth, async (req, res) => {
  try {
    const universityId = Number(req.params.id);

    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { universityId: true, isPremium: true, premiumUntil: true },
    });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    // Kendi üniversiten her zaman açık; başka bir üniversite için Premium gerekir.
    if (universityId !== me.universityId && !isPremiumActive(me)) {
      const university = await prisma.university.findUnique({ where: { id: universityId }, select: { id: true, name: true } });
      if (!university) return res.status(404).json({ error: 'Üniversite bulunamadı.' });
      const lockedCount = await prisma.user.count({
        where: { universityId, isFrozen: false, verificationStatus: { in: ['auto_verified', 'verified'] } },
      });
      return res.status(403).json({
        error: 'premium_required',
        message: `${university.name} öğrencilerini görmek için Premium üyelik gerekiyor.`,
        university,
        lockedCount,
      });
    }

    const [blockedByMe, blockingMe] = await Promise.all([
      prisma.block.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: req.userId }, select: { blockerId: true } }),
    ]);
    const excludeIds = [req.userId, ...blockedByMe.map((b) => b.blockedId), ...blockingMe.map((b) => b.blockerId)];

    const [university, students] = await Promise.all([
      prisma.university.findUnique({ where: { id: universityId }, select: { id: true, name: true } }),
      prisma.user.findMany({
        where: {
          universityId,
          id: { notIn: excludeIds },
          isFrozen: false,
          verificationStatus: { in: ['auto_verified', 'verified'] },
        },
        select: {
          id: true,
          fullName: true,
          photoUrl: true,
          department: true,
          classYear: true,
          _count: { select: { followers: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);

    if (!university) return res.status(404).json({ error: 'Üniversite bulunamadı.' });

    res.json({
      university,
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        photoUrl: s.photoUrl,
        department: s.department,
        classYear: s.classYear,
        followerCount: s._count.followers,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Öğrenciler alınamadı.' });
  }
});

module.exports = router;
