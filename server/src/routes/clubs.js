// Kulüp sistemi: oluşturma, üyelik, roller (owner/admin/member),
// üye çıkarma/engelleme ve kulüp grup sohbeti geçmişi.
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const chatUpload = require('../middleware/chatUpload');
const { verifyFileSignature } = require('../lib/fileValidation');
const { getBlockedUserIds } = require('../lib/block');
const { createNotification } = require('../lib/notifications');
const { checkCanPost, markPosted, serializePoll, loadPoll, broadcastPoll, POLL_INCLUDE, SENDER_SELECT } = require('../lib/clubChat');

const router = express.Router();

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  mutedUntil: true,
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

    // Engellenen üye kendi durumunu da görebilsin (aktif listede değil)
    const myMembership =
      club.memberships.find((m) => m.user.id === req.userId) ||
      (await prisma.clubMembership.findUnique({ where: { clubId_userId: { clubId, userId: req.userId } }, select: MEMBER_SELECT }));
    const manager = myMembership?.status === 'active' && canManage(myMembership.role);

    const [pinned, banned] = await Promise.all([
      club.pinnedMessageId && myMembership?.status === 'active'
        ? prisma.clubMessage.findUnique({ where: { id: club.pinnedMessageId }, include: { sender: { select: SENDER_SELECT } } })
        : null,
      manager ? prisma.clubMembership.findMany({ where: { clubId, status: 'banned' }, select: MEMBER_SELECT }) : [],
    ]);

    res.json({
      id: club.id,
      name: club.name,
      description: club.description,
      category: club.category,
      iconEmoji: club.iconEmoji,
      chatMode: club.chatMode,
      slowModeSeconds: club.slowModeSeconds,
      pinnedMessage: pinned,
      members: club.memberships,
      banned,
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

    // Sohbette olanlar kulübün kapandığını anında görsün
    req.app.get('io')?.to(`club_${clubId}`).emit('club_closed', { clubId });
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
      include: { sender: { select: SENDER_SELECT }, poll: { include: POLL_INCLUDE } },
    });

    messages.reverse();

    res.json({
      messages: messages.map((m) => ({ ...m, poll: serializePoll(m.poll, req.userId) })),
      hasMore: messages.length === limit,
    });
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
    const allowed = await checkCanPost(clubId, req.userId);
    if (!allowed.ok) return res.status(403).json({ error: allowed.error });
    if (!req.file) return res.status(400).json({ error: 'Fotoğraf gerekli.' });
    markPosted(clubId, req.userId);

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

// =========================================================
// KULÜP YÖNETİMİ (başkan ve yöneticiler)
// =========================================================

// Bu istek için yönetici üyeliği döner; yetkisizse yanıtı gönderip null döner
async function requireManager(req, res, clubId, { ownerOnly = false } = {}) {
  const membership = await getMembership(clubId, req.userId);
  const ok = membership && membership.status === 'active' && (ownerOnly ? membership.role === 'owner' : canManage(membership.role));
  if (!ok) {
    res.status(403).json({ error: ownerOnly ? 'Bu işlemi yalnızca kulüp başkanı yapabilir.' : 'Bu işlem için kulüp yöneticisi olmalısın.' });
    return null;
  }
  return membership;
}

