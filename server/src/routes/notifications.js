// Bildirim Merkezi: takip, mesaj, eşleşme, kulüp katılımı ve profil görüntüleme
// bildirimlerini listeleme / okundu işaretleme.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const ACTOR_SELECT = { id: true, fullName: true, photoUrl: true };

// GET /api/notifications — en yeni bildirimler önce
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: ACTOR_SELECT } },
    });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bildirimler alınamadı.' });
  }
});

// GET /api/notifications/unread-count — bildirim ikonundaki rozet için
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.userId, isRead: false },
    });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sayı alınamadı.' });
  }
});

// PUT /api/notifications/read-all — tümünü okundu yap
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Güncellenemedi.' });
  }
});

// PUT /api/notifications/:id/read — tek bir bildirimi okundu yap
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: Number(req.params.id) } });
    if (!notif || notif.userId !== req.userId) {
      return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    }
    const updated = await prisma.notification.update({
      where: { id: notif.id },
      data: { isRead: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Güncellenemedi.' });
  }
});

// DELETE /api/notifications/:id — bildirimi listeden kaldır
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notif = await prisma.notification.findUnique({ where: { id: Number(req.params.id) } });
    if (!notif || notif.userId !== req.userId) {
      return res.status(404).json({ error: 'Bildirim bulunamadı.' });
    }
    await prisma.notification.delete({ where: { id: notif.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bildirim silinemedi.' });
  }
});

module.exports = router;
