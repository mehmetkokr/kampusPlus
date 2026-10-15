// Beğenme ve eşleşme mantığı
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { isBlockedEitherWay, getBlockedUserIds } = require('../lib/block');
const { previewOf } = require('../lib/chat');
const { isPremiumActive, likeQuota } = require('../lib/premium');
const { reachCheck } = require('../lib/privacy');
const fs = require('fs');
const path = require('path');
const { PRIVATE_UPLOADS } = require('../lib/paths');

const { numericIdParams } = require('../lib/idParams');
const router = express.Router();

numericIdParams(router);
// Bir kullanıcıyı beğen. Karşı taraf da seni beğenmişse, eşleşme oluşur.
router.post('/like/:userId', requireAuth, async (req, res) => {
  try {
    const toUserId = Number(req.params.userId);
    const fromUserId = req.userId;

    if (toUserId === fromUserId) {
      return res.status(400).json({ error: 'Kendinizi beğenemezsiniz.' });
    }
    if (await isBlockedEitherWay(fromUserId, toUserId)) {
      return res.status(403).json({ error: 'Bu kullanıcıyla etkileşime giremezsin.' });
    }
    // Kart Modu kapalıysa (beğenen ya da beğenilen) beğeni gönderilemez
    const REACH_SELECT = { id: true, swipeEnabled: true, universityId: true, profileVisibility: true, isAdmin: true, isFrozen: true, isBanned: true, isPremium: true, premiumUntil: true, premiumPlan: true };
    const [me, target] = await Promise.all([
      prisma.user.findUnique({ where: { id: fromUserId }, select: REACH_SELECT }),
      Number.isInteger(toUserId) ? prisma.user.findUnique({ where: { id: toUserId }, select: REACH_SELECT }) : null,
    ]);
    // Gizli, yönetici, askıdaki hesap ve (Premium olmadan) başka üniversite
    // beğenilemez; karşı taraf zaten beğendiyse/eşleştiyse karşılık verilebilir
    const reach = await reachCheck(me, target);
    if (!reach.ok) return res.status(reach.status).json({ error: reach.error, code: reach.code });
    if (!me.swipeEnabled || !target.swipeEnabled) {
      return res.status(403).json({ error: "Bu kullanıcı Kart Modu'nu kullanmıyor." });
    }

    // Günlük beğeni sınırı (ücretsiz 5, haftalık plan 50, aylık/yıllık sınırsız).
    // Aynı kişiyi yeniden beğenmek yeni hak harcamaz.
    const alreadyLiked = await prisma.like.findUnique({ where: { fromUserId_toUserId: { fromUserId, toUserId } }, select: { id: true } });
    let quota = await likeQuota(prisma, me);
    if (!alreadyLiked && quota.left === 0) {
      return res.status(429).json({
        error: 'Bugünkü beğeni hakkın doldu.',
        code: 'LIKE_LIMIT',
        limit: quota.limit,
        resetsAt: quota.resetsAt,
      });
    }

    // Önce "geç" demiş olsa bile (Premium geri alma vb.) beğeni geçerli olur
    await prisma.pass.deleteMany({ where: { fromUserId, toUserId } });

    // Beğeniyi kaydet (zaten varsa hata vermesin)
    await prisma.like.upsert({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
      update: {},
      create: { fromUserId, toUserId },
    });

    // Karşı taraf beni beğenmiş mi kontrol et
    const reciprocal = await prisma.like.findUnique({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
    });

    let match = null;
    if (reciprocal) {
      // Eşleşme oluştur (userA her zaman küçük id olsun, tutarlılık için)
      const [userAId, userBId] = fromUserId < toUserId ? [fromUserId, toUserId] : [toUserId, fromUserId];

      match = await prisma.match.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      });

      const io = req.app.get('io');
      await Promise.all([
        createNotification(io, { userId: fromUserId, type: 'match', actorId: toUserId, targetType: 'match', targetId: match.id }),
        createNotification(io, { userId: toUserId, type: 'match', actorId: fromUserId, targetType: 'match', targetId: match.id }),
      ]);
    }

    if (!alreadyLiked && quota.left !== null) quota = { ...quota, used: quota.used + 1, left: quota.left - 1 };
    res.json({ liked: true, matched: !!match, match, likes: quota });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Beğeni işlenemedi.' });
  }
});