// PATCH /api/clubs/:id/settings — sohbet modu, yavaş mod; ad ve açıklama (yalnızca başkan)
router.patch('/:id/settings', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const me = await requireManager(req, res, clubId);
    if (!me) return;

    const data = {};
    const { chatMode, slowModeSeconds, name, description } = req.body;
    if (chatMode !== undefined) {
      if (!['everyone', 'admins'].includes(chatMode)) return res.status(400).json({ error: 'Geçersiz sohbet modu.' });
      data.chatMode = chatMode;
    }
    if (slowModeSeconds !== undefined) {
      const sec = Number(slowModeSeconds);
      if (![0, 10, 30, 60, 300].includes(sec)) return res.status(400).json({ error: 'Geçersiz yavaş mod süresi.' });
      data.slowModeSeconds = sec;
    }
    if (name !== undefined || description !== undefined) {
      if (me.role !== 'owner') return res.status(403).json({ error: 'Kulüp adını ve açıklamasını yalnızca başkan değiştirebilir.' });
      if (name !== undefined) {
        const clean = String(name).trim();
        if (clean.length < 3 || clean.length > 40) return res.status(400).json({ error: 'Kulüp adı 3–40 karakter olmalı.' });
        data.name = clean;
      }
      if (description !== undefined) data.description = String(description).trim().slice(0, 500) || null;
    }

    const club = await prisma.club.update({ where: { id: clubId }, data });
    req.app.get('io')?.to(`club_${clubId}`).emit('club_updated', {
      clubId,
      chatMode: club.chatMode,
      slowModeSeconds: club.slowModeSeconds,
      name: club.name,
      description: club.description,
    });
    res.json({ chatMode: club.chatMode, slowModeSeconds: club.slowModeSeconds, name: club.name, description: club.description });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Üniversitende bu isimde başka bir kulüp var.' });
    console.error(err);
    res.status(500).json({ error: 'Ayarlar kaydedilemedi.' });
  }
});

// POST /api/clubs/:id/members/:userId/mute { minutes } — sustur (0 = susturmayı kaldır)
router.post('/:id/members/:userId/mute', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const targetUserId = Number(req.params.userId);
    const me = await requireManager(req, res, clubId);
    if (!me) return;

    const minutes = Number(req.body.minutes);
    if (![0, 60, 1440, 10080].includes(minutes)) return res.status(400).json({ error: 'Geçersiz süre.' });

    const target = await getMembership(clubId, targetUserId);
    if (!target || target.status !== 'active') return res.status(404).json({ error: 'Üye bulunamadı.' });
    if (target.role === 'owner') return res.status(400).json({ error: 'Kulüp başkanı susturulamaz.' });
    if (target.role === 'admin' && me.role !== 'owner') return res.status(403).json({ error: 'Yöneticileri yalnızca başkan susturabilir.' });

    const mutedUntil = minutes ? new Date(Date.now() + minutes * 60 * 1000) : null;
    await prisma.clubMembership.update({ where: { id: target.id }, data: { mutedUntil } });
    req.app.get('io')?.in(`user_${targetUserId}`).emit('club_muted', { clubId, mutedUntil });
    res.json({ mutedUntil });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem yapılamadı.' });
  }
});

// POST /api/clubs/:id/members/:userId/unban — engeli kaldır (tekrar katılabilir)
router.post('/:id/members/:userId/unban', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!(await requireManager(req, res, clubId))) return;
    const target = await getMembership(clubId, Number(req.params.userId));
    if (!target || target.status !== 'banned') return res.status(404).json({ error: 'Engellenmiş üye bulunamadı.' });
    // Kayıt silinir: kişi isterse yeniden katılır
    await prisma.clubMembership.delete({ where: { id: target.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Engel kaldırılamadı.' });
  }
});

// DELETE /api/clubs/:id/messages/:messageId — kendi mesajını ya da (yönetici) herhangi bir mesajı sil
router.delete('/:id/messages/:messageId', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const messageId = Number(req.params.messageId);
    const [membership, message] = await Promise.all([
      getMembership(clubId, req.userId),
      prisma.clubMessage.findUnique({ where: { id: messageId } }),
    ]);
    if (!message || message.clubId !== clubId) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    const own = message.senderId === req.userId;
    if (!membership || membership.status !== 'active' || (!own && !canManage(membership.role))) {
      return res.status(403).json({ error: 'Bu mesajı silemezsin.' });
    }
    await prisma.clubMessage.delete({ where: { id: messageId } });
    const club = await prisma.club.findUnique({ where: { id: clubId }, select: { pinnedMessageId: true } });
    if (club?.pinnedMessageId === messageId) await prisma.club.update({ where: { id: clubId }, data: { pinnedMessageId: null } });
    req.app.get('io')?.to(`club_${clubId}`).emit('club_message_deleted', { clubId, messageId, unpinned: club?.pinnedMessageId === messageId });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Mesaj silinemedi.' });
  }
});

