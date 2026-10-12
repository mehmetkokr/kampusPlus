// Admin paneli: sistem durumu (yedekler, hata kayıtları) ve kullanım analitiği.
// admin.js içinde requireAdmin'den SONRA bağlanır; buraya yalnızca adminler ulaşır.
const express = require('express');
const { isProduction, productionConfigWarnings } = require('../lib/siteConfig');
const { mailStatus } = require('../lib/mailer');
const fsp = require('fs/promises');
const prisma = require('../lib/prisma');
const { createBackup, listBackups, backupPath } = require('../lib/backup');
const { offsiteStatus } = require('../lib/offsiteBackup');
const { mockPaymentsEnabled } = require('../lib/premium');
const QRCode = require('qrcode');
const { generateSecret, otpauthUrl } = require('../lib/totp');
const { checkTotp, twoFactorRequired } = require('../lib/twoFactor');
const { invalidateBannedWords, normalizeWord, DEFAULT_ROOTS } = require('../lib/textSafety');

const { numericIdParams, optionalId } = require('../lib/idParams');
const router = express.Router();
numericIdParams(router);
const DAY = 24 * 60 * 60 * 1000;

function parseDays(v) {
  const n = Number(v);
  return [7, 30, 90].includes(n) ? n : 30;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function dbFilePath() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:')) return null;
  const p = url.slice(5);
  return require('path').isAbsolute(p) ? p : require('path').join(__dirname, '..', '..', 'prisma', p);
}