// POST /api/matches/pass/:userId — Kart Modu'nda "Geç". Kişi 30 gün desteye
// geri gelmez (önceden sayfa yenilenince aynı kişiler tekrar çıkıyordu).
router.post('/pass/:userId', requireAuth, async (req, res) => {
  try {
    const toUserId = Number(req.params.userId);
    if (!Number.isInteger(toUserId) || toUserId === req.userId) return res.status(400).json({ error: 'Geçersiz kullanıcı.' });
    await prisma.pass.upsert({
      where: { fromUserId_toUserId: { fromUserId: req.userId, toUserId } },
      update: { createdAt: new Date() },
      create: { fromUserId: req.userId, toUserId },
    });
    res.json({ passed: true });
  } catch (err) {
    if (err.code === 'P2003') return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'İşlem kaydedilemedi.' });
  }
});

// POST /api/matches/undo/:userId — Premium: son kararı (beğen ya da geç) geri al.
// Yalnızca son 10 dakikadaki karar ve eşleşmeye dönüşmemiş beğeni geri alınır.
const UNDO_WINDOW_MS = 10 * 60 * 1000;
router.post('/undo/:userId', requireAuth, async (req, res) => {
  try {
    const toUserId = Number(req.params.userId);
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { isPremium: true, premiumUntil: true } });
    if (!isPremiumActive(me)) {
      return res.status(403).json({ error: "Son kararı geri almak Premium'a özel.", code: 'PREMIUM_REQUIRED' });
    }
    const since = new Date(Date.now() - UNDO_WINDOW_MS);
    const key = { fromUserId_toUserId: { fromUserId: req.userId, toUserId } };
    const [pass, like] = await Promise.all([prisma.pass.findUnique({ where: key }), prisma.like.findUnique({ where: key })]);

    if (pass && pass.createdAt >= since) {
      await prisma.pass.delete({ where: key });
      return res.json({ undone: 'pass' });
    }
    if (like && like.createdAt >= since) {
      const [userAId, userBId] = req.userId < toUserId ? [req.userId, toUserId] : [toUserId, req.userId];
      const match = await prisma.match.findUnique({ where: { userAId_userBId: { userAId, userBId } } });
      if (match) return res.status(409).json({ error: 'Bu beğeni eşleşmeye dönüştü; geri almak yerine eşleşmeyi kaldırabilirsin.' });
      await prisma.like.delete({ where: key });
      return res.json({ undone: 'like' });
    }
    res.status(404).json({ error: 'Geri alınacak yakın tarihli bir karar yok.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Geri alınamadı.' });
  }
});

