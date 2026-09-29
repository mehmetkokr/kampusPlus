// Gerçek zamanlı mesajlaşma mantığı.
// Her kullanıcı bağlandığında JWT token ile kimliğini doğrular,
// ardından eşleşme odalarına katılıp mesaj gönderebilir/alabilir.

const jwt = require('jsonwebtoken');
const prisma = require('./lib/prisma');
const { createNotification } = require('./lib/notifications');
const { isBlockedEitherWay } = require('./lib/block');

// O anda bağlı olan kullanıcıların id seti (çevrimiçi durumu için).
// Not: Tek sunucu instance'ı için yeterlidir; çoklu instance'da Redis gibi
// paylaşımlı bir yapıya taşınmalı.
const onlineUsers = new Set();

// Bir grup/kulüp sohbeti mesajını odadaki herkese değil, yalnızca gönderenle
// birbirini engellememiş üyelere iletir. Blok ilişkisi olan bir üye grubun
// içinde kalmaya devam eder (grup üyeliği bozulmaz) ama artık engellediği/
// engellendiği kişinin mesajlarını gerçek zamanlı olarak görmez.
async function broadcastToRoomExcludingBlocked(io, room, event, message, senderId) {
  const sockets = await io.in(room).fetchSockets();

  await Promise.all(
    sockets.map(async (s) => {
      if (!s.userId || s.userId === senderId) {
        s.emit(event, message);
        return;
      }
      const blocked = await isBlockedEitherWay(senderId, s.userId);
      if (!blocked) s.emit(event, message);
    })
  );
}

// Basit bellek-içi sabit pencereli rate limiter: bir kullanıcı kısa sürede
// çok fazla mesaj göndererek (spam/DoS) sohbeti veya veritabanını
// zorlayamasın diye REST rate limiter'ına ek olarak socket katmanında da
// bir sınır uygulanır. Tek sunucu instance'ı için yeterlidir; çoklu
// instance'a geçilirse Redis tabanlı bir çözüme taşınmalıdır.
const messageRateLimiter = new Map(); // userId -> { count, windowStart }
const MESSAGE_RATE_LIMIT = 20; // pencere başına izin verilen mesaj sayısı
const MESSAGE_RATE_WINDOW_MS = 10 * 1000; // 10 saniyelik pencere

