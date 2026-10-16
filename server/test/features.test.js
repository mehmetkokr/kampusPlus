// Güvenlik, sohbet ve yönetim özelliklerinin API testleri. api.test.js ile
// aynı şekilde geçici veritabanı ve ayrı sunucu süreci kullanır.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kampus-features-'));
const PORT = 4800 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;

Object.assign(process.env, {
  DATABASE_URL: `file:${path.join(tmp, 'test.db')}`,
  STORAGE_DIR: tmp,
  JWT_SECRET: 'test-secret-' + Math.random(),
  PORT: String(PORT),
  CLIENT_URL: 'http://localhost:5173',
  MOCK_PAYMENTS: 'true',
  SMTP_HOST: '',
  ADMIN_EMAIL: '',
  SEED_DEMO_USERS: '',
  LOGIN_RATE_LIMIT: '1000',
});

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: SERVER_DIR,
  env: process.env,
  stdio: 'ignore',
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const { codeAt } = require('../src/lib/totp');

let server;
const PASSWORD = 'gizli-sifre-123';

async function api(method, url, { token, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function createUser(email, extra = {}) {
  let uni = await prisma.university.findFirst();
  if (!uni) uni = await prisma.university.create({ data: { name: 'Test Üniversitesi', emailDomain: 'test.edu.tr' } });
  return prisma.user.create({
    data: {
      email,
      fullName: 'Test Kullanıcı',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      universityId: uni.id,
      verificationStatus: 'auto_verified',
      ...extra,
    },
  });
}

// Ayrı bir üniversite: destede yalnızca bu testin kullanıcıları olsun
async function isolatedUni(tag) {
  const u = await prisma.university.create({ data: { name: `İzole ${tag} Üniversitesi`, emailDomain: `${tag}.edu.tr` } });
  return u.id;
}

async function tokenFor(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  return jwt.sign({ userId: u.id, tokenVersion: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Keşfedilebilir iki öğrenci (aynı üniversite, başlangıç bilgileri tamam)
async function studentPair(prefix) {
  const extra = { department: 'Fizik', classYear: 2, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date() };
  const a = await createUser(`${prefix}-a@test.edu.tr`, extra);
  const b = await createUser(`${prefix}-b@test.edu.tr`, extra);
  return { a, b, ta: await tokenFor(a.email), tb: await tokenFor(b.email) };
}

const deckIds = (data) => (Array.isArray(data) ? data : data.users || data.candidates || []).map((u) => u.id);

test.before(async () => {
  server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, env: process.env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      // sunucu henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Test sunucusu açılmadı');
});

test.after(async () => {
  server?.kill();
  await prisma.$disconnect();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('şifre değiştirme: mevcut şifre doğrulanır, yeni oturum anahtarı verilir', async () => {
  const u = await createUser('sifre@test.edu.tr');
  const token = await tokenFor(u.email);
  assert.equal((await api('PUT', '/api/auth/password', { token, body: { currentPassword: 'yanlis', newPassword: 'yeni-sifre-123' } })).status, 400);
  assert.equal((await api('PUT', '/api/auth/password', { token, body: { currentPassword: PASSWORD, newPassword: 'kisa' } })).status, 400);
  const ok = await api('PUT', '/api/auth/password', { token, body: { currentPassword: PASSWORD, newPassword: 'yeni-sifre-123' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await api('GET', '/api/profile/me', { token })).status, 401, 'eski anahtar geçersiz olmalı');
  assert.equal((await api('GET', '/api/profile/me', { token: ok.data.token })).status, 200);
});

test('profil: hakkımda sınırı, sosyal bağlantı doğrulaması ve küfür gizleme', async () => {
  const u = await createUser('profil@test.edu.tr');
  const token = await tokenFor(u.email);
  assert.equal((await api('PUT', '/api/profile/me', { token, body: { bio: 'x'.repeat(301) } })).status, 400);
  assert.equal((await api('PUT', '/api/profile/me', { token, body: { instagramUrl: 'javascript:alert(1)' } })).status, 400);
  const res = await api('PUT', '/api/profile/me', { token, body: { bio: 'Selam, siktir git', instagramUrl: '@ece.yilmaz', twitterUrl: 'https://twitter.com/ece' } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  const saved = await prisma.user.findUnique({ where: { id: u.id } });
  assert.equal(saved.bio, 'Selam, s***** git');
  assert.equal(saved.instagramUrl, 'https://instagram.com/ece.yilmaz');
  assert.equal(saved.twitterUrl, 'https://x.com/ece');
});

test('Kart Modu: geç kaydedilir, Premium olmayan geri alamaz, Premium geri alır', async () => {
  const { a, b, ta } = await studentPair('kart');
  assert.ok(deckIds((await api('GET', '/api/profile/discover', { token: ta })).data).includes(b.id), 'başta destede olmalı');
  assert.equal((await api('POST', `/api/matches/pass/${b.id}`, { token: ta })).status, 200);
  assert.ok(!deckIds((await api('GET', '/api/profile/discover', { token: ta })).data).includes(b.id), 'geçilen kişi destede olmamalı');

  const undoFree = await api('POST', `/api/matches/undo/${b.id}`, { token: ta });
  assert.equal(undoFree.status, 403);
  assert.equal(undoFree.data.code, 'PREMIUM_REQUIRED');

  await prisma.user.update({ where: { id: a.id }, data: { isPremium: true, premiumUntil: new Date(Date.now() + 86400000) } });
  const undo = await api('POST', `/api/matches/undo/${b.id}`, { token: ta });
  assert.equal(undo.data.undone, 'pass');
  assert.ok(deckIds((await api('GET', '/api/profile/discover', { token: ta })).data).includes(b.id), 'geri alınca desteye dönmeli');
});

test('sohbet: tepki, sohbet listesi önizlemesi ve okunmamış sayısı', async () => {
  const { a, b, tb } = await studentPair('sohbet');
  const match = await prisma.match.create({ data: { userAId: Math.min(a.id, b.id), userBId: Math.max(a.id, b.id) } });
  const msg = await prisma.message.create({ data: { matchId: match.id, senderId: a.id, content: 'Merhaba, nasılsın?' } });

  const list = await api('GET', '/api/matches', { token: tb });
  const row = list.data.find((m) => m.matchId === match.id);
  assert.equal(row.lastMessage.preview, 'Merhaba, nasılsın?');
  assert.equal(row.unreadCount, 1);
  assert.equal((await api('GET', '/api/matches/unread-count', { token: tb })).data.chats, 1);

  assert.equal((await api('POST', `/api/messages/${match.id}/${msg.id}/reactions`, { token: tb, body: { emoji: '💩' } })).status, 400);
  const r1 = await api('POST', `/api/messages/${match.id}/${msg.id}/reactions`, { token: tb, body: { emoji: '❤️' } });
  assert.deepEqual(r1.data.reactions, [{ userId: b.id, emoji: '❤️' }]);
  const r2 = await api('POST', `/api/messages/${match.id}/${msg.id}/reactions`, { token: tb, body: { emoji: '❤️' } });
  assert.deepEqual(r2.data.reactions, [], 'aynı tepki tekrar gönderilince kalkmalı');

  await api('PUT', `/api/messages/${match.id}/read`, { token: tb });
  assert.equal((await api('GET', '/api/matches/unread-count', { token: tb })).data.chats, 0);

  const stranger = await createUser('yabanci-sohbet@test.edu.tr');
  const forbidden = await api('POST', `/api/messages/${match.id}/${msg.id}/reactions`, { token: await tokenFor(stranger.email), body: { emoji: '❤️' } });
  assert.equal(forbidden.status, 403);
});

test('yıllık doğrulama: süresi geçen gizlenir, kodla yenilenir', async () => {
  const { a, tb } = await studentPair('yillik');
  await prisma.user.update({ where: { id: a.id }, data: { schoolEmailVerifiedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000) } });
  const ta = await tokenFor(a.email);

  assert.equal((await api('GET', '/api/profile/me', { token: ta })).data.reverify.status, 'expired');
  assert.ok(!deckIds((await api('GET', '/api/profile/discover', { token: tb })).data).includes(a.id), 'süresi geçen kişi listelerde görünmemeli');

  assert.equal((await api('POST', '/api/auth/reverify/send-code', { token: ta })).status, 200);
  await prisma.emailVerificationCode.update({ where: { email: a.email }, data: { codeHash: crypto.createHash('sha256').update('654321').digest('hex') } });
  assert.equal((await api('POST', '/api/auth/reverify', { token: ta, body: { code: '000000' } })).status, 400);
  const ok = await api('POST', '/api/auth/reverify', { token: ta, body: { code: '654321' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.reverify.status, 'ok');
  assert.ok(deckIds((await api('GET', '/api/profile/discover', { token: tb })).data).includes(a.id), 'doğrulayınca geri gelmeli');
});

test('yönetici: iki adımlı giriş, işlem kaydı ve yasaklı kelime', async () => {
  const admin = await createUser('iki-adim@test.edu.tr', { isAdmin: true });
  const token = await tokenFor(admin.email);

  const setup = await api('POST', '/api/admin/2fa/setup', { token });
  assert.ok(setup.data.qr.startsWith('data:image/png;base64,'));
  const step = Math.floor(Date.now() / 30000);
  assert.equal((await api('POST', '/api/admin/2fa/enable', { token, body: { code: '000000' } })).status, 400);
  assert.equal((await api('POST', '/api/admin/2fa/enable', { token, body: { code: codeAt(setup.data.secret, step) } })).status, 200);

  const first = await api('POST', '/api/auth/login', { body: { email: admin.email, password: PASSWORD } });
  assert.equal(first.data.twoFactorRequired, true);
  assert.equal(first.data.token, undefined, 'kodsuz oturum anahtarı verilmemeli');
  assert.equal((await api('POST', '/api/auth/login', { body: { email: admin.email, password: PASSWORD, totpCode: '111111' } })).status, 401);
  const good = await api('POST', '/api/auth/login', { body: { email: admin.email, password: PASSWORD, totpCode: codeAt(setup.data.secret, step + 1) } });
  assert.ok(good.data.token, JSON.stringify(good.data));

  assert.equal((await api('POST', '/api/admin/banned-words', { token, body: { word: 'yasakkelime' } })).status, 201);
  const u = await createUser('kelime@test.edu.tr');
  await api('PUT', '/api/profile/me', { token: await tokenFor(u.email), body: { bio: 'bu bir yasakkelime denemesi' } });
  assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).bio, 'bu bir y********** denemesi');

  await new Promise((r) => setTimeout(r, 300)); // kayıt yanıttan hemen sonra yazılır
  const audit = await api('GET', '/api/admin/audit', { token });
  const actions = audit.data.entries.map((e) => e.action);
  assert.ok(actions.includes('Yasaklı kelime ekledi'), JSON.stringify(actions));
  assert.ok(actions.includes('İki adımlı doğrulamayı açtı'));
  assert.ok(audit.data.entries.every((e) => !String(e.details || '').includes('"code"')), 'kod kayda geçmemeli');
});

test('verilerimi indir: kendi verilerini verir, şifre özeti içermez, sık istenemez', async () => {
  const { a, ta } = await studentPair('veri');
  const res = await fetch(`${BASE}/api/profile/me/export`, { headers: { Authorization: `Bearer ${ta}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /kampus-verilerim-/);
  const data = await res.json();
  assert.equal(data.account.email, a.email);
  assert.equal(JSON.stringify(data).includes('passwordHash'), false);
  assert.equal((await api('GET', '/api/profile/me/export', { token: ta })).status, 429);
});

test('şikâyet açıklaması uzunluk sınırı', async () => {
  const { b, ta } = await studentPair('rapor');
  assert.equal((await api('POST', '/api/reports', { token: ta, body: { targetType: 'user', targetId: b.id, reason: 'spam', description: 'x'.repeat(1001) } })).status, 400);
  assert.equal((await api('POST', '/api/reports', { token: ta, body: { targetType: 'user', targetId: b.id, reason: 'spam', description: 'Rahatsız edici' } })).status, 201);
});

test('etkinlik hatırlatması: katılımcılara bir kez gider', async () => {
  const { a, b } = await studentPair('etkinlik');
  const club = await prisma.club.create({ data: { name: 'Hatırlatma Kulübü', universityId: a.universityId, creatorId: a.id } });
  const event = await prisma.event.create({
    data: { clubId: club.id, creatorId: a.id, title: 'Kodlama gecesi', startsAt: new Date(Date.now() + 60 * 60 * 1000), rsvps: { create: [{ userId: a.id }, { userId: b.id }] } },
  });
  const { sendEventReminders } = require('../src/lib/eventReminders');
  assert.equal(await sendEventReminders(null), 2);
  assert.equal(await sendEventReminders(null), 0, 'ikinci çalıştırmada tekrar gitmemeli');
  assert.equal(await prisma.notification.count({ where: { type: 'event_reminder', targetId: club.id } }), 2);
  assert.ok((await prisma.event.findUnique({ where: { id: event.id } })).reminderSentAt);
});

test('e-posta değiştirme: aynı okulun adresi, kodla doğrulanır, eskisiyle giriş biter', async () => {
  const u = await createUser('eski-adres@test.edu.tr');
  const token = await tokenFor(u.email);
  assert.equal((await api('POST', '/api/auth/email/send-code', { token, body: { newEmail: 'yeni@gmail.com', password: PASSWORD } })).status, 400, 'okul dışı adres reddedilmeli');
  assert.equal((await api('POST', '/api/auth/email/send-code', { token, body: { newEmail: 'yeni-adres@test.edu.tr', password: 'yanlis' } })).status, 400, 'şifre doğrulanmalı');
  await createUser('dolu-adres@test.edu.tr');
  assert.equal((await api('POST', '/api/auth/email/send-code', { token, body: { newEmail: 'dolu-adres@test.edu.tr', password: PASSWORD } })).status, 409);

  assert.equal((await api('POST', '/api/auth/email/send-code', { token, body: { newEmail: 'yeni-adres@test.edu.tr', password: PASSWORD } })).status, 200);
  await prisma.emailVerificationCode.update({ where: { email: 'yeni-adres@test.edu.tr' }, data: { codeHash: crypto.createHash('sha256').update('112233').digest('hex') } });
  assert.equal((await api('POST', '/api/auth/email', { token, body: { newEmail: 'yeni-adres@test.edu.tr', code: '000000' } })).status, 400);
  const ok = await api('POST', '/api/auth/email', { token, body: { newEmail: 'yeni-adres@test.edu.tr', code: '112233' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));

  assert.equal((await api('POST', '/api/auth/login', { body: { email: 'eski-adres@test.edu.tr', password: PASSWORD } })).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { body: { email: 'yeni-adres@test.edu.tr', password: PASSWORD } })).status, 200);
});

test('sağlık kontrolü veritabanını da yoklar', async () => {
  const res = await api('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.db, 'ok');
});

test('yönetici uyarısı: aynı tür uyarı aralık dolmadan tekrar gönderilmez', async () => {
  await createUser('uyari-yonetici@test.edu.tr', { isAdmin: true });
  const { alertAdmins, resetAlertThrottle } = require('../src/lib/alerts');
  resetAlertThrottle();
  const alert = { subject: 'Deneme uyarısı', text: 'Test', path: '/admin/system', throttleMs: 60000 };
  assert.equal(await alertAdmins('deneme', alert), true);
  assert.equal(await alertAdmins('deneme', alert), false, 'ikinci uyarı bastırılmalı');
  assert.equal(await alertAdmins('baska-tur', alert), true, 'farklı tür ayrı sayılmalı');
});

test('beğeni sınırı: ücretsiz günde 5, haftalık plan 50, aylık sınırsız; aynı kişiyi tekrar beğenmek hak harcamaz', async () => {
  const extra = { department: 'Kimya', classYear: 1, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date() };
  const me = await createUser('kota-ben@test.edu.tr', extra);
  const token = await tokenFor(me.email);
  const others = [];
  for (let i = 0; i < 7; i++) others.push(await createUser(`kota-${i}@test.edu.tr`, extra));

  for (let i = 0; i < 5; i++) {
    const r = await api('POST', `/api/matches/like/${others[i].id}`, { token });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.likes.left, 4 - i);
  }
  const again = await api('POST', `/api/matches/like/${others[0].id}`, { token });
  assert.equal(again.status, 200, 'zaten beğenilmiş kişi hak harcamaz');
  const sixth = await api('POST', `/api/matches/like/${others[5].id}`, { token });
  assert.equal(sixth.status, 429);
  assert.equal(sixth.data.code, 'LIKE_LIMIT');
  assert.ok(new Date(sixth.data.resetsAt) > new Date());

  await prisma.user.update({ where: { id: me.id }, data: { isPremium: true, premiumPlan: 'plus', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  const plus = await api('POST', `/api/matches/like/${others[5].id}`, { token });
  assert.equal(plus.status, 200);
  assert.equal(plus.data.likes.limit, 30);

  await prisma.user.update({ where: { id: me.id }, data: { premiumPlan: 'premium' } });
  const monthly = await api('POST', `/api/matches/like/${others[6].id}`, { token });
  assert.equal(monthly.data.likes.left, null);
});

test('boost: hak yoksa başlamaz, başlayınca hak düşer ve profil destenin başına gelir', async () => {
  const extra = { department: 'Tarih', classYear: 3, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date() };
  const viewer = await createUser('boost-bakan@test.edu.tr', extra);
  const filler = [];
  for (let i = 0; i < 3; i++) filler.push(await createUser(`boost-dolgu-${i}@test.edu.tr`, extra));
  const booster = await createUser('boost-ben@test.edu.tr', extra);
  const tBooster = await tokenFor(booster.email);

  const none = await api('POST', '/api/premium/boost', { token: tBooster });
  assert.equal(none.status, 402);
  assert.equal(none.data.code, 'NO_BOOSTS');

  await prisma.user.update({ where: { id: booster.id }, data: { boostCredits: 2 } });
  const started = await api('POST', '/api/premium/boost', { token: tBooster });
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal(started.data.boostCredits, 1);
  assert.ok(new Date(started.data.boostUntil) > new Date());
  assert.equal((await api('POST', '/api/premium/boost', { token: tBooster })).status, 409, 'aynı anda ikinci boost yok');

  const deck = (await api('GET', '/api/profile/discover', { token: await tokenFor(viewer.email) })).data;
  assert.equal(deckIds(deck)[0], booster.id, 'boosttaki profil destenin başında');
  assert.ok(!('boostUntil' in deck[0]) && !('boosted' in deck[0]), 'kimin boost aldığı açıklanmaz');
});

test('KVKK onayları: eski hesap onay ister, iki onay da zorunlu, ticari ileti izni ayrı', async () => {
  const u = await createUser('onay@test.edu.tr');
  const token = await tokenFor(u.email);
  assert.equal((await api('GET', '/api/profile/me', { token })).data.consentRequired, true);
  assert.equal((await api('PUT', '/api/profile/me/consents', { token, body: { terms: true, transfer: false } })).status, 400);
  const ok = await api('PUT', '/api/profile/me/consents', { token, body: { terms: true, transfer: true, marketing: true } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.consentRequired, false);
  const me = (await api('GET', '/api/profile/me', { token })).data;
  assert.equal(me.consentRequired, false);
  assert.equal(me.marketingConsent, true);
  const off = await api('PUT', '/api/profile/me/consents', { token, body: { marketing: false } });
  assert.equal(off.data.marketingConsent, false);
});

test('süper beğeni: ücretsize kapalı, Premium günlük hakla, karşı tarafa bildirim ve destede önde', async () => {
  const extra = { department: 'Felsefe', classYear: 2, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date(), swipeEnabled: true, universityId: await isolatedUni('super') };
  const a = await createUser('super-a@test.edu.tr', extra);
  const b = await createUser('super-b@test.edu.tr', extra);
  for (let i = 0; i < 3; i++) await createUser(`super-dolgu-${i}@test.edu.tr`, extra);
  const ta = await tokenFor(a.email);

  const free = await api('POST', `/api/matches/like/${b.id}`, { token: ta, body: { super: true } });
  assert.equal(free.status, 403);
  assert.equal(free.data.code, 'PREMIUM_REQUIRED');

  await prisma.user.update({ where: { id: a.id }, data: { isPremium: true, premiumPlan: 'plus', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  const ok = await api('POST', `/api/matches/like/${b.id}`, { token: ta, body: { super: true } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.superLikes.left, 0);
  assert.equal(ok.data.likes.used, 0, 'süper beğeni normal hakkı harcamaz');
  const n = await prisma.notification.findFirst({ where: { userId: b.id, type: 'super_like', actorId: a.id } });
  assert.ok(n, 'süper beğeni bildirimi gitmeli');

  const c = await createUser('super-c@test.edu.tr', extra);
  const limit = await api('POST', `/api/matches/like/${c.id}`, { token: ta, body: { super: true } });
  assert.equal(limit.status, 429);
  assert.equal(limit.data.code, 'SUPER_LIKE_LIMIT');

  const deck = (await api('GET', '/api/profile/discover', { token: await tokenFor(b.email) })).data;
  assert.equal(deck[0].id, a.id, 'süper beğenen destenin başında');
  assert.equal(deck[0].superLikedYou, true);
});

test('gizli mod: yalnızca Premium açar, açıkken yalnızca beğendiği kişiye görünür', async () => {
  const extra = { department: 'Mimarlık', classYear: 3, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date(), swipeEnabled: true, universityId: await isolatedUni('gizli') };
  const ghost = await createUser('gizli-ben@test.edu.tr', extra);
  const liked = await createUser('gizli-begendigim@test.edu.tr', extra);
  const other = await createUser('gizli-diger@test.edu.tr', extra);
  const tg = await tokenFor(ghost.email);

  assert.equal((await api('PUT', '/api/premium/incognito', { token: tg, body: { enabled: true } })).status, 403);
  await prisma.user.update({ where: { id: ghost.id }, data: { isPremium: true, premiumPlan: 'monthly', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  const on = await api('PUT', '/api/premium/incognito', { token: tg, body: { enabled: true } });
  assert.equal(on.status, 200);
  assert.equal(on.data.incognito, true);
  await api('POST', `/api/matches/like/${liked.id}`, { token: tg });

  const seenByOther = deckIds((await api('GET', '/api/profile/discover', { token: await tokenFor(other.email) })).data);
  const seenByLiked = deckIds((await api('GET', '/api/profile/discover', { token: await tokenFor(liked.email) })).data);
  assert.ok(!seenByOther.includes(ghost.id), 'gizli moddaki kişi başkasına görünmez');
  assert.ok(seenByLiked.includes(ghost.id), 'beğendiği kişiye görünür');
});

test('Kart Modu filtreleri yalnızca Premium için uygulanır', async () => {
  const base = { department: 'Hukuk', schoolEmailVerifiedAt: new Date(), swipeEnabled: true, universityId: await isolatedUni('filtre') };
  const me = await createUser('filtre-ben@test.edu.tr', { ...base, classYear: 2, birthDate: new Date('2003-01-01'), age: 23 });
  const y1 = await createUser('filtre-birinci@test.edu.tr', { ...base, classYear: 1, birthDate: new Date('2006-01-01'), age: 20 });
  const y4 = await createUser('filtre-dorduncu@test.edu.tr', { ...base, classYear: 4, birthDate: new Date('2001-01-01'), age: 25 });
  const token = await tokenFor(me.email);
  const free = deckIds((await api('GET', '/api/profile/discover?classYear=1', { token })).data);
  assert.ok(free.includes(y4.id), 'ücretsizde filtre yok sayılır');

  await prisma.user.update({ where: { id: me.id }, data: { isPremium: true, premiumPlan: 'monthly', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  const byClass = deckIds((await api('GET', '/api/profile/discover?classYear=1', { token })).data);
  assert.ok(byClass.includes(y1.id) && !byClass.includes(y4.id));
  const byAge = deckIds((await api('GET', '/api/profile/discover?minAge=24&maxAge=30', { token })).data);
  assert.ok(byAge.includes(y4.id) && !byAge.includes(y1.id));
});

test('Kart Modu cinsiyet eşleştirmesi: kadına erkek, erkeğe kadın; belirtmeyen herkesle', async () => {
  const base = { department: 'Kimya', classYear: 2, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date(), universityId: await isolatedUni('cinsiyet') };
  const f = await createUser('cins-kadin@test.edu.tr', { ...base, gender: 'female' });
  const m = await createUser('cins-erkek@test.edu.tr', { ...base, gender: 'male' });
  const f2 = await createUser('cins-kadin2@test.edu.tr', { ...base, gender: 'female' });
  const m2 = await createUser('cins-erkek2@test.edu.tr', { ...base, gender: 'male' });
  const u = await createUser('cins-belirsiz@test.edu.tr', { ...base, gender: 'unspecified' });
  const old = await createUser('cins-eski@test.edu.tr', base); // henüz seçmemiş eski hesap

  const ofF = deckIds((await api('GET', '/api/profile/discover', { token: await tokenFor(f.email) })).data);
  assert.ok(ofF.includes(m.id) && ofF.includes(m2.id) && ofF.includes(u.id) && ofF.includes(old.id));
  assert.ok(!ofF.includes(f2.id), 'kadına kadın gösterilmez');
  const ofM = deckIds((await api('GET', '/api/profile/discover', { token: await tokenFor(m.email) })).data);
  assert.ok(ofM.includes(f.id) && ofM.includes(u.id) && !ofM.includes(m2.id), 'erkeğe erkek gösterilmez');
  const ofU = deckIds((await api('GET', '/api/profile/discover', { token: await tokenFor(u.email) })).data);
  assert.ok([f.id, m.id, f2.id, m2.id].every((id) => ofU.includes(id)), 'belirtmeyen herkesi görür');

  const tOld = await tokenFor(old.email);
  assert.equal((await api('PUT', '/api/profile/me/basics', { token: tOld, body: {} })).data.field, 'gender', 'eski hesap cinsiyet seçmeden geçemez');
  assert.equal((await api('PUT', '/api/profile/me/gender', { token: tOld, body: { gender: 'x' } })).status, 400);
  assert.equal((await api('PUT', '/api/profile/me/gender', { token: tOld, body: { gender: 'male' } })).status, 200);
});

test('Kart Modu kampüsü: ücretli üye başka üniversiteye geçer, akış kendi kampüsünde kalır', async () => {
  const extra = { department: 'Mimarlık', classYear: 3, birthDate: new Date('2003-01-01'), age: 23, schoolEmailVerifiedAt: new Date() };
  const homeUni = await isolatedUni('kampus-ev');
  const otherUni = await isolatedUni('kampus-diger');
  const me = await createUser('kampus-ben@test.edu.tr', { ...extra, universityId: homeUni });
  const neighbor = await createUser('kampus-komsu@test.edu.tr', { ...extra, universityId: homeUni });
  const there = await createUser('kampus-orada@test.edu.tr', { ...extra, universityId: otherUni });
  const hidden = await createUser('kampus-gizli@test.edu.tr', { ...extra, universityId: otherUni, profileVisibility: 'university' });
  await prisma.post.create({ data: { authorId: there.id, caption: 'Diğer kampüsten gönderi' } });
  const token = await tokenFor(me.email);

  const free = await api('PUT', '/api/premium/campus', { token, body: { universityId: otherUni } });
  assert.equal(free.status, 403, 'ücretsiz hesap kampüs değiştiremez');

  await prisma.user.update({ where: { id: me.id }, data: { isPremium: true, premiumPlan: 'plus', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  const moved = await api('PUT', '/api/premium/campus', { token, body: { universityId: otherUni } });
  assert.equal(moved.status, 200, JSON.stringify(moved.data));
  assert.equal(moved.data.swipeUniversity.id, otherUni);

  const deck = deckIds((await api('GET', '/api/profile/discover', { token })).data);
  assert.ok(deck.includes(there.id), 'seçilen kampüsün öğrencileri görünür');
  assert.ok(!deck.includes(neighbor.id), 'kendi kampüsü desteden çıkar');
  assert.ok(!deck.includes(hidden.id), 'profilini yalnızca kendi kampüsüne açan görünmez');

  const feed = await api('GET', '/api/posts/feed', { token });
  const posts = Array.isArray(feed.data) ? feed.data : feed.data.posts || [];
  assert.ok(!posts.some((p) => p.author?.id === there.id || p.authorId === there.id), 'akış kendi kampüsünde kalır');

  const back = await api('PUT', '/api/premium/campus', { token, body: { universityId: null } });
  assert.equal(back.data.swipeUniversity, null);
  assert.ok(deckIds((await api('GET', '/api/profile/discover', { token })).data).includes(neighbor.id));

  // Üyelik bitince seçilen kampüs geçersiz olur
  await prisma.user.update({ where: { id: me.id }, data: { swipeUniversityId: otherUni, premiumUntil: new Date(Date.now() - 1000) } });
  const lapsed = deckIds((await api('GET', '/api/profile/discover', { token })).data);
  assert.ok(lapsed.includes(neighbor.id) && !lapsed.includes(there.id));
});

test('Plus ile Premium farkı: geri alma, seni beğenenler, gizli mod ve filtreler Premium’da', async () => {
  const { a, b, ta } = await studentPair('plus-fark');
  await prisma.user.update({ where: { id: a.id }, data: { isPremium: true, premiumPlan: 'plus', premiumUntil: new Date(Date.now() + 30 * 86400000) } });
  await prisma.like.create({ data: { fromUserId: b.id, toUserId: a.id } });
  const likes = await api('GET', '/api/matches/likes-received', { token: ta });
  assert.equal(likes.data.isPremium, false);
  assert.equal(likes.data.users.length, 0, 'Plus seni beğenenleri göremez');
  assert.equal((await api('PUT', '/api/premium/incognito', { token: ta, body: { enabled: true } })).status, 403);
  assert.equal((await api('POST', `/api/matches/undo/${b.id}`, { token: ta })).status, 403);
  const status = await api('GET', '/api/premium/status', { token: ta });
  assert.deepEqual(status.data.features, ['campus']);
});