// ------------------------------------------------------------
// GET /admin/system — genel durum
// ------------------------------------------------------------
router.get('/system', async (req, res) => {
  try {
    const [backups, openErrors, pushDevices, pushUsers] = await Promise.all([
      listBackups(),
      prisma.errorLog.count({ where: { resolved: false } }),
      prisma.pushSubscription.count(),
      prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }),
    ]);
    const dbPath = dbFilePath();
    const dbSize = dbPath ? (await fsp.stat(dbPath).catch(() => null))?.size ?? null : null;
    res.json({
      database: { size: dbSize },
      backups: { count: backups.length, latest: backups[0] || null, offsite: offsiteStatus() },
      errors: { open: openErrors },
      push: { devices: pushDevices, users: pushUsers.length },
      sentry: Boolean(process.env.SENTRY_DSN),
      payments: { mock: mockPaymentsEnabled() },
      // Yayında eksik/yanlış ayarlar (SMTP, kalıcı disk, anahtar, site adresi)
      config: { production: isProduction(), warnings: productionConfigWarnings() },
      mail: mailStatus(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sistem durumu alınamadı.' });
  }
});

// ------------------------------------------------------------
// Yedekler
// ------------------------------------------------------------
router.get('/backups', async (req, res) => {
  try {
    res.json({ backups: await listBackups() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yedekler listelenemedi.' });
  }
});

router.post('/backups', async (req, res) => {
  try {
    const backup = await createBackup();
    const extra = backup.offsite === 'uploaded' ? ' Dış depoya da yüklendi.' : backup.offsite === 'failed' ? ' Dış depoya yüklenemedi; ayarları kontrol et.' : '';
    res.status(201).json({ backup, message: `Yedek alındı.${extra}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Yedek alınamadı.' });
  }
});

router.get('/backups/:name', (req, res) => {
  const p = backupPath(req.params.name);
  if (!p) return res.status(404).json({ error: 'Yedek bulunamadı.' });
  res.download(p, req.params.name);
});

// ------------------------------------------------------------
// Hata kayıtları
// ------------------------------------------------------------
router.get('/errors', async (req, res) => {
  try {
    const status = ['open', 'resolved', 'all'].includes(req.query.status) ? req.query.status : 'open';
    const source = ['server', 'client'].includes(req.query.source) ? req.query.source : undefined;
    const where = {
      ...(status === 'all' ? {} : { resolved: status === 'resolved' }),
      ...(source ? { source } : {}),
    };
    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({ where, orderBy: { lastSeen: 'desc' }, take: 100 }),
      prisma.errorLog.count({ where }),
    ]);
    res.json({ errors, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hata kayıtları alınamadı.' });
  }
});

router.patch('/errors/:id', async (req, res) => {
  try {
    const error = await prisma.errorLog.update({
      where: { id: Number(req.params.id) },
      data: { resolved: Boolean(req.body?.resolved) },
    });
    res.json({ error });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kayıt güncellenemedi.' });
  }
});

// Çözülmüş olarak işaretlenen kayıtları temizle
router.delete('/errors', async (req, res) => {
  try {
    const { count } = await prisma.errorLog.deleteMany({ where: { resolved: true } });
    res.json({ message: `${count} kayıt silindi.`, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kayıtlar silinemedi.' });
  }
});

// ------------------------------------------------------------
// GET /admin/analytics?days=7|30|90 — kullanım analitiği
// ------------------------------------------------------------
// Ziyaretçi kimliği: tarayıcının anonim kimliği, yoksa kullanıcı numarası
const who = (e) => (e.anonId ? `a:${e.anonId}` : e.userId ? `u:${e.userId}` : null);

router.get('/analytics', async (req, res) => {
  try {
    const days = parseDays(req.query.days);
    const now = new Date();
    const from = new Date(startOfDay(now).getTime() - (days - 1) * DAY);
    const range = { gte: from, lt: now };

    const events = await prisma.analyticsEvent.findMany({
      where: { createdAt: range },
      select: { name: true, path: true, anonId: true, userId: true, createdAt: true },
    });

    const uniq = (list) => new Set(list.map(who).filter(Boolean)).size;
    const byName = (name) => events.filter((e) => e.name === name);
    const views = byName('page_view');

    // Günlük seri: tekil ziyaretçi ve giriş yapmış aktif kullanıcı
    const series = [];
    const index = {};
    for (let i = 0; i < days; i++) {
      const row = { date: dayKey(new Date(from.getTime() + i * DAY)), visitors: new Set(), users: new Set() };
      index[row.date] = row;
      series.push(row);
    }
    for (const e of views) {
      const row = index[dayKey(e.createdAt)];
      if (!row) continue;
      const id = who(e);
      if (id) row.visitors.add(id);
      if (e.userId) row.users.add(e.userId);
    }

    // Kayıt hunisi (dönem içindeki tekil ziyaretçiler)
    const signups = byName('signup');
    const signupIds = [...new Set(signups.map((e) => e.userId).filter(Boolean))];
    const liked = signupIds.length
      ? await prisma.like.findMany({ where: { fromUserId: { in: signupIds } }, select: { fromUserId: true }, distinct: ['fromUserId'] })
      : [];
    const visitors = uniq(views);
    const funnel = [
      { key: 'visit', label: 'Siteyi ziyaret etti', count: visitors },
      { key: 'register_view', label: 'Kayıt sayfasını açtı', count: uniq(views.filter((e) => e.path === '/register')) },
      { key: 'code_sent', label: 'E-posta kodu istedi', count: uniq(byName('code_sent')) },
      { key: 'signup', label: 'Hesabını oluşturdu', count: signupIds.length },
      { key: 'onboarding', label: 'Profil bilgilerini tamamladı', count: uniq(byName('onboarding_done')) },
      { key: 'liked', label: 'İlk beğenisini yaptı', count: liked.length },
    ].map((s) => ({ ...s, rate: pct(s.count, visitors) }));

    // En çok görüntülenen sayfalar
    const pageMap = new Map();
    for (const e of views) {
      const key = e.path || '/';
      const cur = pageMap.get(key) || { path: key, views: 0, ids: new Set() };
      cur.views += 1;
      const id = who(e);
      if (id) cur.ids.add(id);
      pageMap.set(key, cur);
    }
    const pages = [...pageMap.values()]
      .map((p) => ({ path: p.path, views: p.views, visitors: p.ids.size }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);

    const [premiumBuys, pushUsers, activeUsers] = await Promise.all([
      prisma.paymentLog.count({ where: { createdAt: range, status: 'success' } }),
      prisma.pushSubscription.findMany({ select: { userId: true }, distinct: ['userId'] }),
      Promise.resolve(new Set(views.map((e) => e.userId).filter(Boolean)).size),
    ]);

    res.json({
      days,
      kpis: {
        visitors,
        activeUsers,
        signups: signupIds.length,
        pageViews: views.length,
        pwaInstalls: byName('pwa_installed').length,
        pushUsers: pushUsers.length,
      },
      series: series.map((r) => ({ date: r.date, visitors: r.visitors.size, users: r.users.size })),
      funnel,
      pages,
      premium: {
        paywallViews: uniq(byName('paywall_view')),
        checkoutClicks: uniq(byName('checkout_click')),
        purchases: premiumBuys,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analitik verileri alınamadı.' });
  }
});

// ------------------------------------------------------------
// Yasaklı kelimeler (varsayılan liste kodda, eklenenler veritabanında)
// ------------------------------------------------------------
router.get('/banned-words', async (req, res) => {
  try {
    const words = await prisma.bannedWord.findMany({ orderBy: { word: 'asc' } });
    res.json({ words, defaults: DEFAULT_ROOTS.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kelimeler alınamadı.' });
  }
});

router.post('/banned-words', async (req, res) => {
  try {
    const word = normalizeWord(String(req.body?.word || '').trim());
    if (word.length < 2 || word.length > 40 || /\s/.test(word)) {
      return res.status(400).json({ error: 'Tek bir kelime yaz (2–40 karakter, boşluksuz).' });
    }
    const created = await prisma.bannedWord.upsert({ where: { word }, create: { word }, update: {} });
    invalidateBannedWords();
    res.status(201).json({ word: created, message: `"${word}" eklendi.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kelime eklenemedi.' });
  }
});

router.delete('/banned-words/:id', async (req, res) => {
  try {
    await prisma.bannedWord.delete({ where: { id: Number(req.params.id) } });
    invalidateBannedWords();
    res.json({ message: 'Kelime kaldırıldı.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Kelime bulunamadı.' });
    console.error(err);
    res.status(500).json({ error: 'Kelime kaldırılamadı.' });
  }
});

// ------------------------------------------------------------
// Yönetici işlem kaydı
// ------------------------------------------------------------
router.get('/audit', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 50;
    const where = {};
    if (req.query.targetType) where.targetType = String(req.query.targetType);
    if (optionalId(req.query.targetId)) where.targetId = optionalId(req.query.targetId);
    const [entries, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.adminAuditLog.count({ where }),
    ]);
    res.json({ entries, total, page, pageSize });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'İşlem kaydı alınamadı.' });
  }
});