function isRateLimited(userId) {
  const now = Date.now();
  const entry = messageRateLimiter.get(userId);
  if (!entry || now - entry.windowStart > MESSAGE_RATE_WINDOW_MS) {
    messageRateLimiter.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MESSAGE_RATE_LIMIT;
}

function isUserOnline(userId) {
  return onlineUsers.has(Number(userId));
}

function getOnlineUserIds() {
  return [...onlineUsers];
}

function setupSocket(io) {
  // Bağlantı kurulurken token doğrulama.
  // JWT imzası geçerli olsa bile, kullanıcı sonradan yasaklanmış olabilir
  // (token 7 gün geçerli kalır) — bu yüzden veritabanından da doğruluyoruz.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Token gerekli.'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, isBanned: true, tokenVersion: true },
      });

      if (!user || user.isBanned) {
        return next(new Error('Hesabınız askıya alınmış.'));
      }

      if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
        return next(new Error('Şifreniz değiştirildiği için oturumunuz sonlandı.'));
      }

      socket.userId = user.id;
      next();
    } catch (err) {
      next(new Error('Geçersiz token.'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Kullanıcı bağlandı: ${socket.userId}`);

    // Kullanıcıya özel oda: başka kullanıcıların "çevrimiçi mi?" sorgusu ve
    // presence yayınları için kullanılır.
    socket.join(`user_${socket.userId}`);
    onlineUsers.add(socket.userId);
    io.emit('presence_update', { userId: socket.userId, online: true });

    // Kullanıcı bir sohbet odasına katılır (her eşleşme = bir oda)
    socket.on('join_match', async (matchId) => {
      socket.join(`match_${matchId}`);

      // Karşı tarafa çevrimiçi/son görülme bilgisini bildir
      try {
        const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
        if (match) {
          const otherUserId = match.userAId === socket.userId ? match.userBId : match.userAId;
          const otherUser = await prisma.user.findUnique({
            where: { id: otherUserId },
            select: { lastSeenAt: true },
          });
          socket.emit('presence_state', {
            userId: otherUserId,
            online: isUserOnline(otherUserId),
            lastSeenAt: otherUser?.lastSeenAt || null,
          });
        }
      } catch (err) {
        console.error(err);
      }
    });

    // "Yazıyor..." göstergesi
    socket.on('typing', ({ matchId, isTyping }) => {
      socket.to(`match_${matchId}`).emit('typing', { matchId: Number(matchId), userId: socket.userId, isTyping: !!isTyping });
    });

    // Sohbet açıldığında karşı tarafın mesajlarını "görüldü" yap
    socket.on('mark_read', async ({ matchId }) => {
      try {
        const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
        if (!match || (match.userAId !== socket.userId && match.userBId !== socket.userId)) return;

        await prisma.message.updateMany({
          where: { matchId: Number(matchId), senderId: { not: socket.userId }, isRead: false },
          data: { isRead: true },
        });

        io.to(`match_${matchId}`).emit('messages_read', { matchId: Number(matchId), readerId: socket.userId });
      } catch (err) {
        console.error(err);
      }
    });

    // Mesaj gönderme
    socket.on('send_message', async ({ matchId, content }) => {
      try {
        if (!content || !content.trim()) return;
        if (isRateLimited(socket.userId)) {
          return socket.emit('error_message', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        }

        // Bu eşleşmenin gerçekten bu kullanıcıya ait olduğunu doğrula
        const match = await prisma.match.findUnique({ where: { id: Number(matchId) } });
        if (!match || (match.userAId !== socket.userId && match.userBId !== socket.userId)) {
          return socket.emit('error_message', 'Bu sohbete mesaj gönderme yetkiniz yok.');
        }

        // Taraflardan biri diğerini engellemişse mesajlaşma sürdürülemez.
        const otherPartyId = match.userAId === socket.userId ? match.userBId : match.userAId;
        if (await isBlockedEitherWay(socket.userId, otherPartyId)) {
          return socket.emit('error_message', 'Bu kullanıcıyla artık mesajlaşamazsınız.');
        }

        const message = await prisma.message.create({
          data: {
            matchId: Number(matchId),
            senderId: socket.userId,
            content: content.trim(),
          },
          include: { sender: { select: { id: true, fullName: true } } },
        });

        // Odadaki herkese (her iki taraf) yeni mesajı yayınla
        io.to(`match_${matchId}`).emit('new_message', message);

        // Karşı tarafa bildirim oluştur (sohbet penceresi kapalıysa Bildirim
        // Merkezi'nden görsün)
        const otherUserId = match.userAId === socket.userId ? match.userBId : match.userAId;
        await createNotification(io, {
          userId: otherUserId,
          type: 'message',
          actorId: socket.userId,
          targetType: 'match',
          targetId: match.id,
        });
      } catch (err) {
        console.error(err);
        socket.emit('error_message', 'Mesaj gönderilemedi.');
      }
    });

    // Kulüp grup sohbeti odasına katılır (yalnızca aktif üyeler)
    socket.on('join_club', async (clubId) => {
      const membership = await prisma.clubMembership.findUnique({
        where: { clubId_userId: { clubId: Number(clubId), userId: socket.userId } },
      });
      if (membership && membership.status === 'active') {
        socket.join(`club_${clubId}`);
      }
    });

    // Kulüp grup sohbetine metin mesajı gönderme
    socket.on('send_club_message', async ({ clubId, content }) => {
      try {
        if (!content || !content.trim()) return;
        if (isRateLimited(socket.userId)) {
          return socket.emit('error_message', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        }

        const membership = await prisma.clubMembership.findUnique({
          where: { clubId_userId: { clubId: Number(clubId), userId: socket.userId } },
        });
        if (!membership || membership.status !== 'active') {
          return socket.emit('error_message', 'Bu sohbete mesaj gönderme yetkiniz yok.');
        }

        const message = await prisma.clubMessage.create({
          data: {
            clubId: Number(clubId),
            senderId: socket.userId,
            content: content.trim(),
          },
          include: { sender: { select: { id: true, fullName: true, photoUrl: true } } },
        });

        await broadcastToRoomExcludingBlocked(io, `club_${clubId}`, 'new_club_message', message, socket.userId);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', 'Mesaj gönderilemedi.');
      }
    });

    // Genel grup sohbeti odasına katılır (yalnızca üyeler)
    socket.on('join_group', async (groupId) => {
      const membership = await prisma.groupChatMember.findUnique({
        where: { groupId_userId: { groupId: Number(groupId), userId: socket.userId } },
      });
      if (membership) socket.join(`group_${groupId}`);
    });

    // Genel grup sohbetine metin mesajı gönderme
    socket.on('send_group_message', async ({ groupId, content }) => {
      try {
        if (!content || !content.trim()) return;
        if (isRateLimited(socket.userId)) {
          return socket.emit('error_message', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        }

        const membership = await prisma.groupChatMember.findUnique({
          where: { groupId_userId: { groupId: Number(groupId), userId: socket.userId } },
        });
        if (!membership) {
          return socket.emit('error_message', 'Bu sohbete mesaj gönderme yetkiniz yok.');
        }

        const message = await prisma.groupMessage.create({
          data: {
            groupId: Number(groupId),
            senderId: socket.userId,
            content: content.trim(),
          },
          include: { sender: { select: { id: true, fullName: true, photoUrl: true } } },
        });

        await broadcastToRoomExcludingBlocked(io, `group_${groupId}`, 'new_group_message', message, socket.userId);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', 'Mesaj gönderilemedi.');
      }
    });

    // Ders/Bölüm arkadaşı grubu odasına katılır (yalnızca üyeler)
    socket.on('join_classmate_group', async (groupId) => {
      const membership = await prisma.classmateGroupMember.findUnique({
        where: { groupId_userId: { groupId: Number(groupId), userId: socket.userId } },
      });
      if (membership) socket.join(`classmate_group_${groupId}`);
    });

    // Ders/Bölüm arkadaşı grubuna metin mesajı gönderme
    socket.on('send_classmate_message', async ({ groupId, content }) => {
      try {
        if (!content || !content.trim()) return;
        if (isRateLimited(socket.userId)) {
          return socket.emit('error_message', 'Çok hızlı mesaj gönderiyorsun, biraz yavaşla.');
        }

        const membership = await prisma.classmateGroupMember.findUnique({
          where: { groupId_userId: { groupId: Number(groupId), userId: socket.userId } },
        });
        if (!membership) {
          return socket.emit('error_message', 'Bu sohbete mesaj gönderme yetkiniz yok.');
        }

        const group = await prisma.classmateGroup.findUnique({ where: { id: Number(groupId) }, select: { isArchived: true } });
        if (!group || group.isArchived) {
          return socket.emit('error_message', 'Bu dönem sona erdi, bu grup artık salt-okunur.');
        }

        const message = await prisma.classmateGroupMessage.create({
          data: {
            groupId: Number(groupId),
            senderId: socket.userId,
            content: content.trim(),
          },
          include: { sender: { select: { id: true, fullName: true, photoUrl: true } } },
        });

        await broadcastToRoomExcludingBlocked(io, `classmate_group_${groupId}`, 'new_classmate_message', message, socket.userId);
      } catch (err) {
        console.error(err);
        socket.emit('error_message', 'Mesaj gönderilemedi.');
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Kullanıcı ayrıldı: ${socket.userId}`);

      // Aynı kullanıcının başka bir sekmesi/cihazı hâlâ bağlıysa çevrimdışı sayma
      const stillConnected = [...io.sockets.sockets.values()].some(
        (s) => s.userId === socket.userId && s.id !== socket.id
      );
      if (stillConnected) return;

      onlineUsers.delete(socket.userId);
      try {
        const updated = await prisma.user.update({
          where: { id: socket.userId },
          data: { lastSeenAt: new Date() },
          select: { lastSeenAt: true },
        });
        io.emit('presence_update', { userId: socket.userId, online: false, lastSeenAt: updated.lastSeenAt });
      } catch (err) {
        console.error(err);
      }
    });
  });
}

module.exports = { setupSocket, getOnlineUserIds };
