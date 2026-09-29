// Premium üyelik uçları.
// NOT: Gerçek ödeme sağlayıcısı (Türkiye pazarı için önerilen: iyzico) henüz
// bağlı değil. /activate ucu şimdilik "mock" bir ödeme başarı akışı simüle
// eder ki frontend akışı ve premium erişim mantığı uçtan uca test edilebilsin.
// İleride burada yapılacaklar:
//   1) iyzico Checkout Form / Subscription API ile ödeme başlat
//   2) Sağlayıcının webhook'unu dinleyen ayrı bir uç ekle (imza doğrulaması ile)
//   3) Webhook başarılı dönünce burada yapılan isPremium/premiumUntil güncellemesini uygula
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { isPremiumActive } = require('../lib/premium');

const router = express.Router();

const PLANS = {
  monthly: { days: 30, amount: 49.9, label: 'Aylık' },
  yearly: { days: 365, amount: 399.9, label: 'Yıllık' },
};

router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isPremium: true, premiumUntil: true, premiumSince: true },
    });
    res.json({
      isPremium: isPremiumActive(user),
      premiumUntil: user.premiumUntil,
      premiumSince: user.premiumSince,
      plans: Object.entries(PLANS).map(([key, p]) => ({ key, ...p })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Premium durumu alınamadı.' });
  }
});

// Ödeme sağlayıcısı bağlanana kadar geçici "satın alma" ucu.
router.post('/activate', requireAuth, async (req, res) => {
  try {
    const { plan = 'monthly' } = req.body;
    const planInfo = PLANS[plan];
    if (!planInfo) return res.status(400).json({ error: 'Geçersiz plan.' });

    const current = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isPremium: true, premiumUntil: true, premiumSince: true },
    });

    // Zaten aktif premium süresi varsa üzerine ekle (yenileme), yoksa bugünden başlat.
    const base = isPremiumActive(current) && current.premiumUntil ? new Date(current.premiumUntil) : new Date();
    const newUntil = new Date(base.getTime() + planInfo.days * 24 * 60 * 60 * 1000);

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: {
          isPremium: true,
          premiumUntil: newUntil,
          premiumSince: current.premiumSince || new Date(),
        },
        select: { isPremium: true, premiumUntil: true, premiumSince: true },
      }),
      prisma.paymentLog.create({
        data: { userId: req.userId, plan, amount: planInfo.amount, provider: 'mock', status: 'success' },
      }),
    ]);

    res.json({ isPremium: true, premiumUntil: user.premiumUntil, premiumSince: user.premiumSince });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Premium etkinleştirilemedi.' });
  }
});

// Otomatik yenilemeyi kapatma anlamına gelir; süre dolana kadar erişim devam eder.
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.userId }, data: { isPremium: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İptal edilemedi.' });
  }
});

module.exports = router;