// POST /api/clubs/:id/pin { messageId | null } — sohbetin üstüne duyuru sabitle / kaldır
router.post('/:id/pin', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!(await requireManager(req, res, clubId))) return;
    const messageId = req.body.messageId ? Number(req.body.messageId) : null;
    let message = null;
    if (messageId) {
      message = await prisma.clubMessage.findUnique({ where: { id: messageId }, include: { sender: { select: SENDER_SELECT } } });
      if (!message || message.clubId !== clubId) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    }
    await prisma.club.update({ where: { id: clubId }, data: { pinnedMessageId: messageId } });
    req.app.get('io')?.to(`club_${clubId}`).emit('club_pinned', { clubId, message });
    res.json({ pinnedMessage: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sabitleme yapılamadı.' });
  }
});

// POST /api/clubs/:id/polls { question, options[], multiple } — sohbete anket gönder
router.post('/:id/polls', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    if (!(await requireManager(req, res, clubId))) return;

    const question = String(req.body.question || '').trim();
    const options = [...new Set((req.body.options || []).map((o) => String(o).trim()).filter(Boolean))];
    if (question.length < 3 || question.length > 200) return res.status(400).json({ error: 'Soru 3–200 karakter olmalı.' });
    if (options.length < 2 || options.length > 6) return res.status(400).json({ error: 'En az 2, en fazla 6 farklı seçenek gir.' });
    if (options.some((o) => o.length > 80)) return res.status(400).json({ error: 'Seçenekler en fazla 80 karakter olabilir.' });

    const message = await prisma.clubMessage.create({
      data: {
        clubId,
        senderId: req.userId,
        content: question,
        poll: {
          create: {
            clubId,
            creatorId: req.userId,
            question,
            multiple: req.body.multiple === true,
            options: { create: options.map((text, position) => ({ text, position })) },
          },
        },
      },
      include: { sender: { select: SENDER_SELECT }, poll: { include: POLL_INCLUDE } },
    });

    const payload = { ...message, poll: serializePoll(message.poll, null) };
    req.app.get('io')?.to(`club_${clubId}`).emit('new_club_message', payload);
    res.status(201).json({ ...message, poll: serializePoll(message.poll, req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anket oluşturulamadı.' });
  }
});

// POST /api/clubs/:id/polls/:pollId/vote { optionIds: [] } — oy ver / oyu değiştir (boş dizi = geri çek)
router.post('/:id/polls/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const pollId = Number(req.params.pollId);
    const membership = await getMembership(clubId, req.userId);
    if (!membership || membership.status !== 'active') return res.status(403).json({ error: 'Oy vermek için kulübe üye olmalısın.' });

    const poll = await loadPoll(pollId);
    if (!poll || poll.clubId !== clubId) return res.status(404).json({ error: 'Anket bulunamadı.' });
    if (poll.closed) return res.status(400).json({ error: 'Bu anket kapandı.' });

    const validIds = new Set(poll.options.map((o) => o.id));
    let optionIds = [...new Set((req.body.optionIds || []).map(Number))].filter((id) => validIds.has(id));
    if (!poll.multiple) optionIds = optionIds.slice(0, 1);

    await prisma.$transaction([
      prisma.clubPollVote.deleteMany({ where: { pollId, userId: req.userId } }),
      ...optionIds.map((optionId) => prisma.clubPollVote.create({ data: { pollId, optionId, userId: req.userId } })),
    ]);

    await broadcastPoll(req.app.get('io'), clubId, pollId);
    res.json({ poll: serializePoll(await loadPoll(pollId), req.userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Oy kaydedilemedi.' });
  }
});

// POST /api/clubs/:id/polls/:pollId/close — anketi bitir (sonuçlar kalır)
router.post('/:id/polls/:pollId/close', requireAuth, async (req, res) => {
  try {
    const clubId = Number(req.params.id);
    const pollId = Number(req.params.pollId);
    if (!(await requireManager(req, res, clubId))) return;
    const poll = await prisma.clubPoll.findUnique({ where: { id: pollId } });
    if (!poll || poll.clubId !== clubId) return res.status(404).json({ error: 'Anket bulunamadı.' });
    await prisma.clubPoll.update({ where: { id: pollId }, data: { closed: true } });
    await broadcastPoll(req.app.get('io'), clubId, pollId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Anket kapatılamadı.' });
  }
});

module.exports = router;
