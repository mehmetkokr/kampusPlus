// Premium üyelik uçları.
// NOT: Gerçek ödeme sağlayıcısı (Türkiye pazarı için önerilen: iyzico) henüz
// bağlı değil. /activate ucu şimdilik "mock" bir ödeme başarı akışı simüle
// eder ki frontend akışı ve premium erişim mantığı uçtan uca test edilebilsin.
// Yayında bu uç kapalıdır (bkz. lib/premium.js -> mockPaymentsEnabled).
// İleride burada yapılacaklar:
//   1) iyzico Checkout Form / Subscription API ile ödeme başlat
//   2) Sağlayıcının webhook'unu dinleyen ayrı bir uç ekle (imza doğrulaması ile)
//   3) Webhook başarılı dönünce burada yapılan isPremium/premiumUntil güncellemesini uygula
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const {
  PLANS,
  PLAN_KEYS,
  FREE_DAILY_LIKES,
  BOOST_MINUTES,
  isPremiumActive,
  activePlan,
  likeQuota,
  superLikeQuota,
  isBoosting,
  mockPaymentsEnabled,
} = require('../lib/premium');

const router = express.Router();

const DAY = 24 * 60 * 60 * 1000;
const STATUS_SELECT = {
  id: true,
  isPremium: true,
  premiumUntil: true,
  premiumSince: true,
  premiumAutoRenew: true,
  premiumPlan: true,
  boostCredits: true,
  boostUntil: true,
  incognito: true,
};

const publicPlans = () => PLAN_KEYS.map((key) => ({ key, ...PLANS[key] }));

async function statusOf(user) {
  const [quota, superLikes] = await Promise.all([likeQuota(prisma, user), superLikeQuota(prisma, user)]);
  return {
    isPremium: isPremiumActive(user),
    plan: activePlan(user),
    premiumUntil: user.premiumUntil,
    premiumSince: user.premiumSince,
    premiumAutoRenew: user.premiumAutoRenew,
    likes: quota,
    superLikes,
    incognito: Boolean(user.incognito) && isPremiumActive(user),
    boostCredits: user.boostCredits,
    boostUntil: isBoosting(user) ? user.boostUntil : null,
    boostMinutes: BOOST_MINUTES,
    checkoutAvailable: mockPaymentsEnabled(),
    plans: publicPlans(),
    freeDailyLikes: FREE_DAILY_LIKES,
  };
}

// GET /api/premium/plans — herkese açık: tanıtım sayfasındaki fiyat kartları
// için planlar, ücretsiz hak ve satın almanın açık olup olmadığı (kişisel veri yok)
router.get('/plans', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    checkoutAvailable: mockPaymentsEnabled(),
    freeDailyLikes: FREE_DAILY_LIKES,
    boostMinutes: BOOST_MINUTES,
    plans: publicPlans(),
  });
});

router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: STATUS_SELECT });
    res.json(await statusOf(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Premium durumu alınamadı.' });
  }
});

// Ödeme sağlayıcısı bağlanana kadar geçici "satın alma" ucu.
// Mesafeli satış sözleşmesi ve cayma hakkı onayı olmadan satın alma yapılmaz.
router.post('/activate', requireAuth, async (req, res) => {
  try {
    if (!mockPaymentsEnabled()) {
      return res.status(503).json({ error: 'Ödeme sistemi henüz aktif değil. Premium çok yakında!', code: 'CHECKOUT_UNAVAILABLE' });
    }
    const { plan = 'monthly', consent } = req.body || {};
    const planInfo = PLANS[plan];
    if (!planInfo) return res.status(400).json({ error: 'Geçersiz plan.' });
    if (consent !== true) {
      return res.status(400).json({ error: 'Satın almak için Mesafeli Satış Sözleşmesi ve cayma hakkı bilgilendirmesini onaylamalısın.', code: 'CONSENT_REQUIRED' });
    }

    const current = await prisma.user.findUnique({ where: { id: req.userId }, select: STATUS_SELECT });

    // Zaten aktif premium süresi varsa üzerine ekle (yenileme), yoksa bugünden başlat.
    // Plan son satın alınan olur (günlük beğeni sınırını o belirler).
    const base = isPremiumActive(current) && current.premiumUntil ? new Date(current.premiumUntil) : new Date();
    const newUntil = new Date(base.getTime() + planInfo.days * DAY);
    const now = new Date();

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: {
          isPremium: true,
          premiumUntil: newUntil,
          premiumSince: current.premiumSince || now,
          premiumAutoRenew: true,
          premiumPlan: plan,
          boostCredits: { increment: planInfo.boosts },
        },
        select: STATUS_SELECT,
      }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan, amount: planInfo.amount, provider: 'mock', status: 'success', boostsGranted: planInfo.boosts, consentAt: now },
      }),
    ]);

    res.json(await statusOf(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Premium etkinleştirilemedi.' });
  }
});

