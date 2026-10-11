// Yük testi: geçici bir veritabanına gerçekçi miktarda veri yüklenir, sunucu
// ayrı süreçte açılır ve sık kullanılan uçlara aynı anda çok sayıda istek
// gönderilir. Ek paket gerektirmez; mevcut veriye dokunmaz.
//
// Kullanım (sunucu klasöründe): npm run load-test
//   LOAD_USERS=300 LOAD_CONCURRENCY=50 LOAD_SECONDS=10 npm run load-test
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const SERVER_DIR = path.join(__dirname, '..');
const USERS = Number(process.env.LOAD_USERS) || 300;
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY) || 50;
const SECONDS = Number(process.env.LOAD_SECONDS) || 10;
const PORT = 4900 + Math.floor(Math.random() * 50);
const BASE = `http://127.0.0.1:${PORT}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kampus-load-'));
Object.assign(process.env, {
  DATABASE_URL: `file:${path.join(tmp, 'load.db')}`,
  STORAGE_DIR: tmp,
  PORT: String(PORT),
  JWT_SECRET: 'yuk-testi-' + Math.random(),
  CLIENT_URL: 'http://localhost:5173',
  API_RATE_LIMIT: '100000000',
  LOGIN_RATE_LIMIT: '100000000',
  ADMIN_ALERTS: 'off',
  SMTP_HOST: '',
  SEED_DEMO_USERS: '',
  ADMIN_EMAIL: '',
});

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: SERVER_DIR, env: process.env, stdio: 'ignore' });
const prisma = require('../src/lib/prisma');
const jwt = require('jsonwebtoken');

async function seed() {
  const uni = await prisma.university.create({ data: { name: 'Yük Testi Üniversitesi', emailDomain: 'yuk.edu.tr' } });
  const base = {
    passwordHash: 'x',
    universityId: uni.id,
    verificationStatus: 'auto_verified',
    classYear: 2,
    birthDate: new Date('2003-05-05'),
    age: 23,
    intent: 'friendship',
    bio: 'Yük testi öğrencisi',
    interests: 'Müzik, Spor, Kahve',
    schoolEmailVerifiedAt: new Date(),
  };
  await prisma.user.createMany({
    data: Array.from({ length: USERS }, (_, i) => ({ ...base, email: `ogrenci${i}@yuk.edu.tr`, fullName: `Öğrenci ${i}`, department: i % 2 ? 'Fizik' : 'Hukuk' })),
  });
  const users = await prisma.user.findMany({ select: { id: true, tokenVersion: true }, orderBy: { id: 'asc' } });
  const me = users[0];
  // İlk öğrencinin 40 eşleşmesi ve her birinde 30 mesaj; akışta 500 gönderi
  const others = users.slice(1, 41);
  for (const o of others) {
    const m = await prisma.match.create({ data: { userAId: me.id, userBId: o.id } });
    await prisma.message.createMany({
      data: Array.from({ length: 30 }, (_, k) => ({ matchId: m.id, senderId: k % 2 ? me.id : o.id, content: `Mesaj ${k}`, isRead: k < 25 })),
    });
  }
  await prisma.post.createMany({ data: Array.from({ length: 500 }, (_, i) => ({ authorId: users[i % users.length].id, caption: `Gönderi ${i}`, visibility: 'campus' })) });
  await prisma.like.createMany({ data: users.slice(41, 141).map((u) => ({ fromUserId: u.id, toUserId: me.id })) });
  const firstMatch = await prisma.match.findFirst({ where: { userAId: me.id } });
  const tokens = users.slice(0, 50).map((u) => jwt.sign({ userId: u.id, tokenVersion: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '1h' }));
  return { tokens, matchId: firstMatch.id, myToken: tokens[0] };
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function run(name, makeRequest) {
  const latencies = [];
  let errors = 0;
  const end = Date.now() + SECONDS * 1000;
  async function worker(i) {
    while (Date.now() < end) {
      const t0 = performance.now();
      try {
        const res = await makeRequest(i);
        await res.arrayBuffer();
        if (!res.ok) errors += 1;
      } catch {
        errors += 1;
      }
      latencies.push(performance.now() - t0);
    }
  }
  const started = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  const elapsed = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  return {
    name,
    rps: Math.round(latencies.length / elapsed),
    p50: Math.round(pct(latencies, 50)),
    p95: Math.round(pct(latencies, 95)),
    p99: Math.round(pct(latencies, 99)),
    errors,
    total: latencies.length,
  };
}

(async () => {
  console.log(`Veri hazırlanıyor: ${USERS} öğrenci, 40 eşleşme × 30 mesaj, 500 gönderi...`);
  const { tokens, matchId, myToken } = await seed();
  await prisma.$disconnect();

  const server = spawn(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, env: process.env, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch {
      // açılıyor
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const auth = (i) => ({ headers: { Authorization: `Bearer ${tokens[i % tokens.length]}` } });
  const scenarios = [
    ['Sağlık kontrolü (veritabanı dahil)', () => fetch(`${BASE}/api/health`)],
    ['Profilim (/profile/me)', (i) => fetch(`${BASE}/api/profile/me`, auth(i))],
    ['Keşfet ana sayfa', (i) => fetch(`${BASE}/api/discover/home`, auth(i))],
    ['Kart Modu destesi', (i) => fetch(`${BASE}/api/profile/discover`, auth(i))],
    ['Akış', (i) => fetch(`${BASE}/api/posts/feed`, auth(i))],
    ['Sohbet listesi (40 sohbet)', () => fetch(`${BASE}/api/matches`, { headers: { Authorization: `Bearer ${myToken}` } })],
    ['Sohbet geçmişi', () => fetch(`${BASE}/api/messages/${matchId}`, { headers: { Authorization: `Bearer ${myToken}` } })],
  ];

  console.log(`\n${CONCURRENCY} eşzamanlı kullanıcı, senaryo başına ${SECONDS} sn\n`);
  const rows = [];
  for (const [name, fn] of scenarios) {
    const r = await run(name, fn);
    rows.push(r);
    console.log(`${name.padEnd(36)} ${String(r.rps).padStart(6)} istek/sn   p50 ${String(r.p50).padStart(4)} ms   p95 ${String(r.p95).padStart(4)} ms   p99 ${String(r.p99).padStart(4)} ms   hata ${r.errors}/${r.total}`);
  }

  // Windows'ta süreç kapanana kadar veritabanı dosyası kilitli kalır
  await new Promise((resolve) => {
    server.once('exit', resolve);
    server.kill();
  });
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  const failed = rows.filter((r) => r.errors > 0);
  if (failed.length) {
    console.error(`\nHata dönen senaryolar: ${failed.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
