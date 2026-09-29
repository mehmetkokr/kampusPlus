// Genel grup sohbeti: kullanıcılar eşleştikleri kişiler arasından seçim yaparak
// serbest grup sohbetleri oluşturabilir (kulüp sohbetinden bağımsız).
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { getBlockedUserIds } = require('../lib/block');

const router = express.Router();

const SENDER_SELECT = { id: true, fullName: true, photoUrl: true };

async function isGroupMember(groupId, userId) {
  return prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

// GET /api/groups — üyesi olduğum grup sohbetleri
router.get('/', requireAuth, async (req, res) => {
  try {
    const memberships = await prisma.groupChatMember.findMany({
      where: { userId: req.userId },
      include: {
        group: {
          include: {
            members: { include: { user: { select: SENDER_SELECT } } },
            _count: { select: { members: true } },
          },
        },
      },
    });

    const groups = memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      memberCount: m.group._count.members,
      members: m.group.members.map((mm) => mm.user),
    }));

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gruplar listelenemedi.' });
  }
});

// POST /api/groups — yeni grup oluştur (eşleşmelerim arasından üye seç)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Grup adı gerekli.' });
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ error: 'En az bir üye seçmelisin.' });
    }

    // Seçilen herkesin gerçekten benimle eşleşmiş olduğunu doğrula (güvenlik)
    const myMatches = await prisma.match.findMany({
      where: { OR: [{ userAId: req.userId }, { userBId: req.userId }] },
    });
    const validIds = new Set(
      myMatches.map((m) => (m.userAId === req.userId ? m.userBId : m.userAId))
    );
    const filteredMemberIds = memberIds.map(Number).filter((id) => validIds.has(id));

    if (filteredMemberIds.length === 0) {
      return res.status(400).json({ error: 'Yalnızca eşleştiğin kişileri gruba ekleyebilirsin.' });
    }

    const group = await prisma.groupChat.create({
      data: {
        name: name.trim(),
        creatorId: req.userId,
        members: {
          create: [req.userId, ...filteredMemberIds].map((userId) => ({ userId })),
        },
      },
      include: { members: { include: { user: { select: SENDER_SELECT } } } },
    });

    res.status(201).json({
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      members: group.members.map((m) => m.user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Grup oluşturulamadı.' });
  }
});

// GET /api/groups/:id — grup detayı
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await isGroupMember(groupId, req.userId);
    if (!membership) return res.status(403).json({ error: 'Bu gruba erişim yetkin yok.' });

    const group = await prisma.groupChat.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: SENDER_SELECT } } } },
    });
    if (!group) return res.status(404).json({ error: 'Grup bulunamadı.' });

    res.json({
      id: group.id,
      name: group.name,
      creatorId: group.creatorId,
      members: group.members.map((m) => m.user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Grup bilgisi alınamadı.' });
  }
});

// POST /api/groups/:id/leave
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await isGroupMember(groupId, req.userId);
    if (!membership) return res.status(404).json({ error: 'Bu grubun üyesi değilsin.' });

    await prisma.groupChatMember.delete({ where: { id: membership.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gruptan ayrılınamadı.' });
  }
});

// GET /api/groups/:id/messages?limit=50&before=<mesajId>
// Parametresiz istek en güncel `limit` mesajı döner (varsayılan 50, üst
// sınır 100). Daha eskileri yüklemek için `before`, o ana kadar yüklenen en
// eski mesajın id'sini alır.
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await isGroupMember(groupId, req.userId);
    if (!membership) return res.status(403).json({ error: 'Bu sohbete erişim yetkin yok.' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = req.query.before ? Number(req.query.before) : null;
    const blockedIds = await getBlockedUserIds(req.userId);

    const messages = await prisma.groupMessage.findMany({
      where: {
        groupId,
        ...(before ? { id: { lt: before } } : {}),
        ...(blockedIds.size > 0 ? { senderId: { notIn: [...blockedIds] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: SENDER_SELECT } },
    });

    messages.reverse();

    res.json({ messages, hasMore: messages.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesajlar alınamadı.' });
  }
});

function attachmentHandler(field, dataKey, urlPrefix) {
  return async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const membership = await isGroupMember(groupId, req.userId);
      if (!membership) return res.status(403).json({ error: 'Bu sohbete erişim yetkin yok.' });
      if (!req.file) return res.status(400).json({ error: 'Dosya gerekli.' });

      const data = {
        groupId,
        senderId: req.userId,
        [dataKey]: `${urlPrefix}${req.file.filename}`,
      };
      if (dataKey === 'fileUrl') data.fileName = req.file.originalname;

      const message = await prisma.groupMessage.create({
        data,
        include: { sender: { select: SENDER_SELECT } },
      });

      req.app.get('io')?.to(`group_${groupId}`).emit('new_group_message', message);
      res.status(201).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Gönderilemedi.' });
    }
  };
}

router.post('/:id/messages/photo', requireAuth, chatUpload.private.single('photo'), verifyFileSignature, attachmentHandler('photo', 'photoUrl', '/api/files/'));
router.post('/:id/messages/audio', requireAuth, chatUpload.private.single('audio'), verifyFileSignature, attachmentHandler('audio', 'audioUrl', '/api/files/'));
router.post('/:id/messages/file', requireAuth, chatUpload.private.single('file'), verifyFileSignature, attachmentHandler('file', 'fileUrl', '/api/files/'));

module.exports = router;
