// Anlık bildirim abonelikleri (Ayarlar > Anlık bildirimler)
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { publicKey, sendToUser } = require('../lib/push');
const { track } = require('../lib/analytics');

const router = express.Router();

// GET /api/push/key — tarayıcının abonelik için ihtiyaç duyduğu açık anahtar
router.get('/key', (req, res) => {
  try {
    res.json({ publicKey: publicKey() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anlık bildirim şu an kullanılamıyor.' });
  }
});

function parseSubscription(body) {
  const sub = body?.subscription || body;
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) return null;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, p256dh, auth };
}

// POST /api/push/subscribe — bu cihazı bildirim almaya kaydet
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const sub = parseSubscription(req.body);
    if (!sub) return res.status(400).json({ error: 'Geçersiz abonelik bilgisi.' });
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 300) || null;
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint: sub.endpoint } });
    // Aynı tarayıcı başka bir hesaba geçtiyse abonelik yeni hesaba taşınır
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { ...sub, userId: req.userId, userAgent },
      update: { ...sub, userId: req.userId, userAgent },
    });
    if (!existing || existing.userId !== req.userId) track('push_enabled', { userId: req.userId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anlık bildirimler açılamadı.' });
  }
});

// DELETE /api/push/subscribe — bu cihazın aboneliğini kaldır
router.delete('/subscribe', requireAuth, async (req, res) => {
  try {
    const endpoint = String(req.body?.endpoint || '');
    if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anlık bildirimler kapatılamadı.' });
  }
});

// POST /api/push/device { token, platform } — telefon uygulamasını (iOS/Android)
// bildirim almaya kaydet. Aynı telefonda başka hesaba geçilirse cihaz yeni hesaba taşınır.
router.post('/device', requireAuth, async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const platform = req.body?.platform;
    if (!token || token.length > 500 || !/^[\w:.-]+$/.test(token)) return res.status(400).json({ error: 'Geçersiz cihaz anahtarı.' });
    if (!['ios', 'android'].includes(platform)) return res.status(400).json({ error: 'Geçersiz platform.' });
    const existing = await prisma.pushDevice.findUnique({ where: { token } });
    await prisma.pushDevice.upsert({
      where: { token },
      create: { token, platform, userId: req.userId },
      update: { platform, userId: req.userId },
    });
    if (!existing || existing.userId !== req.userId) track('push_enabled', { userId: req.userId, props: { platform } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anlık bildirimler açılamadı.' });
  }
});

// DELETE /api/push/device { token } — bu telefonun kaydını kaldır (çıkış ya da kapatma)
router.delete('/device', requireAuth, async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    if (token) await prisma.pushDevice.deleteMany({ where: { token, userId: req.userId } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anlık bildirimler kapatılamadı.' });
  }
});

// POST /api/push/test — kendine deneme bildirimi
router.post('/test', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { language: true } });
    const en = user?.language === 'en';
    const sent = await sendToUser(req.userId, {
      title: 'kampüs+',
      body: en ? 'Notifications are working. See you on campus!' : 'Bildirimler çalışıyor. Kampüste görüşürüz!',
      url: '/settings',
      tag: 'push-test',
    });
    if (!sent) return res.status(404).json({ error: 'Bu hesaba kayıtlı bir cihaz bulunamadı.' });
    res.json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Deneme bildirimi gönderilemedi.' });
  }
});

module.exports = router;
