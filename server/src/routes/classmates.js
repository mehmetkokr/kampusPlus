// Ders/Bölüm arkadaşı bulma: kullanıcının içinde bulunduğu dönemin otomatik
// grubunu ve geçmiş dönemlerden kalan (arşivlenmiş, salt-okunur) gruplarını
// listeler; grup sohbeti mesajlaşmasını sağlar. Üyelik tamamen otomatik
// yönetildiği için burada "gruba katıl/oluştur" ucu yok (bkz. lib/classmateGroups.js).
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { getBlockedUserIds } = require('../lib/block');
const { formatSemesterLabel } = require('../lib/semester');

const router = express.Router();

const SENDER_SELECT = { id: true, fullName: true, photoUrl: true, department: true, classYear: true };

async function isClassmateGroupMember(groupId, userId) {
  return prisma.classmateGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

function serializeGroup(group, memberCount) {
  return {
    id: group.id,
    name: group.name,
    department: group.department,
    classYear: group.classYear,
    semesterKey: group.semesterKey,
    semesterLabel: formatSemesterLabel(group.semesterKey),
    isArchived: group.isArchived,
    memberCount,
  };
}

// GET /api/classmates/groups — üyesi olduğum güncel dönem grubu + geçmiş dönem gruplarım
router.get('/groups', requireAuth, async (req, res) => {
  try {
    const memberships = await prisma.classmateGroupMember.findMany({
      where: { userId: req.userId },
      include: { group: { include: { _count: { select: { members: true } } } } },
      orderBy: { joinedAt: 'desc' },
    });

    const current = memberships.find((m) => !m.group.isArchived);
    const past = memberships.filter((m) => m.group.isArchived);

    res.json({
      current: current ? serializeGroup(current.group, current.group._count.members) : null,
      past: past.map((m) => serializeGroup(m.group, m.group._count.members)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gruplar listelenemedi.' });
  }
});

// GET /api/classmates/groups/:id — grup detayı ve üyeler
router.get('/groups/:id', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await isClassmateGroupMember(groupId, req.userId);
    if (!membership) return res.status(403).json({ error: 'Bu gruba erişim yetkin yok.' });

    const group = await prisma.classmateGroup.findUnique({
      where: { id: groupId },
      include: { members: { include: { user: { select: SENDER_SELECT } } } },
    });
    if (!group) return res.status(404).json({ error: 'Grup bulunamadı.' });

    res.json({
      ...serializeGroup(group, group.members.length),
      members: group.members.map((m) => m.user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Grup bilgisi alınamadı.' });
  }
});

// GET /api/classmates/groups/:id/messages?limit=50&before=<mesajId>
router.get('/groups/:id/messages', requireAuth, async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    const membership = await isClassmateGroupMember(groupId, req.userId);
    if (!membership) return res.status(403).json({ error: 'Bu sohbete erişim yetkin yok.' });

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = req.query.before ? Number(req.query.before) : null;
    const blockedIds = await getBlockedUserIds(req.userId);

    const messages = await prisma.classmateGroupMessage.findMany({
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

// POST /api/classmates/groups/:id/messages/photo — fotoğraf eki (metin mesajları socket üzerinden gönderilir)
router.post(
  '/groups/:id/messages/photo',
  requireAuth,
  chatUpload.private.single('photo'),
  verifyFileSignature,
  async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const membership = await isClassmateGroupMember(groupId, req.userId);
      if (!membership) return res.status(403).json({ error: 'Bu sohbete erişim yetkin yok.' });
      if (!req.file) return res.status(400).json({ error: 'Dosya gerekli.' });

      const group = await prisma.classmateGroup.findUnique({ where: { id: groupId }, select: { isArchived: true } });
      if (!group || group.isArchived) {
        return res.status(403).json({ error: 'Bu dönem sona erdi, bu grup artık salt-okunur.' });
      }

      const message = await prisma.classmateGroupMessage.create({
        data: {
          groupId,
          senderId: req.userId,
          photoUrl: `/api/files/${req.file.filename}`,
        },
        include: { sender: { select: SENDER_SELECT } },
      });

      req.app.get('io')?.to(`classmate_group_${groupId}`).emit('new_classmate_message', message);
      res.status(201).json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Gönderilemedi.' });
    }
  }
);

module.exports = router;
