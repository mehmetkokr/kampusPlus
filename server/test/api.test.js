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

// Giriş denemesi sınırına takılmamak için yeni testler token'ı doğrudan üretir
async function tokenFor(email) {
  const u = await prisma.user.findUnique({ where: { email } });
  return jwt.sign({ userId: u.id, tokenVersion: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' });
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

  // Adreste yalnızca dosya anahtarı geçer; oturum anahtarı adreste reddedilir
  const ft = (await api('GET', '/api/profile/me', { token })).data.fileToken;
  assert.ok(ft, '/profile/me dosya anahtarı döndürmeli');
  assert.equal((await api('GET', `/api/files/${docName}?ft=${ft}`)).status, 200);
  assert.equal((await api('GET', `/api/files/${docName}?token=${token}`)).status, 401);
  assert.equal((await api('GET', `/api/files/${docName}?ft=${token}`)).status, 401, 'oturum anahtarı dosya anahtarı yerine geçmemeli');
  // Dosya anahtarı API'de oturum yerine kullanılamaz
  assert.equal((await api('GET', '/api/profile/me', { token: ft })).status, 401);

  assert.equal((await api('POST', '/api/profile/logout-all', { token })).status, 200);
  assert.equal((await api('GET', '/api/profile/me', { token })).status, 401);
  assert.equal((await api('GET', `/api/files/${docName}?ft=${ft}`)).status, 401, 'çıkıştan sonra dosya anahtarı da geçersiz');
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

test('yedek: yönetici yedek alır, listeler ve indirir; öğrenci erişemez', async () => {
  await createUser('yonetici@test.edu.tr', { isAdmin: true });
  await createUser('ogrenci-yedek@test.edu.tr');
  const admin = await tokenFor('yonetici@test.edu.tr');
  const student = await tokenFor('ogrenci-yedek@test.edu.tr');

  assert.equal((await api('POST', '/api/admin/backups', { token: student })).status, 403);

  const created = await api('POST', '/api/admin/backups', { token: admin });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const list = await api('GET', '/api/admin/backups', { token: admin });
  assert.equal(list.data.backups[0].name, created.data.backup.name);

  const file = await fetch(`${BASE}/api/admin/backups/${created.data.backup.name}`, { headers: { Authorization: `Bearer ${admin}` } });
  assert.equal(file.status, 200);
  const bytes = Buffer.from(await file.arrayBuffer());
  assert.equal(bytes[0], 0x1f, 'gzip dosyası olmalı');
  assert.equal(bytes[1], 0x8b, 'gzip dosyası olmalı');
  // Gzip açılınca geçerli bir SQLite dosyası çıkmalı
  const db = require('node:zlib').gunzipSync(bytes);
  assert.equal(db.subarray(0, 15).toString(), 'SQLite format 3');

  assert.equal((await api('GET', '/api/admin/backups/..%2F..%2Fetc%2Fpasswd', { token: admin })).status, 404);
});

test('hata takibi: tarayıcı hatası birleşir, yönetici görür ve çözüldü işaretler', async () => {
  for (let i = 0; i < 2; i++) {
    const res = await api('POST', '/api/telemetry/errors', { body: { message: `Kart ${i + 3} yüklenemedi`, stack: 'Error\n    at Kart (app.js:1:2)', path: '/discover?x=1' } });
    assert.equal(res.status, 204);
  }
  assert.equal((await api('POST', '/api/telemetry/errors', { body: {} })).status, 400);

  const admin = await tokenFor('yonetici@test.edu.tr');
  const list = await api('GET', '/api/admin/errors?source=client', { token: admin });
  const row = list.data.errors.find((e) => e.message.startsWith('Kart'));
  assert.ok(row, 'hata kaydı listede olmalı');
  assert.equal(row.count, 2, 'sayı farkı olan aynı hata tek kayıtta birleşmeli');
  assert.equal(row.path, '/discover');

  const patched = await api('PATCH', `/api/admin/errors/${row.id}`, { token: admin, body: { resolved: true } });
  assert.equal(patched.data.error.resolved, true);
});

test('analitik: yalnızca izinli olaylar yazılır, yollar sadeleşir, huni hesaplanır', async () => {
  const res = await api('POST', '/api/telemetry/events', {
    body: {
      anonId: 'anon-test-12345',
      events: [
        { name: 'page_view', path: '/chat/42?tab=x' },
        { name: 'page_view', path: '/register' },
        { name: 'signup', path: '/' }, // yalnızca sunucu üretebilir
        { name: 'kotu_olay' },
      ],
    },
  });
  assert.equal(res.status, 204);
  const rows = await prisma.analyticsEvent.findMany({ where: { anonId: 'anon-test-12345' } });
  assert.deepEqual(rows.map((r) => r.path).sort(), ['/chat/:id', '/register']);
  assert.ok(rows.every((r) => r.name === 'page_view'));

  // Kayıt sonrası temel bilgileri tamamlama olayı
  await createUser('yeni-ogrenci@test.edu.tr');
  const token = await tokenFor('yeni-ogrenci@test.edu.tr');
  const basics = await api('PUT', '/api/profile/me/basics', { token, body: { birthDate: '2003-05-10', department: 'Fizik', classYear: 2 } });
  assert.equal(basics.status, 200, JSON.stringify(basics.data));
  const me = await prisma.user.findUnique({ where: { email: 'yeni-ogrenci@test.edu.tr' } });
  assert.equal(await prisma.analyticsEvent.count({ where: { name: 'onboarding_done', userId: me.id } }), 1);

  const admin = await tokenFor('yonetici@test.edu.tr');
  const report = await api('GET', '/api/admin/analytics?days=7', { token: admin });
  assert.equal(report.status, 200, JSON.stringify(report.data));
  assert.ok(report.data.kpis.visitors >= 1);
  assert.equal(report.data.funnel.find((s) => s.key === 'register_view').count, 1);
  assert.ok(report.data.pages.some((p) => p.path === '/chat/:id'));
});

test('anlık bildirim: açık anahtar verilir, geçersiz abonelik reddedilir, geçerlisi kaydedilir', async () => {
  const key = await api('GET', '/api/push/key');
  assert.equal(key.status, 200);
  assert.ok(key.data.publicKey.length > 40);

  await createUser('bildirim@test.edu.tr');
  const token = await tokenFor('bildirim@test.edu.tr');
  assert.equal((await api('POST', '/api/push/subscribe', { token, body: { endpoint: 'http://kotu' } })).status, 400);
  assert.equal((await api('POST', '/api/push/subscribe', { body: {} })).status, 401);

  const sub = { endpoint: 'https://push.example.test/abc', keys: { p256dh: 'BPk' + 'a'.repeat(84), auth: 'b'.repeat(22) } };
  assert.equal((await api('POST', '/api/push/subscribe', { token, body: { subscription: sub } })).status, 200);
  // Aynı cihaz tekrar kaydolunca çift kayıt oluşmaz
  assert.equal((await api('POST', '/api/push/subscribe', { token, body: { subscription: sub } })).status, 200);
  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: sub.endpoint } }), 1);

  assert.equal((await api('DELETE', '/api/push/subscribe', { token, body: { endpoint: sub.endpoint } })).status, 200);
  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: sub.endpoint } }), 0);
});

