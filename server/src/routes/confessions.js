// Grup D — Anonim İtiraf Kutusu
//
// Tasarım ilkeleri (bu özellik "riskli/hassas" olarak işaretlendiği için):
// 1) Yazarın kimliği (authorId) diğer öğrencilere HİÇBİR yanıtta gösterilmez.
//    Sadece kötüye kullanım soruşturması için admin uçlarında (admin.js)
//    kullanılır.
// 2) Üniversite dışına asla sızmaz - sadece yazarla aynı üniversitedeki
//    doğrulanmış öğrenciler görebilir (discover.js'teki isVerified mantığıyla
//    tutarlı).
// 3) Spam/istismarı zorlaştırmak için saatlik gönderi sınırı vardır.
// 4) Şikayet eşiği aşılınca otomatik gizlenir (bkz. lib/moderation.js),
//    admin panelinde ayrıca elle gizlenebilir/kaldırılabilir (bkz. admin.js).
const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const MAX_LENGTH = 500;
const MIN_LENGTH = 3;
const REACTION_TYPES = ['heart', 'laugh', 'sad', 'support'];

// Saatte kullanıcı başına en fazla 5 itiraf - anonim olduğu için spam/taciz
// riski daha yüksek, bu yüzden diğer içerik türlerine göre daha sıkı.
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.userId}`,
  message: { error: 'Çok fazla itiraf paylaştın. Lütfen bir süre sonra tekrar dene.' },
});

function isVerified(u) {
  return u?.verificationStatus === 'verified' || u?.verificationStatus === 'auto_verified';
}

async function serializeConfession(row, myUserId) {
  const reactionCounts = {};
  for (const t of REACTION_TYPES) reactionCounts[t] = 0;
  let myReaction = null;
  for (const r of row.reactions) {
    reactionCounts[r.type] = (reactionCounts[r.type] || 0) + 1;
    if (r.userId === myUserId) myReaction = r.type;
  }
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    isMine: row.authorId === myUserId,
    reactionCounts,
    myReaction,
  };
}

// ---------------------------------------------------------
// GET /api/confessions?before=<id>&limit=20 — kendi üniversitemin itiraf akışı
// ---------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (!isVerified(me)) {
      return res.status(403).json({ error: 'İtiraf kutusunu görmek için hesabının doğrulanmış olması gerekir.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const before = req.query.before ? Number(req.query.before) : null;

    const rows = await prisma.confession.findMany({
      where: {
        universityId: me.universityId,
        status: 'visible',
        ...(before ? { id: { lt: before } } : {}),
      },
      orderBy: { id: 'desc' },
      take: limit,
      include: { reactions: { select: { userId: true, type: true } } },
    });

    const confessions = await Promise.all(rows.map((r) => serializeConfession(r, req.userId)));
    res.json({ confessions, hasMore: rows.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İtiraflar alınamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/confessions — yeni itiraf paylaş
// ---------------------------------------------------------
router.post('/', requireAuth, createLimiter, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    if (!isVerified(me)) {
      return res.status(403).json({ error: 'İtiraf paylaşmak için hesabının doğrulanmış olması gerekir.' });
    }

    const content = (req.body?.content || '').trim();
    if (content.length < MIN_LENGTH) {
      return res.status(400).json({ error: 'İtiraf çok kısa.' });
    }
    if (content.length > MAX_LENGTH) {
      return res.status(400).json({ error: `İtiraf en fazla ${MAX_LENGTH} karakter olabilir.` });
    }

    const row = await prisma.confession.create({
      data: { universityId: me.universityId, authorId: me.id, content },
      include: { reactions: { select: { userId: true, type: true } } },
    });

    res.status(201).json(await serializeConfession(row, req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İtiraf paylaşılamadı.' });
  }
});

// ---------------------------------------------------------
// DELETE /api/confessions/:id — kendi itirafını kaldır
// ---------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.confession.findUnique({ where: { id } });
    if (!row || row.authorId !== req.userId) {
      return res.status(404).json({ error: 'İtiraf bulunamadı.' });
    }
    await prisma.confession.update({ where: { id }, data: { status: 'removed' } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İtiraf kaldırılamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/confessions/:id/react — tepki ver / kaldır (toggle)
// body: { type: 'heart' | 'laugh' | 'sad' | 'support' }
// ---------------------------------------------------------
router.post('/:id/react', requireAuth, async (req, res) => {
  try {
    const confessionId = Number(req.params.id);
    const { type = 'heart' } = req.body;
    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Geçersiz tepki türü.' });
    }

    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    const confession = await prisma.confession.findUnique({ where: { id: confessionId } });
    if (!confession || confession.status !== 'visible' || confession.universityId !== me.universityId) {
      return res.status(404).json({ error: 'İtiraf bulunamadı.' });
    }

    const existing = await prisma.confessionReaction.findUnique({
      where: { confessionId_userId: { confessionId, userId: req.userId } },
    });

    if (existing && existing.type === type) {
      await prisma.confessionReaction.delete({ where: { id: existing.id } });
    } else if (existing) {
      await prisma.confessionReaction.update({ where: { id: existing.id }, data: { type } });
    } else {
      await prisma.confessionReaction.create({ data: { confessionId, userId: req.userId, type } });
    }

    const fresh = await prisma.confession.findUnique({
      where: { id: confessionId },
      include: { reactions: { select: { userId: true, type: true } } },
    });
    res.json(await serializeConfession(fresh, req.userId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tepki kaydedilemedi.' });
  }
});

module.exports = router;
