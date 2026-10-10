// API entegrasyon testleri: geçici bir SQLite veritabanı ve dosya klasörüyle
// gerçek sunucuyu ayrı bir süreçte başlatır, HTTP üzerinden dener.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kampus-test-'));
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;

// Modüller (prisma, paths) ortam değişkenlerini yüklenirken okur: önce ayarla
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
});

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
  cwd: SERVER_DIR,
  env: process.env,
  stdio: 'ignore',
});

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');
const { cleanupExpiredStories, sweepOrphanUploads } = require('../src/lib/uploads');

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

async function login(email) {
  const res = await api('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.token;
}

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

test('giriş: doğru şifreyle token, yanlış şifreyle 401', async () => {
  await createUser('giris@test.edu.tr');
  assert.ok(await login('giris@test.edu.tr'));
  const bad = await api('POST', '/api/auth/login', { body: { email: 'giris@test.edu.tr', password: 'yanlis-sifre' } });
  assert.equal(bad.status, 401);
});

test('korumalı uçlar token olmadan 401 döner', async () => {
  const res = await api('GET', '/api/profile/me');
  assert.equal(res.status, 401);
});

test('şifre sıfırlama token\'ı oturum token\'ı yerine kullanılamaz', async () => {
  const user = await createUser('sifirlama@test.edu.tr');
  const resetToken = jwt.sign(
    { userId: user.id, purpose: 'password_reset', tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
  assert.equal((await api('GET', '/api/profile/me', { token: resetToken })).status, 401);
  assert.equal((await api('GET', '/api/files/studentDoc-x.png', { token: resetToken })).status, 401);
});

test('tüm oturumlardan çıkış sonrası eski token ne API\'yi ne özel dosyaları açar', async () => {
  const user = await createUser('cikis@test.edu.tr');
  const token = await login('cikis@test.edu.tr');
  const docName = `studentDoc-${user.id}.png`;
  fs.writeFileSync(path.join(tmp, 'private-uploads', docName), 'belge');
  await prisma.user.update({ where: { id: user.id }, data: { studentDocUrl: `/api/files/${docName}` } });

  assert.equal((await api('GET', `/api/files/${docName}?token=${token}`)).status, 200);
  assert.equal((await api('POST', '/api/profile/logout-all', { token })).status, 200);
  assert.equal((await api('GET', '/api/profile/me', { token })).status, 401);
  assert.equal((await api('GET', `/api/files/${docName}?token=${token}`)).status, 401);
});

test('özel dosyayı yalnızca sahibi görebilir', async () => {
  const owner = await createUser('sahip@test.edu.tr');
  await createUser('yabanci@test.edu.tr');
  const docName = `studentDoc-${owner.id}-b.png`;
  fs.writeFileSync(path.join(tmp, 'private-uploads', docName), 'belge');
  await prisma.user.update({ where: { id: owner.id }, data: { studentDocUrl: `/api/files/${docName}` } });
  const stranger = await login('yabanci@test.edu.tr');
  assert.equal((await api('GET', `/api/files/${docName}`, { token: stranger })).status, 403);
});

test('premium: satın alma, iptal sonrası süre sonuna kadar devam', async () => {
  await createUser('premium@test.edu.tr');
  const token = await login('premium@test.edu.tr');

  const status = await api('GET', '/api/premium/status', { token });
  assert.equal(status.data.isPremium, false);
  assert.equal(status.data.checkoutAvailable, true);

  const bought = await api('POST', '/api/premium/activate', { token, body: { plan: 'monthly' } });
  assert.equal(bought.status, 200);
  assert.equal(bought.data.premiumAutoRenew, true);

  const cancelled = await api('POST', '/api/premium/cancel', { token });
  assert.equal(cancelled.status, 200);

  const me = await api('GET', '/api/profile/me', { token });
  assert.equal(me.data.isPremium, true, 'iptalden sonra premium süre dolana kadar sürmeli');
  assert.equal(me.data.premiumAutoRenew, false);
  assert.ok(new Date(me.data.premiumUntil) > new Date());

  const renewed = await api('POST', '/api/premium/activate', { token, body: { plan: 'monthly' } });
  assert.equal(renewed.data.premiumAutoRenew, true);
});

test('premium iptali: aktif üyelik yoksa 400', async () => {
  await createUser('ucretsiz@test.edu.tr');
  const token = await login('ucretsiz@test.edu.tr');
  assert.equal((await api('POST', '/api/premium/cancel', { token })).status, 400);
});

test('dosya temizliği: eski hikayeler ve yetim dosyalar silinir, kullanılanlar kalır', async () => {
  const user = await createUser('temizlik@test.edu.tr');
  const pub = path.join(tmp, 'uploads');
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const touchOld = (file) => fs.utimesSync(file, old / 1000, old / 1000);

  for (const name of ['used.jpg', 'orphan.jpg', 'fresh-orphan.jpg', 'story-old.jpg', 'story-reported.jpg']) {
    fs.writeFileSync(path.join(pub, name), 'x');
  }
  for (const name of ['used.jpg', 'orphan.jpg', 'story-old.jpg', 'story-reported.jpg']) touchOld(path.join(pub, name));

  await prisma.user.update({ where: { id: user.id }, data: { photoUrl: '/uploads/used.jpg' } });
  const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.story.create({ data: { authorId: user.id, imageUrl: '/uploads/story-old.jpg', expiresAt: longAgo } });
  const reported = await prisma.story.create({
    data: { authorId: user.id, imageUrl: '/uploads/story-reported.jpg', expiresAt: longAgo },
  });
  await prisma.report.create({ data: { reporterId: user.id, targetType: 'story', targetId: reported.id, reason: 'spam' } });

  assert.equal(await cleanupExpiredStories(), 1);
  await sweepOrphanUploads();

  const left = fs.readdirSync(pub).sort();
  assert.ok(left.includes('used.jpg'), 'kullanılan dosya silinmemeli');
  assert.ok(left.includes('fresh-orphan.jpg'), 'yeni yüklenen dosya silinmemeli');
  assert.ok(left.includes('story-reported.jpg'), 'şikâyetli hikaye silinmemeli');
  assert.ok(!left.includes('orphan.jpg'), 'yetim dosya silinmeli');
  assert.ok(!left.includes('story-old.jpg'), 'eski hikaye görseli silinmeli');
});

test('hesap silme: kullanıcının dosyaları diskten de kalkar', async () => {
  await createUser('silinen@test.edu.tr', { photoUrl: '/uploads/silinen.jpg' });
  fs.writeFileSync(path.join(tmp, 'uploads', 'silinen.jpg'), 'x');
  const token = await login('silinen@test.edu.tr');
  const res = await api('DELETE', '/api/profile/me', { token, body: { password: PASSWORD } });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  assert.equal(fs.existsSync(path.join(tmp, 'uploads', 'silinen.jpg')), false);
});
