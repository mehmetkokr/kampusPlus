// Geri yükleme provası: yedek al → veriyi boz → yedekten geri yükle → veri
// geri gelmiş olmalı. Gerçek bir felakette komutun çalıştığından emin olmak için.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SERVER_DIR = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kampus-restore-'));
Object.assign(process.env, {
  DATABASE_URL: `file:${path.join(tmp, 'restore.db')}`,
  STORAGE_DIR: tmp,
  ADMIN_ALERTS: 'off',
});

execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { cwd: SERVER_DIR, env: process.env, stdio: 'ignore' });

test('yedekten geri yükleme: silinen veri geri gelir, önceki dosya saklanır', async () => {
  const prisma = require('../src/lib/prisma');
  const { createBackup } = require('../src/lib/backup');
  const uni = await prisma.university.create({ data: { name: 'Geri Yükleme Üni', emailDomain: 'gy.edu.tr' } });
  await prisma.user.create({ data: { email: 'kalici@gy.edu.tr', fullName: 'Kalıcı Öğrenci', passwordHash: 'x', universityId: uni.id } });

  const backup = await createBackup();
  await prisma.user.deleteMany({});
  assert.equal(await prisma.user.count(), 0);
  await prisma.$disconnect();

  // Komut satırındaki gibi ayrı süreçte geri yükle
  const out = execFileSync(process.execPath, ['scripts/restore-backup.js', backup.name, '--yes'], { cwd: SERVER_DIR, env: process.env, encoding: 'utf8' });
  assert.match(out, /Geri yüklendi/);

  const { PrismaClient } = require('@prisma/client');
  const fresh = new PrismaClient();
  const users = await fresh.user.findMany();
  await fresh.$disconnect();
  assert.deepEqual(users.map((u) => u.email), ['kalici@gy.edu.tr']);
  assert.ok(fs.readdirSync(tmp).some((f) => f.startsWith('restore.db.geri-yukleme-oncesi-')), 'önceki veritabanı saklanmalı');
});

test('geçersiz dosya geri yüklenmez', () => {
  const bad = path.join(tmp, 'bozuk.db.gz');
  fs.writeFileSync(bad, require('node:zlib').gzipSync(Buffer.from('bu bir veritabanı değil')));
  assert.throws(() => execFileSync(process.execPath, ['scripts/restore-backup.js', bad, '--yes'], { cwd: SERVER_DIR, env: process.env, stdio: 'pipe' }));
});

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
