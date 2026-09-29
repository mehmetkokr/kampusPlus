// Grup C — Ek gelir kanalları
// Kulüp/etkinlik öne çıkarma + Profil boost + Öncelikli doğrulama.
// Hepsi aynı mock ödeme altyapısını (PaymentLog) paylaşır - bkz. lib/monetization.js.
// NOT: routes/premium.js'teki gibi gerçek bir ödeme sağlayıcısı bağlanana kadar
// /purchase uçları ödemeyi anında "başarılı" sayan bir simülasyondur.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { MONETIZATION_PLANS, extendUntil } = require('../lib/monetization');

const router = express.Router();

router.get('/plans', requireAuth, async (req, res) => {
  res.json(Object.entries(MONETIZATION_PLANS).map(([key, p]) => ({ key, ...p })));
});

// ---------------------------------------------------------
// POST /api/monetization/clubs/:id/highlight — kulübü öne çıkar (yalnızca owner/admin)
// ---------------------------------------------------------
router.post('/clubs/:id/highlight', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const { planKey = 'club_highlight_7d' } = req.body;
    const plan = MONETIZATION_PLANS[planKey];
    if (!plan || plan.kind !== 'club_highlight') {
      return res.status(400).json({ error: 'Geçersiz plan.' });
    }

    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId, userId: req.userId } },
    });
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Yalnızca kulüp kurucusu veya yöneticisi kulübü öne çıkarabilir.' });
    }

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club) return res.status(404).json({ error: 'Kulüp bulunamadı.' });

    const highlightedUntil = extendUntil(club.highlightedUntil, plan.days);

    const [updated] = await prisma.$transaction([
      prisma.club.update({ where: { id: clubId }, data: { highlightedUntil } }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan: planKey, amount: plan.amount, provider: 'mock', status: 'success' },
      }),
    ]);

    res.json({ highlightedUntil: updated.highlightedUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüp öne çıkarılamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/monetization/events/:id/highlight — etkinliği öne çıkar (yalnızca oluşturan/kulüp yöneticisi)
// ---------------------------------------------------------
router.post('/events/:id/highlight', requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.id);
    const { planKey = 'event_highlight_3d' } = req.body;
    const plan = MONETIZATION_PLANS[planKey];
    if (!plan || plan.kind !== 'event_highlight') {
      return res.status(400).json({ error: 'Geçersiz plan.' });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: event.clubId, userId: req.userId } },
    });
    const canHighlight =
      event.creatorId === req.userId || (membership && (membership.role === 'owner' || membership.role === 'admin'));
    if (!canHighlight) {
      return res.status(403).json({ error: 'Bu etkinliği öne çıkaramazsın.' });
    }

    const highlightedUntil = extendUntil(event.highlightedUntil, plan.days);

    const [updated] = await prisma.$transaction([
      prisma.event.update({ where: { id: eventId }, data: { highlightedUntil } }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan: planKey, amount: plan.amount, provider: 'mock', status: 'success' },
      }),
    ]);

    res.json({ highlightedUntil: updated.highlightedUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkinlik öne çıkarılamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/monetization/profile/boost — kendi profilini boost'la
// ---------------------------------------------------------
router.post('/profile/boost', requireAuth, async (req, res) => {
  try {
    const { planKey = 'profile_boost_24h' } = req.body;
    const plan = MONETIZATION_PLANS[planKey];
    if (!plan || plan.kind !== 'profile_boost') {
      return res.status(400).json({ error: 'Geçersiz plan.' });
    }

    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { boostedUntil: true } });
    const boostedUntil = extendUntil(me.boostedUntil, plan.days);

    const [updated] = await prisma.$transaction([
      prisma.user.update({ where: { id: req.userId }, data: { boostedUntil }, select: { boostedUntil: true } }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan: planKey, amount: plan.amount, provider: 'mock', status: 'success' },
      }),
    ]);

    res.json({ boostedUntil: updated.boostedUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Profil boost başlatılamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/monetization/verification/priority — öncelikli doğrulama satın al
// Yalnızca manuel incelemeyi bekleyen (manual_review) kullanıcılar satın alabilir;
// hesap zaten doğrulanmışsa veya reddedilmişse anlamsızdır.
// ---------------------------------------------------------
router.post('/verification/priority', requireAuth, async (req, res) => {
  try {
    const plan = MONETIZATION_PLANS.priority_verification;

    const me = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { verificationStatus: true, verificationPriority: true },
    });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (me.verificationStatus !== 'manual_review') {
      return res.status(400).json({ error: 'Öncelikli doğrulama sadece manuel inceleme bekleyen hesaplar için satın alınabilir.' });
    }
    if (me.verificationPriority) {
      return res.status(409).json({ error: 'Zaten öncelikli doğrulama kuyruğundasın.' });
    }

    const [updated] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: { verificationPriority: true, verificationPriorityAt: new Date() },
        select: { verificationPriority: true, verificationPriorityAt: true },
      }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan: 'priority_verification', amount: plan.amount, provider: 'mock', status: 'success' },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Öncelikli doğrulama başlatılamadı.' });
  }
});

module.exports = router;
