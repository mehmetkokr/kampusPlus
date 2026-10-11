// Birebir sohbet mesajları için ortak parçalar: mesajla birlikte gönderilen
// alanlar (yanıtlanan mesaj, tepkiler), sohbet listesi önizlemesi ve yeni
// mesajın odaya, sohbet listesine ve bildirimlere duyurulması.
const prisma = require('./prisma');
const { createNotification } = require('./notifications');

const MESSAGE_INCLUDE = {
  sender: { select: { id: true, fullName: true } },
  replyTo: {
    select: { id: true, senderId: true, content: true, photoUrl: true, audioUrl: true, fileUrl: true, fileName: true, sender: { select: { fullName: true } } },
  },
  reactions: { select: { userId: true, emoji: true } },
};

// Sohbette kullanılabilecek tepkiler
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

// Sohbet listesinde ve bildirimde görünen kısa önizleme
function previewOf(message) {
  if (!message) return null;
  if (message.content) return message.content.length > 80 ? `${message.content.slice(0, 80)}…` : message.content;
  if (message.photoUrl) return '📷 Fotoğraf';
  if (message.audioUrl) return '🎤 Sesli mesaj';
  if (message.fileUrl) return `📎 ${message.fileName || 'Dosya'}`;
  return '';
}

const otherParty = (match, userId) => (match.userAId === userId ? match.userBId : match.userAId);

// Yeni mesajı sohbet odasına yayınlar, iki tarafın sohbet listesini günceller
// (sohbet ekranında olmasalar da) ve karşı tarafa bildirim oluşturur.
async function announceMessage(io, match, message) {
  if (io) {
    io.to(`match_${match.id}`).emit('new_message', message);
    const activity = {
      matchId: match.id,
      lastMessage: { id: message.id, senderId: message.senderId, preview: previewOf(message), createdAt: message.createdAt },
    };
    io.to(`user_${match.userAId}`).to(`user_${match.userBId}`).emit('chat_activity', activity);
  }
  await createNotification(io, {
    userId: otherParty(match, message.senderId),
    type: 'message',
    actorId: message.senderId,
    targetType: 'match',
    targetId: match.id,
  });
}

// Yanıtlanan mesaj aynı sohbete ait olmalı; değilse yok sayılır
async function validReplyTo(matchId, replyToId) {
  const id = Number(replyToId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const target = await prisma.message.findUnique({ where: { id }, select: { matchId: true } });
  return target && target.matchId === matchId ? id : null;
}

module.exports = { MESSAGE_INCLUDE, REACTIONS, previewOf, otherParty, announceMessage, validReplyTo };