// ------------------------------------------------------------
// İki adımlı doğrulama (yalnızca kendi hesabı için)
// ------------------------------------------------------------
router.get('/2fa', async (req, res) => {
  const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { totpEnabled: true } });
  res.json({ enabled: Boolean(me?.totpEnabled), required: twoFactorRequired() });
});

// Kurulumu başlat: yeni gizli anahtar üretilir, henüz açılmaz (kod doğrulanınca açılır)
router.post('/2fa/setup', async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, totpEnabled: true } });
    if (me.totpEnabled) return res.status(400).json({ error: 'İki adımlı doğrulama zaten açık.' });
    const secret = generateSecret();
    await prisma.user.update({ where: { id: req.userId }, data: { totpSecret: secret, totpLastStep: null } });
    const url = otpauthUrl(secret, me.email);
    res.json({ secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kurulum başlatılamadı.' });
  }
});

router.post('/2fa/enable', async (req, res) => {
  try {
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, totpSecret: true, totpEnabled: true, totpLastStep: true } });
    if (!me.totpSecret) return res.status(400).json({ error: 'Önce kurulumu başlat.' });
    if (!(await checkTotp(me, req.body?.code))) return res.status(400).json({ error: 'Kod hatalı. Uygulamadaki güncel kodu yaz.' });
    await prisma.user.update({ where: { id: req.userId }, data: { totpEnabled: true } });
    res.json({ enabled: true, message: 'İki adımlı doğrulama açıldı. Bundan sonra girişte kod istenecek.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Açılamadı.' });
  }
});

router.post('/2fa/disable', async (req, res) => {
  try {
    if (twoFactorRequired()) return res.status(400).json({ error: 'Bu sunucuda yöneticiler için iki adımlı doğrulama zorunlu.' });
    const me = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, totpSecret: true, totpEnabled: true, totpLastStep: true } });
    if (!me.totpEnabled) return res.status(400).json({ error: 'İki adımlı doğrulama zaten kapalı.' });
    if (!(await checkTotp(me, req.body?.code))) return res.status(400).json({ error: 'Kod hatalı.' });
    await prisma.user.update({ where: { id: req.userId }, data: { totpEnabled: false, totpSecret: null, totpLastStep: null } });
    res.json({ enabled: false, message: 'İki adımlı doğrulama kapatıldı.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kapatılamadı.' });
  }
});

module.exports = router;