// POST /api/premium/boost — bir boost hakkı kullanır: profil BOOST_MINUTES
// boyunca kampüsündeki öğrencilerin Kart Modu ve Keşfet listelerinde öne çıkar.
router.post('/boost', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { ...STATUS_SELECT, swipeEnabled: true, profileVisibility: true, isFrozen: true },
    });
    if (isBoosting(user)) return res.status(409).json({ error: 'Profilin zaten öne çıkarılıyor.', code: 'ALREADY_BOOSTING', boostUntil: user.boostUntil });
    if (user.boostCredits < 1) return res.status(402).json({ error: 'Boost hakkın kalmadı.', code: 'NO_BOOSTS' });
    // Görünmeyen profili öne çıkarmak hakkı boşa harcar
    if (!user.swipeEnabled || user.profileVisibility === 'nobody' || user.isFrozen) {
      return res.status(400).json({ error: "Boost için profilin görünür ve Kart Modu açık olmalı.", code: 'NOT_VISIBLE' });
    }

    // Aynı anda iki istek gelirse hak bir kez düşsün diye koşullu güncelleme
    const boostUntil = new Date(Date.now() + BOOST_MINUTES * 60 * 1000);
    const updated = await prisma.user.updateMany({
      where: { id: req.userId, boostCredits: { gte: 1 }, OR: [{ boostUntil: null }, { boostUntil: { lte: new Date() } }] },
      data: { boostCredits: { decrement: 1 }, boostUntil },
    });
    if (updated.count === 0) return res.status(409).json({ error: 'Boost başlatılamadı, tekrar dene.' });

    const fresh = await prisma.user.findUnique({ where: { id: req.userId }, select: STATUS_SELECT });
    res.json(await statusOf(fresh));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Boost başlatılamadı.' });
  }
});

// PUT /api/premium/incognito { enabled } — gizli mod (yalnızca Premium)
router.put('/incognito', requireAuth, async (req, res) => {
  try {
    const enabled = req.body?.enabled === true;
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: STATUS_SELECT });
    if (enabled && !isPremiumActive(user)) {
      return res.status(403).json({ error: 'Gizli mod Premium üyelere özel.', code: 'PREMIUM_REQUIRED' });
    }
    const updated = await prisma.user.update({ where: { id: req.userId }, data: { incognito: enabled }, select: STATUS_SELECT });
    res.json(await statusOf(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gizli mod değiştirilemedi.' });
  }
});

// Otomatik yenilemeyi kapatma anlamına gelir; süre dolana kadar erişim devam eder.
// isPremium'a dokunulmaz: premiumUntil geçince isPremiumActive kendiliğinden false döner.
// Süresiz (admin'in verdiği) premium yenilenen bir abonelik olmadığı için iptal edilemez.
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isPremium: true, premiumUntil: true },
    });
    if (!isPremiumActive(current)) return res.status(400).json({ error: 'Aktif bir premium üyeliğin yok.' });
    if (!current.premiumUntil) return res.status(400).json({ error: 'Süresiz premium üyeliğin otomatik yenilenmez.' });
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { premiumAutoRenew: false },
      select: { premiumUntil: true, premiumAutoRenew: true },
    });
    res.json({ ok: true, isPremium: true, premiumUntil: user.premiumUntil, premiumAutoRenew: user.premiumAutoRenew });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İptal edilemedi.' });
  }
});

module.exports = router;
