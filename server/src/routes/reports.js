// Kullanıcıların birbirini veya içeriği (gönderi, mesaj) şikayet edebilmesi
// için kullanılan uç nokta. Admin tarafı server/src/routes/admin.js içindedir.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { registerConfessionReport } = require('../lib/moderation');

const router = express.Router();

// 'confession' Grup D (anonim itiraf kutusu) için eklendi - hassas bir içerik
// türü olduğundan aşağıda ayrıca otomatik gizleme tetiklenir.
const VALID_TYPES = ['user', 'post', 'comment', 'message', 'club', 'club_message', 'group_message', 'confession'];
const VALID_REASONS = ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'];

router.post('/', requireAuth, async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;

    if (!VALID_TYPES.includes(targetType)) {
      return res.status(400).json({ error: 'Geçersiz şikayet türü.' });
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ error: 'Geçersiz şikayet sebebi.' });
    }
    const targetIdNum = Number(targetId);
    if (!targetIdNum) {
      return res.status(400).json({ error: 'Geçersiz hedef.' });
    }
    if (targetType === 'user' && targetIdNum === req.userId) {
      return res.status(400).json({ error: 'Kendinizi şikayet edemezsiniz.' });
    }

    // Aynı kişi aynı içeriği birden fazla kez şikayet ederek otomatik gizleme
    // eşiğini (Grup D) tek başına yapay olarak aşamasın diye mükerrer engeli.
    const existing = await prisma.report.findFirst({
      where: { reporterId: req.userId, targetType, targetId: targetIdNum },
    });
    if (existing) {
      return res.status(409).json({ error: 'Bu içeriği zaten şikayet ettiniz.' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.userId,
        targetType,
        targetId: targetIdNum,
        reason,
        description: description?.trim() || null,
      },
    });

    if (targetType === 'confession') {
      await registerConfessionReport(targetIdNum);
    }

    res.status(201).json({ message: 'Şikayetiniz alındı, incelenecek.', report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şikayet gönderilemedi.' });
  }
});

module.exports = router;
