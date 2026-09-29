// Beğenme ve eşleşme mantığı
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { createNotification } = require('../lib/notifications');
const { isBlockedEitherWay } = require('../lib/block');

const router = express.Router();

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

    res.json({ liked: true, matched: !!match, match });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Beğeni işlenemedi.' });
  }
});

// Kullanıcının tüm eşleşmelerini listele
router.get('/', requireAuth, async (req, res) => {
  try {
    const myId = req.userId;

    const matches = await prisma.match.findMany({
      where: { OR: [{ userAId: myId }, { userBId: myId }] },
      include: {
        userA: { select: { id: true, fullName: true, photoUrl: true, department: true } },
        userB: { select: { id: true, fullName: true, photoUrl: true, department: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Taraflardan biri diğerini engellemişse bu eşleşme artık listede görünmesin
    // (mesajlaşma zaten engellendi, sohbetin görünür kalmasının bir anlamı yok).
    const visible = [];
    for (const m of matches) {
      const otherId = m.userAId === myId ? m.userBId : m.userAId;
      if (!(await isBlockedEitherWay(myId, otherId))) {
        visible.push(m);
      }
    }

    // Karşı tarafın bilgisini "otherUser" olarak düzleştir
    const formatted = visible.map((m) => ({
      matchId: m.id,
      otherUser: m.userAId === myId ? m.userB : m.userA,
      createdAt: m.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Eşleşmeler alınamadı.' });
  }
});

module.exports = router;