// ---------------------------------------------------------------
// Güvenlik sertleştirmesi
// ---------------------------------------------------------------
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function upload(url, token, field, buf, type, name) {
  const form = new FormData();
  form.append(field, new Blob([buf], { type }), name);
  const res = await fetch(BASE + url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
}

test('yükleme: uzantı istemciden alınmaz, yanlış tür ve sahte içerik reddedilir', async () => {
  await createUser('yukleme@test.edu.tr');
  const token = await tokenFor('yukleme@test.edu.tr');

  const ok = await upload('/api/profile/me/photos', token, 'photo', PNG_1PX, 'image/png', 'x.html');
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  const url = ok.data.photos.at(-1).url;
  assert.match(url, /^\/uploads\/photo-[0-9a-f]{32}\.png$/, 'ad rastgele, uzantı doğrulanmış türden');

  const served = await fetch(BASE + url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/png');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  assert.match(served.headers.get('content-security-policy'), /sandbox/);

  const pdf = await upload('/api/profile/me/photos', token, 'photo', Buffer.from('%PDF-1.4\n%%EOF'), 'application/pdf', 'a.pdf');
  assert.equal(pdf.status, 400, 'fotoğraf alanına PDF yüklenemez');
  const fake = await upload('/api/profile/me/photos', token, 'photo', Buffer.from('<script>alert(1)</script>'), 'image/png', 'a.png');
  assert.equal(fake.status, 400, 'image/png etiketli HTML reddedilmeli');
  const big = await upload('/api/profile/me/photos', token, 'photo', Buffer.alloc(6 * 1024 * 1024), 'image/png', 'b.png');
  assert.equal(big.status, 400, 'çok büyük dosya 400 dönmeli');
});

test('yükleme: herkese açık klasörden yalnızca görseller sunulur', async () => {
  fs.writeFileSync(path.join(tmp, 'uploads', 'eski.html'), '<script>alert(1)</script>');
  assert.equal((await fetch(`${BASE}/uploads/eski.html`)).status, 404);
  assert.equal((await fetch(`${BASE}/uploads/.gitkeep`)).status, 404);
});

test('kayıt kodu: kayıtlı ve kayıtsız adrese aynı yanıt; kayıtlıya kod üretilmez', async () => {
  const uni = await prisma.university.findFirst({ where: { emailDomain: 'test.edu.tr' } });
  await createUser('kayitli@test.edu.tr');
  const known = await api('POST', '/api/auth/register/send-code', { body: { email: 'kayitli@test.edu.tr', universityId: uni.id } });
  const unknown = await api('POST', '/api/auth/register/send-code', { body: { email: 'yeni@test.edu.tr', universityId: uni.id } });
  assert.equal(known.status, 200);
  assert.deepEqual(Object.keys(known.data).sort(), Object.keys(unknown.data).sort());
  assert.equal(known.data.sent, true);
  assert.equal(await prisma.emailVerificationCode.findUnique({ where: { email: 'kayitli@test.edu.tr' } }), null);
  assert.ok(await prisma.emailVerificationCode.findUnique({ where: { email: 'yeni@test.edu.tr' } }));
});

test('giriş ve şifremi unuttum: hatalı türde girdi 400, hesap varlığı mesajdan anlaşılmaz', async () => {
  const obj = await api('POST', '/api/auth/login', { body: { email: { not: '' }, password: ['x'] } });
  assert.equal(obj.status, 400);
  const a = await api('POST', '/api/auth/forgot-password', { body: { email: 'kayitli@test.edu.tr' } });
  const b = await api('POST', '/api/auth/forgot-password', { body: { email: 'hic-yok@test.edu.tr' } });
  assert.equal(a.status, 200);
  assert.deepEqual(a.data, b.data);
});

test('gerçek zamanlı bağlantı: boş/null olaylar sunucuyu düşürmez', async () => {
  const { io } = require('socket.io-client');
  await createUser('soket@test.edu.tr');
  const token = await tokenFor('soket@test.edu.tr');
  const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
  });
  for (const event of ['typing', 'mark_read', 'send_message', 'send_club_message']) {
    socket.emit(event);
    socket.emit(event, null);
  }
  await new Promise((r) => setTimeout(r, 500));
  socket.close();
  assert.equal((await fetch(`${BASE}/api/health`)).status, 200, 'sunucu ayakta kalmalı');
});

