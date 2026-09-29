// Mesaj geçmişi - metin gönderimi socket.js üzerinden yapılır.
// Fotoğraf/ses/dosya ekleri ise burada REST ile yüklenip socket ile yayınlanır.
const express = require('express');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { createNotification } = require('../lib/notifications');
const { isBlockedEitherWay } = require('../lib/block');

const router = express.Router();

async function assertMatchAccess(matchId, userId) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || (match.userAId !== userId && match.userBId !== userId)) {
    return null;
  }
  return match;
}

// Fotoğraf/ses/dosya gönderiminden önce çağrılır: taraflardan biri diğerini
// engellemişse eşleşme hâlâ var olsa bile yeni içerik gönderilemez.
async function assertNotBlocked(match, userId) {
  const otherPartyId = match.userAId === userId ? match.userBId : match.userAId;
  return !(await isBlockedEitherWay(userId, otherPartyId));
}

// GET /api/messages/:matchId?limit=50&before=<mesajId>
// Sayfalama: parametresiz istek en güncel `limit` mesajı döner (varsayılan 50,
// üst sınır 100). Daha eski mesajları yüklemek için `before` parametresine o
// ana kadar yüklenmiş en eski mesajın id'si verilir - bu sayede sohbet
// geçmişi büyüdükçe tek seferde tüm tabloyu çekmek zorunda kalınmaz.
router.get('/:matchId', requireAuth, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = req.query.before ? Number(req.query.before) : null;

    const messages = await prisma.message.findMany({
      where: { matchId, ...(before ? { id: { lt: before } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: { id: true, fullName: true } } },
    });

    // En eski mesajın en üstte görünmesi için tekrar kronolojik sıraya çeviriyoruz.
    messages.reverse();

    res.json({ messages, hasMore: messages.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesajlar alınamadı.' });
  }
});

// PUT /api/messages/:matchId/read — karşı tarafın mesajlarını "görüldü" yap
router.put('/:matchId/read', requireAuth, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });

    await prisma.message.updateMany({
      where: { matchId, senderId: { not: req.userId }, isRead: false },
      data: { isRead: true },
    });

    req.app.get('io')?.to(`match_${matchId}`).emit('messages_read', { matchId, readerId: req.userId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesajlar güncellenemedi.' });
  }
});

// POST /api/messages/:matchId/photo — sohbete fotoğraf gönder
router.post('/:matchId/photo', requireAuth, chatUpload.private.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });
    if (!req.file) return res.status(400).json({ error: 'Fotoğraf gerekli.' });
    if (!(await assertNotBlocked(match, req.userId))) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Bu kullanıcıyla artık mesajlaşamazsınız.' });
    }

    const message = await prisma.message.create({
      data: { matchId, senderId: req.userId, photoUrl: `/api/files/${req.file.filename}` },
      include: { sender: { select: { id: true, fullName: true } } },
    });

    req.app.get('io')?.to(`match_${matchId}`).emit('new_message', message);
    await createNotification(req.app.get('io'), {
      userId: match.userAId === req.userId ? match.userBId : match.userAId,
      type: 'message',
      actorId: req.userId,
      targetType: 'match',
      targetId: matchId,
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf gönderilemedi.' });
  }
});

// POST /api/messages/:matchId/audio — sesli mesaj gönder
router.post('/:matchId/audio', requireAuth, chatUpload.private.single('audio'), verifyFileSignature, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });
    if (!req.file) return res.status(400).json({ error: 'Ses kaydı gerekli.' });
    if (!(await assertNotBlocked(match, req.userId))) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Bu kullanıcıyla artık mesajlaşamazsınız.' });
    }

    const message = await prisma.message.create({
      data: { matchId, senderId: req.userId, audioUrl: `/api/files/${req.file.filename}` },
      include: { sender: { select: { id: true, fullName: true } } },
    });

    req.app.get('io')?.to(`match_${matchId}`).emit('new_message', message);
    await createNotification(req.app.get('io'), {
      userId: match.userAId === req.userId ? match.userBId : match.userAId,
      type: 'message',
      actorId: req.userId,
      targetType: 'match',
      targetId: matchId,
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sesli mesaj gönderilemedi.' });
  }
});

// POST /api/messages/:matchId/file — dosya gönder
router.post('/:matchId/file', requireAuth, chatUpload.private.single('file'), verifyFileSignature, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });
    if (!req.file) return res.status(400).json({ error: 'Dosya gerekli.' });
    if (!(await assertNotBlocked(match, req.userId))) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Bu kullanıcıyla artık mesajlaşamazsınız.' });
    }

    const message = await prisma.message.create({
      data: {
        matchId,
        senderId: req.userId,
        fileUrl: `/api/files/${req.file.filename}`,
        fileName: req.file.originalname,
      },
      include: { sender: { select: { id: true, fullName: true } } },
    });

    req.app.get('io')?.to(`match_${matchId}`).emit('new_message', message);
    await createNotification(req.app.get('io'), {
      userId: match.userAId === req.userId ? match.userBId : match.userAId,
      type: 'message',
      actorId: req.userId,
      targetType: 'match',
      targetId: matchId,
    });
    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Dosya gönderilemedi.' });
  }
});

module.exports = router;
