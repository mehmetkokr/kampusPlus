// Kulüp sistemi: oluşturma, üyelik, roller (owner/admin/member),
// üye çıkarma/engelleme ve kulüp grup sohbeti geçmişi.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { getBlockedUserIds } = require('../lib/block');
const { createNotification } = require('../lib/notifications');

const router = express.Router();

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  joinedAt: true,
  user: { select: { id: true, fullName: true, photoUrl: true, department: true } },
};

// Bir kullanıcının bu kulüpteki üyeliğini getirir (yoksa null)
async function getMembership(clubId, userId) {
  return prisma.clubMembership.findUnique({
    where: { clubId_userId: { clubId, userId } },
  });
}

function canManage(role) {
  return role === 'owner' || role === 'admin';
}

// ---------------------------------------------------------
// GET /api/clubs — kendi üniversitemdeki kulüpleri listele
// ---------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const clubs = await prisma.club.findMany({
      where: { universityId: me.universityId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: { where: { status: 'active' } } } },
        memberships: {
          where: { userId: req.userId },
          select: { role: true, status: true },
        },
      },
    });

    const result = clubs
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        iconEmoji: c.iconEmoji,
        memberCount: c._count.memberships,
        myMembership: c.memberships[0] || null,
      }))
      // Öne çıkan kulüpler (Grup C) en üstte, geri kalanı oluşturulma tarihine göre.;

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüpler listelenemedi.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs — yeni kulüp oluştur (oluşturan otomatik owner olur)
// ---------------------------------------------------------
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, category, iconEmoji } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Kulüp adı gerekli.' });
    }
    if (name.trim().length > 40) {
      return res.status(400).json({ error: 'Kulüp adı en fazla 40 karakter olabilir.' });
    }
    if (description && description.trim().length > 280) {
      return res.status(400).json({ error: 'Açıklama en fazla 280 karakter olabilir.' });
    }

    const me = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!me) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });

    const existing = await prisma.club.findUnique({
      where: { universityId_name: { universityId: me.universityId, name: name.trim() } },
    });
    if (existing) {
      return res.status(409).json({ error: 'Üniversitende bu isimde bir kulüp zaten var.' });
    }

    const club = await prisma.club.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        category: category || 'Sosyal',
        iconEmoji: iconEmoji || '👥',
        universityId: me.universityId,
        creatorId: me.id,
        memberships: {
          create: { userId: me.id, role: 'owner', status: 'active' },
        },
      },
    });

    res.status(201).json(club);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüp oluşturulamadı.' });
  }
});

