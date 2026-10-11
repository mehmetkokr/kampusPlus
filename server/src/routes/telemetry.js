// Tarayıcıdan gelen hata raporları ve kullanım olayları.
// Giriş gerektirmez (giriş sayfasındaki hatalar da görülsün); token varsa ve
// geçerliyse kullanıcıya bağlanır. Kötüye kullanıma karşı sıkı sınır vardır.
const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { recordError } = require('../lib/errorLog');
const { CLIENT_EVENTS, track } = require('../lib/analytics');

const router = express.Router();

function optionalUserId(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    return payload.purpose ? null : payload.userId;
  } catch {
    return null;
  }
}

const limiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    message: { error: 'Çok fazla istek.' },
  });

// POST /api/telemetry/errors — tarayıcıda yakalanan hata
router.post('/errors', limiter(30), async (req, res) => {
  const { message, stack, path, componentStack } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'Eksik hata bilgisi.' });
  await recordError({
    source: 'client',
    message,
    stack: [typeof stack === 'string' ? stack : '', typeof componentStack === 'string' ? componentStack : ''].filter(Boolean).join('\n--- bileşen ---\n'),
    path: typeof path === 'string' ? path.split('?')[0] : null,
    userAgent: req.headers['user-agent'],
    userId: optionalUserId(req),
  });
  res.status(204).end();
});

// POST /api/telemetry/events — { events: [{ name, path?, props? }], anonId? }
// Tarayıcı olayları biriktirip toplu gönderir.
router.post('/events', limiter(300), async (req, res) => {
  const list = Array.isArray(req.body?.events) ? req.body.events.slice(0, 20) : [];
  const userId = optionalUserId(req);
  const anonId = typeof req.body?.anonId === 'string' ? req.body.anonId : null;
  await Promise.all(
    list
      .filter((e) => e && CLIENT_EVENTS.has(e.name))
      .map((e) =>
        track(e.name, {
          userId,
          anonId,
          path: e.path,
          props: e.props && typeof e.props === 'object' ? e.props : null,
        })
      )
  );
  res.status(204).end();
});

module.exports = router;
