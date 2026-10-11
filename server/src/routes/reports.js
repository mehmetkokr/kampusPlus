// Kullanıcıların birbirini veya içeriği (gönderi, mesaj) şikayet edebilmesi
// için kullanılan uç nokta. Admin tarafı server/src/routes/admin.js içindedir.
const express = require('express');
const prisma = require('../lib/prisma');
const { cleanUserText, LIMITS } = require('../lib/textSafety');
const { alertAdmins } = require('../lib/alerts');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES = ['user', 'post', 'comment', 'message', 'club', 'club_message', 'story'];
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
    const desc = await cleanUserText(description, { max: LIMITS.reportDescription, label: 'Açıklama', filter: false });
    if (desc.error) return res.status(400).json({ error: desc.error });
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
        description: desc.value,
      },
    });

    // Yöneticilere haber (yarım saatte en fazla bir kez, bekleyen sayısıyla)
    prisma.report
      .count({ where: { status: 'pending' } })
      .then((pending) =>
        alertAdmins('report-new', {
          subject: `Yeni şikâyet (${pending} bekleyen)`,
          text: `Yeni bir ${targetType === 'user' ? 'kullanıcı' : 'içerik'} şikâyeti geldi. Bekleyen şikâyet sayısı: ${pending}.`,
          path: '/admin/reports',
          throttleMs: 30 * 60 * 1000,
        })
      )
      .catch(() => {});

    res.status(201).json({ message: 'Şikayetiniz alındı, incelenecek.', report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Şikayet gönderilemedi.' });
  }
});

module.exports = router;