// "Seni Beğenenler": seni beğenen ama henüz senin karşılık vermediğin kişiler.
// Premium özelliğidir - premium olmayan kullanıcıya yalnızca sayı döner, kimlik
// bilgileri sunucudan hiç çıkmaz (istemci tarafında gizlemek yeterli olmazdı).
router.get('/likes-received', requireAuth, async (req, res) => {
  try {
    const myId = req.userId;
    const me = await prisma.user.findUnique({
      where: { id: myId },
      select: { isPremium: true, premiumUntil: true },
    });

    const [likesToMe, myLikes, blockedByMe, blockingMe] = await Promise.all([
      prisma.like.findMany({
        where: { toUserId: myId, fromUser: { isFrozen: false, isBanned: false } },
        select: { fromUserId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.like.findMany({ where: { fromUserId: myId }, select: { toUserId: true } }),
      prisma.block.findMany({ where: { blockerId: myId }, select: { blockedId: true } }),
      prisma.block.findMany({ where: { blockedId: myId }, select: { blockerId: true } }),
    ]);

    const hidden = new Set([
      ...myLikes.map((l) => l.toUserId),
      ...blockedByMe.map((b) => b.blockedId),
      ...blockingMe.map((b) => b.blockerId),
    ]);
    const pending = likesToMe.filter((l) => !hidden.has(l.fromUserId));

    if (!isPremiumActive(me)) {
      return res.json({ isPremium: false, count: pending.length, users: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: pending.map((l) => l.fromUserId) } },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        age: true,
        department: true,
        classYear: true,
        verificationStatus: true,
        studentDocStatus: true,
        university: { select: { name: true } },
      },
    });
    const likedAtById = Object.fromEntries(pending.map((l) => [l.fromUserId, l.createdAt]));
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json({
      isPremium: true,
      count: pending.length,
      users: pending
        .filter((l) => byId[l.fromUserId])
        .map((l) => ({ ...byId[l.fromUserId], likedAt: likedAtById[l.fromUserId] })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Beğenenler alınamadı.' });
  }
});

// Kullanıcının tüm eşleşmelerini listele
router.get('/', requireAuth, async (req, res) => {
  try {
    const myId = req.userId;

    // Engel ilişkisi olan eşleşmeler listede görünmez (tek sorguda)
    const blocked = await getBlockedUserIds(myId);
    const matches = (
      await prisma.match.findMany({
        where: { OR: [{ userAId: myId }, { userBId: myId }] },
        include: {
          userA: { select: { id: true, fullName: true, photoUrl: true, department: true } },
          userB: { select: { id: true, fullName: true, photoUrl: true, department: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
    ).filter((m) => !blocked.has(m.userAId === myId ? m.userBId : m.userAId));

    // Her sohbette okunmamış (karşı taraftan gelen, görülmemiş) mesaj sayısı
    const unreadRows = matches.length
      ? await prisma.message.groupBy({
          by: ['matchId'],
          where: { matchId: { in: matches.map((m) => m.id) }, senderId: { not: myId }, isRead: false },
          _count: { _all: true },
        })
      : [];
    const unread = new Map(unreadRows.map((r) => [r.matchId, r._count._all]));

    const formatted = matches
      .map((m) => {
        const last = m.messages[0] || null;
        return {
          matchId: m.id,
          otherUser: m.userAId === myId ? m.userB : m.userA,
          createdAt: m.createdAt,
          lastMessage: last ? { id: last.id, senderId: last.senderId, preview: previewOf(last), createdAt: last.createdAt } : null,
          unreadCount: unread.get(m.id) || 0,
        };
      })
      // En son hareket eden sohbet en üstte (mesaj yoksa eşleşme anı)
      .sort((a, b) => new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eşleşmeler alınamadı.' });
  }
});

// GET /api/matches/unread-count — okunmamış mesajı olan sohbet sayısı (alt menü rozeti)
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const myId = req.userId;
    const blocked = await getBlockedUserIds(myId);
    const rows = await prisma.message.groupBy({
      by: ['matchId'],
      where: {
        senderId: { not: myId, notIn: [...blocked] },
        isRead: false,
        match: { OR: [{ userAId: myId }, { userBId: myId }] },
      },
      _count: { _all: true },
    });
    res.json({ chats: rows.length, messages: rows.reduce((n, r) => n + r._count._all, 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Okunmamış mesaj sayısı alınamadı.' });
  }
});

// DELETE /api/matches/:matchId — eşleşmeyi kaldır. Sohbet ve ekleri iki taraf
// için de silinir. Beğeniler yerinde kalır: iki kişi birbirinin Kart Modu
// destesine geri düşmez ve kendiliğinden yeniden eşleşmez.
router.delete('/:matchId', requireAuth, async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match || (match.userAId !== req.userId && match.userBId !== req.userId)) {
      return res.status(404).json({ error: 'Eşleşme bulunamadı.' });
    }

    const files = await prisma.message.findMany({
      where: { matchId, OR: [{ photoUrl: { not: null } }, { audioUrl: { not: null } }, { fileUrl: { not: null } }] },
      select: { photoUrl: true, audioUrl: true, fileUrl: true },
    });
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { targetType: 'match', targetId: matchId } }),
      prisma.match.delete({ where: { id: matchId } }), // mesajlar cascade ile silinir
    ]);
    for (const m of files) {
      for (const url of [m.photoUrl, m.audioUrl, m.fileUrl]) {
        if (url?.startsWith('/api/files/')) fs.unlink(path.join(PRIVATE_UPLOADS, path.basename(url)), () => {});
      }
    }

    // İki tarafın da sohbet listesi ve rozetleri anında güncellensin (sohbet
    // açık olmasa bile); sonra eşleşmenin odası boşaltılır, böylece kalan
    // bağlantılar "yazıyor" gibi olayları almaya devam etmez
    const io = req.app.get('io');
    if (io) {
      io.to([`match_${matchId}`, `user_${match.userAId}`, `user_${match.userBId}`]).emit('match_removed', { matchId });
      io.in(`match_${matchId}`).socketsLeave(`match_${matchId}`);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eşleşme kaldırılamadı.' });
  }
});

module.exports = router;
