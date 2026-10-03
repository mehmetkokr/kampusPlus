// Admin paneli: pazarlama kampanyaları ve duyurular.
// admin.js içinde requireAdmin'den SONRA bağlanır.
//
// Kanallar:
//   notification → uygulama içi bildirim (zil + Bildirimler sayfası), anlık iletilir
//   banner       → uygulamanın üstünde kapatılabilir duyuru bandı (bkz. routes/announcements.js)
//   email        → hedef kitlenin okul e-postası (SMTP yoksa sunucu konsoluna yazılır)
const express = require('express');
const prisma = require('../lib/prisma');
const { sendMail } = require('../lib/mailer');
const { audienceWhere, normalizeAudience } = require('../lib/audience');
const { getOnlineUserIds } = require('../socket');

const router = express.Router();
const CHANNELS = ['notification', 'banner', 'email'];
const DAY = 24 * 60 * 60 * 1000;

// Bağlantı: uygulama içi yol (/clubs) ya da https:// adresi
function cleanLink(link) {
  const l = (link || '').trim();
  if (!l) return null;
  if (l.startsWith('/') && !l.startsWith('//')) return l.slice(0, 300);
  if (/^https:\/\/[^\s]+$/i.test(l)) return l.slice(0, 300);
  return undefined; // geçersiz
}

function validate(body) {
  const title = (body.title || '').trim();
  const text = (body.body || '').trim();
  const channels = [...new Set((body.channels || []).filter((c) => CHANNELS.includes(c)))];
  const link = cleanLink(body.link);
  const bannerDays = Math.min(Math.max(Number(body.bannerDays) || 7, 1), 30);
  if (!title || title.length > 80) return { error: 'Başlık 1–80 karakter olmalı.' };
  if (!text || text.length > 500) return { error: 'Mesaj 1–500 karakter olmalı.' };
  if (!channels.length) return { error: 'En az bir kanal seç.' };
  if (link === undefined) return { error: 'Bağlantı "/" ile başlayan bir sayfa yolu ya da https:// adresi olmalı.' };
  return { title, text, channels, link, bannerDays };
}

const notificationMessage = (c) => JSON.stringify({ title: c.title, body: c.text ?? c.body, link: c.link || null });

function emailContent({ title, text, link, fullName }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const url = link ? (link.startsWith('/') ? clientUrl + link : link) : clientUrl;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  return {
    subject: `kampüs·: ${title}`,
    text: `Merhaba ${fullName},\n\n${text}\n\n${url}\n\nBu e-postayı kampüs· hesabın olduğu için aldın.`,
    html: `<p>Merhaba ${esc(fullName)},</p><p>${esc(text).replace(/\n/g, '<br>')}</p><p><a href="${esc(url)}">${link ? 'Göz at' : "kampüs·'ü aç"}</a></p><p style="color:#888;font-size:12px">Bu e-postayı kampüs· hesabın olduğu için aldın.</p>`,
  };
}

// Kampanyaya ait bildirimleri, şu an bağlı olan alıcılara anında ilet
async function pushLive(io, campaignId) {
  if (!io) return;
  const online = getOnlineUserIds().map(Number);
  if (!online.length) return;
  const rows = await prisma.notification.findMany({
    where: { targetType: 'campaign', targetId: campaignId, userId: { in: online } },
    include: { actor: { select: { id: true, fullName: true, photoUrl: true } } },
  });
  rows.forEach((n) => io.to(`user_${n.userId}`).emit('new_notification', n));
}

async function sendEmails(recipients, content) {
  let sent = 0;
  for (const r of recipients) {
    try {
      const result = await sendMail({ to: r.email, ...emailContent({ ...content, fullName: r.fullName }) });
      if (result) sent++;
    } catch (err) {
      console.error('Kampanya e-postası gönderilemedi:', r.email, err.message);
    }
  }
  return sent;
}