// ---------------------------------------------------------
// GET /api/clubs/:id — kulüp detayı (üye listesi dahil)
// ---------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const me = await prisma.user.findUnique({ where: { id: req.userId } });

    const club = await prisma.club.findUnique({
      where: { id: clubId },
      include: {
        memberships: {
          where: { status: 'active' },
          select: MEMBER_SELECT,
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        },
      },
    });

    if (!club || club.universityId !== me.universityId) {
      return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    }

    const myMembership = club.memberships.find((m) => m.user.id === req.userId) || null;

    res.json({
      id: club.id,
      name: club.name,
      description: club.description,
      category: club.category,
      iconEmoji: club.iconEmoji,
      members: club.memberships,
      myMembership,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüp bilgisi alınamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/join — kulübe katıl
// ---------------------------------------------------------
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const me = await prisma.user.findUnique({ where: { id: req.userId } });

    const club = await prisma.club.findUnique({ where: { id: clubId } });
    if (!club || club.universityId !== me.universityId) {
      return res.status(404).json({ error: 'Kulüp bulunamadı.' });
    }

    const existing = await getMembership(clubId, req.userId);
    if (existing) {
      if (existing.status === 'banned') {
        return res.status(403).json({ error: 'Bu kulüpten engellendiniz.' });
      }
      return res.status(409).json({ error: 'Zaten bu kulübün üyesisin.' });
    }

    const membership = await prisma.clubMembership.create({
      data: { clubId, userId: req.userId, role: 'member', status: 'active' },
    });

    await createNotification(req.app.get('io'), {
      userId: req.userId,
      type: 'club_join',
      targetType: 'club',
      targetId: clubId,
      message: club.name,
    });

    res.status(201).json(membership);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulübe katılınamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/leave — kulüpten ayrıl
// ---------------------------------------------------------
router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);

    if (!membership) return res.status(404).json({ error: 'Bu kulübün üyesi değilsin.' });
    if (membership.role === 'owner') {
      return res.status(400).json({ error: 'Kulüp kurucusu ayrılamaz. Kulübü silebilirsin.' });
    }

    await prisma.clubMembership.delete({ where: { id: membership.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüpten ayrılınamadı.' });
  }
});

// ---------------------------------------------------------
// DELETE /api/clubs/:id — kulübü sil (yalnızca owner)
// ---------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);

    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Yalnızca kulüp kurucusu kulübü silebilir.' });
    }

    await prisma.clubMessage.deleteMany({ where: { clubId } });
    await prisma.clubMembership.deleteMany({ where: { clubId } });
    await prisma.club.delete({ where: { id: clubId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kulüp silinemedi.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/members/:userId/kick — üyeyi çıkar
// ---------------------------------------------------------
router.post('/:id/members/:userId/kick', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);

    const myMembership = await getMembership(clubId, req.userId);
    if (!myMembership || !canManage(myMembership.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkin yok.' });
    }

    const targetMembership = await getMembership(clubId, targetUserId);
    if (!targetMembership) return res.status(404).json({ error: 'Üye bulunamadı.' });
    if (targetMembership.role === 'owner') {
      return res.status(400).json({ error: 'Kulüp kurucusu çıkarılamaz.' });
    }
    if (targetMembership.role === 'admin' && myMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Yöneticileri yalnızca kurucu çıkarabilir.' });
    }

    await prisma.clubMembership.delete({ where: { id: targetMembership.id } });
    // Açık oturumu varsa kulüp sohbetini canlı almaya devam etmesin
    req.app.get('io')?.in(`user_${targetUserId}`).socketsLeave(`club_${clubId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Üye çıkarılamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/members/:userId/ban — üyeyi engelle (çıkar + yeniden katılamaz)
// ---------------------------------------------------------
router.post('/:id/members/:userId/ban', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);

    const myMembership = await getMembership(clubId, req.userId);
    if (!myMembership || !canManage(myMembership.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkin yok.' });
    }

    const targetMembership = await getMembership(clubId, targetUserId);
    if (!targetMembership) return res.status(404).json({ error: 'Üye bulunamadı.' });
    if (targetMembership.role === 'owner') {
      return res.status(400).json({ error: 'Kulüp kurucusu engellenemez.' });
    }
    if (targetMembership.role === 'admin' && myMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Yöneticileri yalnızca kurucu engelleyebilir.' });
    }

    await prisma.clubMembership.update({
      where: { id: targetMembership.id },
      data: { status: 'banned', role: 'member' },
    });

    req.app.get('io')?.in(`user_${targetUserId}`).socketsLeave(`club_${clubId}`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Üye engellenemedi.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/members/:userId/promote — üyeyi yönetici yap (yalnızca owner)
// ---------------------------------------------------------
router.post('/:id/members/:userId/promote', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);

    const myMembership = await getMembership(clubId, req.userId);
    if (!myMembership || myMembership.role !== 'owner') {
      return res.status(403).json({ error: 'Yalnızca kulüp kurucusu yönetici atayabilir.' });
    }

    const targetMembership = await getMembership(clubId, targetUserId);
    if (!targetMembership || targetMembership.status !== 'active') {
      return res.status(404).json({ error: 'Üye bulunamadı.' });
    }

    const updated = await prisma.clubMembership.update({
      where: { id: targetMembership.id },
      data: { role: targetMembership.role === 'admin' ? 'member' : 'admin' },
    });

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem gerçekleştirilemedi.' });
  }
});

// ---------------------------------------------------------
// GET /api/clubs/:id/messages?limit=50&before=<mesajId> — grup sohbeti geçmişi (yalnızca üyeler)
// ---------------------------------------------------------
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Bu sohbeti görüntülemek için kulübe üye olmalısın.' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const before = req.query.before ? Number(req.query.before) : null;
    const blockedIds = await getBlockedUserIds(req.userId);

    const messages = await prisma.clubMessage.findMany({
      where: {
        clubId,
        ...(before ? { id: { lt: before } } : {}),
        ...(blockedIds.size > 0 ? { senderId: { notIn: [...blockedIds] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: { id: true, fullName: true, photoUrl: true } } },
    });

    messages.reverse();

    res.json({ messages, hasMore: messages.length === limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesajlar alınamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/messages/photo — kulüp sohbetine fotoğraf gönder
// ---------------------------------------------------------
router.post('/:id/messages/photo', requireAuth, chatUpload.private.single('photo'), verifyFileSignature, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);

    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Fotoğraf göndermek için kulübe üye olmalısın.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Fotoğraf gerekli.' });

    const message = await prisma.clubMessage.create({
      data: {
        clubId,
        senderId: req.userId,
        photoUrl: `/api/files/${req.file.filename}`,
      },
      include: { sender: { select: { id: true, fullName: true, photoUrl: true } } },
    });

    // Odadaki herkese anlık yayınla (socket.io app'e req.app üzerinden erişiyoruz)
    const io = req.app.get('io');
    if (io) io.to(`club_${clubId}`).emit('new_club_message', message);

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Fotoğraf gönderilemedi.' });
  }
});

// ---------------------------------------------------------
// GET /api/clubs/:id/events — kulübün etkinlikleri (yalnızca üyeler)
// ---------------------------------------------------------
router.get('/:id/events', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Etkinlikleri görmek için kulübe üye olmalısın.' });
    }

    const events = await prisma.event.findMany({
      where: { clubId },
      orderBy: { startsAt: 'asc' },
      include: {
        creator: { select: { id: true, fullName: true } },
        rsvps: {
          orderBy: { id: 'asc' },
          select: { userId: true, user: { select: { id: true, fullName: true, photoUrl: true } } },
        },
      },
    });

    res.json(
      events
        .map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          location: e.location,
          startsAt: e.startsAt,
          creator: e.creator,
          goingCount: e.rsvps.length,
          imGoing: e.rsvps.some((r) => r.userId === req.userId),
          // Katılanlar (yalnızca kulüp üyeleri bu uç noktayı görebilir)
          attendees: e.rsvps.map((r) => r.user),
        }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkinlikler alınamadı.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/events — yeni etkinlik oluştur (yalnızca kurucu/başkan ve yöneticiler)
// ---------------------------------------------------------
router.post('/:id/events', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);
    if (!membership || membership.status !== 'active' || !canManage(membership.role)) {
      return res.status(403).json({ error: 'Etkinlikleri yalnızca kulüp başkanı ve yöneticiler oluşturabilir.' });
    }

    const { title, description, location, startsAt } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Etkinlik başlığı gerekli.' });
    if (!startsAt) return res.status(400).json({ error: 'Etkinlik tarihi gerekli.' });

    const event = await prisma.event.create({
      data: {
        clubId,
        creatorId: req.userId,
        title: title.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startsAt: new Date(startsAt),
        rsvps: { create: { userId: req.userId } }, // oluşturan otomatik katılımcı olur
      },
    });

    // Kulübün diğer aktif üyelerine bildirim: "{kulüp}: yeni etkinlik — {başlık}"
    const [club, members] = await Promise.all([
      prisma.club.findUnique({ where: { id: clubId }, select: { name: true } }),
      prisma.clubMembership.findMany({
        where: { clubId, status: 'active', userId: { not: req.userId } },
        select: { userId: true },
      }),
    ]);
    const io = req.app.get('io');
    const message = JSON.stringify({ club: club?.name || '', title: event.title, startsAt: event.startsAt });
    await Promise.all(
      members.map((m) =>
        createNotification(io, {
          userId: m.userId,
          type: 'club_event',
          actorId: req.userId,
          targetType: 'club',
          targetId: clubId,
          message,
        })
      )
    );

    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkinlik oluşturulamadı.' });
  }
});

// ---------------------------------------------------------
// DELETE /api/clubs/:id/events/:eventId — etkinliği sil (oluşturan ya da yönetici)
// ---------------------------------------------------------
router.delete('/:id/events/:eventId', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const eventId = Number(req.params.eventId);
    const membership = await getMembership(clubId, req.userId);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event || event.clubId !== clubId) return res.status(404).json({ error: 'Etkinlik bulunamadı.' });

    const canDelete = event.creatorId === req.userId || (membership && canManage(membership.role));
    if (!canDelete) return res.status(403).json({ error: 'Bu etkinliği silemezsin.' });

    await prisma.eventRSVP.deleteMany({ where: { eventId } });
    await prisma.event.delete({ where: { id: eventId } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Etkinlik silinemedi.' });
  }
});

// ---------------------------------------------------------
// POST /api/clubs/:id/events/:eventId/rsvp — katıl / katılımdan vazgeç (toggle)
// ---------------------------------------------------------
router.post('/:id/events/:eventId/rsvp', requireAuth, async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    const clubId = Number(req.params.id);
    const membership = await getMembership(clubId, req.userId);
    if (!membership || membership.status !== 'active') {
      return res.status(403).json({ error: 'Katılmak için kulübe üye olmalısın.' });
    }

    const existing = await prisma.eventRSVP.findUnique({
      where: { eventId_userId: { eventId, userId: req.userId } },
    });

    if (existing) {
      await prisma.eventRSVP.delete({ where: { id: existing.id } });
      return res.json({ going: false });
    }

    await prisma.eventRSVP.create({ data: { eventId, userId: req.userId } });
    res.json({ going: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem başarısız.' });
  }
});

module.exports = router;