// ---------------------------------------------------------------
// Sızma testi bulguları: gizlilik, kapalı kampüs ve askıdaki hesaplar
// ---------------------------------------------------------------
async function otherCampus() {
  return (
    (await prisma.university.findFirst({ where: { emailDomain: 'diger.edu.tr' } })) ||
    prisma.university.create({ data: { name: 'Diğer Üniversite', emailDomain: 'diger.edu.tr' } })
  );
}
const READY = { department: 'Bölüm', classYear: 2, birthDate: new Date('2003-01-01'), schoolEmailVerifiedAt: new Date() };

test('profil: yönetici, askıdaki hesap ve Premium olmadan başka kampüs görüntülenemez; eşleşince görülür', async () => {
  const viewer = await createUser('pt-izleyici@test.edu.tr', READY);
  const admin = await createUser('pt-yonetici@test.edu.tr', { ...READY, isAdmin: true });
  const banned = await createUser('pt-askida@test.edu.tr', { ...READY, isBanned: true });
  const uni = await otherCampus();
  const far = await createUser('pt-uzak@diger.edu.tr', { ...READY, universityId: uni.id });
  const token = await tokenFor('pt-izleyici@test.edu.tr');

  assert.equal((await api('GET', `/api/users/${admin.id}`, { token })).status, 404);
  assert.equal((await api('GET', `/api/users/${banned.id}`, { token })).status, 404);
  const farRes = await api('GET', `/api/users/${far.id}`, { token });
  assert.equal(farRes.status, 403);
  assert.equal(farRes.data.code, 'PREMIUM_REQUIRED');

  await prisma.match.create({ data: { userAId: Math.min(viewer.id, far.id), userBId: Math.max(viewer.id, far.id) } });
  assert.equal((await api('GET', `/api/users/${far.id}`, { token })).status, 200, 'eşleşilen kişinin profili açılmalı');
});

