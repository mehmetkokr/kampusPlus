// Veritabanını bir yedekten geri yükler.
//
// Kullanım (sunucu klasöründe, SUNUCU DURDURULMUŞKEN):
//   npm run backup:restore -- kampus-20261011-033000.db.gz --yes
//   npm run backup:restore -- /indirilen/yol/kampus-....db.gz --yes
//
// Adımlar: yedek açılır ve geçerli bir SQLite dosyası olduğu doğrulanır →
// mevcut veritabanı yanına "<ad>.geri-yukleme-oncesi-<zaman>" olarak kopyalanır
// (geri dönülebilsin) → yedek yerine konur → yedek daha eski bir sürümdense
// eksik veritabanı değişiklikleri (migration) uygulanır.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const SERVER_DIR = path.join(__dirname, '..');

function dbPath() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:')) throw new Error('DATABASE_URL bir SQLite dosyası değil (file:...).');
  const p = url.slice(5);
  return path.isAbsolute(p) ? p : path.join(SERVER_DIR, 'prisma', p);
}

function backupFile(arg) {
  if (!arg) throw new Error('Yedek dosyasını belirt: npm run backup:restore -- <dosya> --yes');
  if (fs.existsSync(arg)) return path.resolve(arg);
  const storage = process.env.STORAGE_DIR || SERVER_DIR;
  const inBackups = path.join(storage, 'backups', path.basename(arg));
  if (fs.existsSync(inBackups)) return inBackups;
  throw new Error(`Yedek bulunamadı: ${arg}`);
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function restore(arg, { yes = false, migrate = true } = {}) {
  const source = backupFile(arg);
  const target = dbPath();
  const raw = source.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(source)) : fs.readFileSync(source);
  if (raw.subarray(0, 15).toString() !== 'SQLite format 3') throw new Error('Dosya geçerli bir SQLite yedeği değil.');
  if (!yes) {
    console.log(`Geri yüklenecek: ${source}\nHedef: ${target}\nSunucuyu durdurduğundan emin ol ve komutu --yes ile tekrar çalıştır.`);
    return { dryRun: true };
  }

  let safetyCopy = null;
  if (fs.existsSync(target)) {
    safetyCopy = `${target}.geri-yukleme-oncesi-${stamp()}`;
    fs.copyFileSync(target, safetyCopy);
  }
  // Eski yazma günlükleri yeni dosyayla karışmasın
  for (const ext of ['-wal', '-shm', '-journal']) fs.rmSync(target + ext, { force: true });
  fs.writeFileSync(target, raw);

  if (migrate) {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: SERVER_DIR,
      env: process.env,
      stdio: 'inherit',
    });
  }
  return { restored: true, source, target, safetyCopy };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const result = restore(args.find((a) => !a.startsWith('--')), { yes: args.includes('--yes') });
    if (result.restored) {
      console.log(`\nGeri yüklendi: ${result.source} → ${result.target}`);
      if (result.safetyCopy) console.log(`Önceki veritabanı saklandı: ${result.safetyCopy}`);
      console.log('Şimdi sunucuyu yeniden başlatabilirsin.');
    }
  } catch (err) {
    console.error(`Geri yükleme yapılamadı: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { restore };
