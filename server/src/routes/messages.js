// Mesaj geçmişi - metin gönderimi socket.js üzerinden yapılır.
// Fotoğraf/ses/dosya ekleri ise burada REST ile yüklenip socket ile yayınlanır.
const express = require('express');
const fs = require('fs');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyUpload } = require('../lib/fileValidation');
const { MESSAGE_INCLUDE, REACTIONS, announceMessage, previewOf } = require('../lib/chat');
const { isBlockedEitherWay } = require('../lib/block');
const { PRIVATE_UPLOADS } = require('../lib/paths');
const { canUnsend } = require('../lib/unsend');
const path = require('path');

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
      include: MESSAGE_INCLUDE,
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
    req.app.get('io')?.to(`user_${req.userId}`).emit('chat_read', { matchId });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesajlar güncellenemedi.' });
  }
});

// Fotoğraf/ses/dosya ekli mesaj: erişim ve engel kontrolü, kayıt ve duyuru ortak
function attachmentRoute(field, kind, { missing, failed, data }) {
  return [
    requireAuth,
    chatUpload.private.single(field),
    verifyUpload(kind),
    async (req, res) => {
      try {
        const matchId = Number(req.params.matchId);
        const match = await assertMatchAccess(matchId, req.userId);
        if (!match) {
          if (req.file) fs.unlink(req.file.path, () => {});
          return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });
        }
        if (!req.file) return res.status(400).json({ error: missing });
        if (!(await assertNotBlocked(match, req.userId))) {
          fs.unlink(req.file.path, () => {});
          return res.status(403).json({ error: 'Bu kullanıcıyla artık mesajlaşamazsınız.' });
        }

        const message = await prisma.message.create({
          data: { matchId, senderId: req.userId, ...data(req.file) },
          include: MESSAGE_INCLUDE,
        });
        await announceMessage(req.app.get('io'), match, message);
        res.status(201).json(message);
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: failed });
      }
    },
  ];
}

// POST /api/messages/:matchId/photo — sohbete fotoğraf gönder
router.post(
  '/:matchId/photo',
  ...attachmentRoute('photo', 'chatPhoto', {
    missing: 'Fotoğraf gerekli.',
    failed: 'Fotoğraf gönderilemedi.',
    data: (file) => ({ photoUrl: `/api/files/${file.filename}` }),
  })
);

// POST /api/messages/:matchId/audio — sesli mesaj gönder
router.post(
  '/:matchId/audio',
  ...attachmentRoute('audio', 'audio', {
    missing: 'Ses kaydı gerekli.',
    failed: 'Sesli mesaj gönderilemedi.',
    data: (file) => ({ audioUrl: `/api/files/${file.filename}` }),
  })
);

// POST /api/messages/:matchId/file — dosya gönder
router.post(
  '/:matchId/file',
  ...attachmentRoute('file', 'chatFile', {
    missing: 'Dosya gerekli.',
    failed: 'Dosya gönderilemedi.',
    data: (file) => ({ fileUrl: `/api/files/${file.filename}`, fileName: file.originalname.slice(0, 200) }),
  })
);

// POST /api/messages/:matchId/:messageId/reactions — { emoji } tepki bırak.
// Aynı emoji tekrar gönderilirse tepki kaldırılır; farklıysa değiştirilir.
router.post('/:matchId/:messageId/reactions', requireAuth, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const messageId = Number(req.params.messageId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });
    const emoji = String(req.body?.emoji || '');
    if (!REACTIONS.includes(emoji)) return res.status(400).json({ error: 'Geçersiz tepki.' });
    const message = await prisma.message.findUnique({ where: { id: messageId }, select: { matchId: true } });
    if (!message || message.matchId !== matchId) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    if (!(await assertNotBlocked(match, req.userId))) return res.status(403).json({ error: 'Bu kullanıcıyla artık mesajlaşamazsınız.' });

    const key = { messageId_userId: { messageId, userId: req.userId } };
    const existing = await prisma.messageReaction.findUnique({ where: key });
    if (existing && existing.emoji === emoji) await prisma.messageReaction.delete({ where: key });
    else await prisma.messageReaction.upsert({ where: key, create: { messageId, userId: req.userId, emoji }, update: { emoji } });

    const reactions = await prisma.messageReaction.findMany({ where: { messageId }, select: { userId: true, emoji: true } });
    req.app.get('io')?.to(`match_${matchId}`).emit('message_reaction', { matchId, messageId, reactions });
    res.json({ reactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tepki kaydedilemedi.' });
  }
});

// DELETE /api/messages/:matchId/:messageId — kendi mesajını gönderdikten sonraki
// 1 dakika içinde geri al. Mesaj iki taraftan da kalkar, eki de silinir.
router.delete('/:matchId/:messageId', requireAuth, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const messageId = Number(req.params.messageId);
    const match = await assertMatchAccess(matchId, req.userId);
    if (!match) return res.status(403).json({ error: 'Bu sohbete erişim yetkiniz yok.' });

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message || message.matchId !== matchId) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    if (message.senderId !== req.userId) return res.status(403).json({ error: 'Yalnızca kendi mesajını silebilirsin.' });
    if (!canUnsend(message.createdAt)) {
      return res.status(400).json({ error: 'Mesajlar yalnızca gönderildikten sonraki 1 dakika içinde silinebilir.' });
    }

    await prisma.message.delete({ where: { id: messageId } });
    for (const url of [message.photoUrl, message.audioUrl, message.fileUrl]) {
      if (url?.startsWith('/api/files/')) {
        fs.unlink(path.join(PRIVATE_UPLOADS, path.basename(url)), () => {});
      }
    }
    const io = req.app.get('io');
    io?.to(`match_${matchId}`).emit('message_deleted', { matchId, messageId });
    // Sohbet listesindeki önizleme bir önceki mesaja döner
    const last = await prisma.message.findFirst({ where: { matchId }, orderBy: { createdAt: 'desc' } });
    io?.to(`user_${match.userAId}`).to(`user_${match.userBId}`).emit('chat_activity', {
      matchId,
      lastMessage: last ? { id: last.id, senderId: last.senderId, preview: previewOf(last), createdAt: last.createdAt } : null,
      removedId: messageId,
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesaj silinemedi.' });
  }
});

module.exports = router;
