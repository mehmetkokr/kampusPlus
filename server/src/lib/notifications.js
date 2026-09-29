// Bildirim Merkezi için ortak yardımcı fonksiyon.
// Farklı route'lardan (takip, mesaj, eşleşme, kulüp, profil görüntüleme) ve
// socket.js'ten çağrılır, böylece bildirim oluşturma mantığı tek yerde durur.
const prisma = require('./prisma');

// Bazı bildirim türleri kullanıcının Ayarlar sayfasındaki tercihine bağlıdır.
const TYPE_PREFERENCE_FIELD = {
  match: 'notifyMatches',
  message: 'notifyMessages',
  like: 'notifyPostActivity',
  comment: 'notifyPostActivity',
  comment_like: 'notifyPostActivity',
};

const ACTOR_SELECT = { id: true, fullName: true, photoUrl: true };

/**
 * @param {import('socket.io').Server | null} io - varsa gerçek zamanlı yayın için
 * @param {{ userId: number, type: string, actorId?: number|null, targetType?: string|null, targetId?: number|null }} params
 */
async function createNotification(io, { userId, type, actorId = null, targetType = null, targetId = null, message = null }) {
  try {
    if (!userId) return null;
    if (actorId && Number(actorId) === Number(userId)) return null; // kendine bildirim gitmesin

    const prefField = TYPE_PREFERENCE_FIELD[type];
    if (prefField) {
      const recipient = await prisma.user.findUnique({ where: { id: userId }, select: { [prefField]: true } });
      if (recipient && recipient[prefField] === false) return null;
    }

    const notification = await prisma.notification.create({
      data: { userId, type, actorId, targetType, targetId, message },
      include: { actor: { select: ACTOR_SELECT } },
    });

    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }

    return notification;
  } catch (err) {
    console.error('Bildirim oluşturulamadı:', err);
    return null;
  }
}

module.exports = { createNotification };
