// Öğrencilere gösterilen duyuru bandı (admin panelindeki kampanyalardan).
// Yalnızca süresi dolmamış, "banner" kanalı seçilmiş ve kullanıcının hedef
// kitlesine uyan en yeni kampanya döner.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { userMatchesAudience } = require('../lib/audience');

const router = express.Router();

router.get('/active', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const [me, campaigns] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          universityId: true, classYear: true, intent: true, isPremium: true, premiumUntil: true,
          studentDocStatus: true, createdAt: true, photoUrl: true, interests: true,
          isBanned: true, isFrozen: true, isAdmin: true,
        },
      }),
      prisma.campaign.findMany({
        where: { bannerUntil: { gt: now }, channels: { contains: 'banner' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const match = campaigns.find((c) => userMatchesAudience(me, c.audience, now));
    res.json(match ? { id: match.id, title: match.title, body: match.body, link: match.link, until: match.bannerUntil } : null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Duyuru alınamadı.' });
  }
});

module.exports = router;