test('beğenme ve takip: gizli, askıdaki ve başka kampüsteki kişiye yapılamaz; karşılık vermek serbest', async () => {
  await createUser('pt-begenen@test.edu.tr', READY);
  const hidden = await createUser('pt-gizli@test.edu.tr', { ...READY, profileVisibility: 'nobody' });
  const frozen = await createUser('pt-dondurulmus@test.edu.tr', { ...READY, isFrozen: true });
  const uni = await otherCampus();
  const far = await createUser('pt-uzak2@diger.edu.tr', { ...READY, universityId: uni.id });
  const me = await prisma.user.findUnique({ where: { email: 'pt-begenen@test.edu.tr' } });
  const token = await tokenFor('pt-begenen@test.edu.tr');

  assert.equal((await api('POST', `/api/matches/like/${hidden.id}`, { token })).status, 403);
  assert.equal((await api('POST', `/api/matches/like/${frozen.id}`, { token })).status, 404);
  assert.equal((await api('POST', `/api/matches/like/${far.id}`, { token })).status, 403);
  assert.equal((await api('POST', `/api/users/${hidden.id}/follow`, { token })).status, 403);
  assert.equal(await prisma.like.count({ where: { fromUserId: me.id } }), 0);

  // Başka kampüsten biri (Premium ile) beğendiyse karşılık verilebilir ve eşleşilir
  await prisma.like.create({ data: { fromUserId: far.id, toUserId: me.id } });
  const back = await api('POST', `/api/matches/like/${far.id}`, { token });
  assert.equal(back.status, 200);
  assert.equal(back.data.matched, true);
});

test('askıdaki hesabın gönderisi doğrudan da açılmaz, Keşfet\'te görünmez', async () => {
  const author = await createUser('pt-yazar@test.edu.tr', { ...READY, isBanned: true });
  await createUser('pt-okur@test.edu.tr', READY);
  const post = await prisma.post.create({ data: { authorId: author.id, caption: 'askidaki-gonderi', visibility: 'campus' } });
  const token = await tokenFor('pt-okur@test.edu.tr');
  assert.equal((await api('GET', `/api/posts/${post.id}`, { token })).status, 404);
  const home = await api('GET', '/api/discover/home', { token });
  assert.equal(home.status, 200);
  assert.ok(!JSON.stringify(home.data).includes('askidaki-gonderi'));
});

test('şikâyet: göremediği mesaj ya da var olmayan içerik şikâyet edilemez', async () => {
  const a = await createUser('pt-sohbet-a@test.edu.tr', READY);
  const b = await createUser('pt-sohbet-b@test.edu.tr', READY);
  await createUser('pt-yabanci2@test.edu.tr', READY);
  const match = await prisma.match.create({ data: { userAId: a.id, userBId: b.id } });
  const msg = await prisma.message.create({ data: { matchId: match.id, senderId: a.id, content: 'ozel' } });
  const stranger = await tokenFor('pt-yabanci2@test.edu.tr');
  assert.equal((await api('POST', '/api/reports', { token: stranger, body: { targetType: 'message', targetId: msg.id, reason: 'spam' } })).status, 404);
  assert.equal((await api('POST', '/api/reports', { token: stranger, body: { targetType: 'post', targetId: 999999, reason: 'spam' } })).status, 404);
  const own = await tokenFor('pt-sohbet-b@test.edu.tr');
  assert.equal((await api('POST', '/api/reports', { token: own, body: { targetType: 'message', targetId: msg.id, reason: 'spam' } })).status, 201);
});

test('veritabanı sınırını aşan numaralar 500 değil 404 döner', async () => {
  await createUser('pt-buyuk@test.edu.tr', READY);
  const token = await tokenFor('pt-buyuk@test.edu.tr');
  for (const url of ['/api/posts/99999999999999999999', '/api/users/4294967296', '/api/clubs/12345678901']) {
    assert.equal((await api('GET', url, { token })).status, 404, url);
  }
});

test('çevrimiçi durumu yalnızca eşleşilen kişilere gider', async () => {
  const { io } = require('socket.io-client');
  const a = await createUser('pt-cevrim-a@test.edu.tr', READY);
  const b = await createUser('pt-cevrim-b@test.edu.tr', READY);
  await createUser('pt-cevrim-c@test.edu.tr', READY);
  await prisma.match.create({ data: { userAId: Math.min(a.id, b.id), userBId: Math.max(a.id, b.id) } });
  const connect = async (email) => {
    const s = io(BASE, { auth: { token: await tokenFor(email) }, transports: ['websocket'] });
    await new Promise((res, rej) => { s.on('connect', res); s.on('connect_error', rej); });
    return s;
  };
  const partner = await connect('pt-cevrim-b@test.edu.tr');
  const stranger = await connect('pt-cevrim-c@test.edu.tr');
  const seen = { partner: [], stranger: [] };
  partner.on('presence_update', (p) => seen.partner.push(p.userId));
  stranger.on('presence_update', (p) => seen.stranger.push(p.userId));
  const me = await connect('pt-cevrim-a@test.edu.tr');
  await new Promise((r) => setTimeout(r, 500));
  [me, partner, stranger].forEach((s) => s.close());
  assert.ok(seen.partner.includes(a.id), 'eşleşilen kişi görmeli');
  assert.ok(!seen.stranger.includes(a.id), 'yabancı görmemeli');
});