// POST /admin/campaigns/preview — hedef kitle büyüklüğü + örnek kişiler
router.post('/campaigns/preview', async (req, res) => {
  try {
    const where = audienceWhere(req.body.audience);
    const [count, sample] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: { id: true, fullName: true, university: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    res.json({ count, sample });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hedef kitle hesaplanamadı.' });
  }
});

// GET /admin/campaigns — geçmiş kampanyalar ve performansları
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { createdBy: { select: { id: true, fullName: true } } },
    });
    const reads = campaigns.length
      ? await prisma.notification.groupBy({
          by: ['targetId'],
          where: { targetType: 'campaign', targetId: { in: campaigns.map((c) => c.id) }, isRead: true },
          _count: { _all: true },
        })
      : [];
    const readMap = Object.fromEntries(reads.map((r) => [r.targetId, r._count._all]));
    const now = new Date();
    res.json(
      campaigns.map((c) => ({
        ...c,
        audience: normalizeAudience(c.audience),
        channels: c.channels.split(','),
        readCount: readMap[c.id] || 0,
        readRate: c.recipientCount ? Math.round(((readMap[c.id] || 0) / c.recipientCount) * 1000) / 10 : 0,
        bannerActive: !!c.bannerUntil && new Date(c.bannerUntil) > now,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kampanyalar alınamadı.' });
  }
});

// POST /admin/campaigns — gönder (test: true ise yalnızca adminin kendisine)
router.post('/campaigns', async (req, res) => {
  try {
    const v = validate(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const io = req.app.get('io');

    if (req.body.test) {
      const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, fullName: true } });
      const notification = await prisma.notification.create({
        data: { userId: me.id, type: 'announcement', targetType: 'campaign', message: notificationMessage(v) },
        include: { actor: { select: { id: true, fullName: true, photoUrl: true } } },
      });
      io?.to(`user_${me.id}`).emit('new_notification', notification);
      if (v.channels.includes('email')) await sendEmails([me], { title: v.title, text: v.text, link: v.link });
      return res.json({ test: true, message: `Test bildirimi ${me.email} hesabına gönderildi.` });
    }

    const audience = normalizeAudience(req.body.audience);
    const recipients = await prisma.user.findMany({
      where: audienceWhere(audience),
      select: { id: true, email: true, fullName: true },
    });
    if (!recipients.length) return res.status(400).json({ error: 'Bu filtrelerle eşleşen öğrenci yok.' });

    const campaign = await prisma.campaign.create({
      data: {
        title: v.title,
        body: v.text,
        link: v.link,
        channels: v.channels.join(','),
        audience: JSON.stringify(audience),
        recipientCount: recipients.length,
        bannerUntil: v.channels.includes('banner') ? new Date(Date.now() + v.bannerDays * DAY) : null,
        createdById: req.userId,
      },
    });

    if (v.channels.includes('notification')) {
      await prisma.notification.createMany({
        data: recipients.map((r) => ({
          userId: r.id,
          type: 'announcement',
          targetType: 'campaign',
          targetId: campaign.id,
          message: notificationMessage(v),
        })),
      });
      await pushLive(io, campaign.id);
    }

    // E-postalar arka planda gider; sayı bitince kampanyaya yazılır
    if (v.channels.includes('email')) {
      sendEmails(recipients, { title: v.title, text: v.text, link: v.link })
        .then((sent) => prisma.campaign.update({ where: { id: campaign.id }, data: { emailCount: sent } }))
        .catch((err) => console.error('Kampanya e-posta sayısı yazılamadı:', err));
    }

    res.status(201).json({ campaign, message: `${recipients.length} öğrenciye gönderildi.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kampanya gönderilemedi.' });
  }
});

// POST /admin/campaigns/:id/stop-banner — duyuru bandını erken kapat
router.post('/campaigns/:id/stop-banner', async (req, res) => {
  try {
    const campaign = await prisma.campaign.update({ where: { id: Number(req.params.id) }, data: { bannerUntil: new Date() } });
    res.json({ campaign, message: 'Duyuru bandı kaldırıldı.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'Duyuru bandı kaldırılamadı.' });
  }
});

// DELETE /admin/campaigns/:id — geri çek: bildirimleri ve bandı kaldırır
// (gönderilmiş e-postalar geri alınamaz)
router.delete('/campaigns/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const removed = await prisma.notification.deleteMany({ where: { targetType: 'campaign', targetId: id } });
    await prisma.campaign.delete({ where: { id } });
    res.json({ message: `Kampanya geri çekildi (${removed.count} bildirim kaldırıldı).` });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'Kampanya geri çekilemedi.' });
  }
});

module.exports = router;
