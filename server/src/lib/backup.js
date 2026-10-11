// Veritabanı yedeği: SQLite dosyasının tutarlı bir kopyası (VACUUM INTO)
// alınır, gzip ile sıkıştırılıp STORAGE_DIR/backups altına yazılır.
// Her gece çalışır, son BACKUP_KEEP (varsayılan 14) yedek saklanır.
// Yedekler sunucuyla aynı diskte durur; disk tümden kaybolursa onlar da gider.
// Bu yüzden BACKUP_S3_* ayarları doluysa her yedek ayrıca S3/R2 gibi bir dış
// depoya yüklenir (lib/offsiteBackup.js).
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const prisma = require('./prisma');
const { STORAGE_DIR } = require('./paths');
const { uploadBackup, offsiteConfig } = require('./offsiteBackup');

const BACKUP_DIR = path.join(STORAGE_DIR, 'backups');
const NAME_RE = /^kampus-\d{8}-\d{6}\.db\.gz$/;
const keepCount = () => Math.max(1, Number(process.env.BACKUP_KEEP) || 14);

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

let running = null;

async function createBackup() {
  // Aynı anda iki yedek alınmasın (gece görevi ile panelden elle alma çakışırsa)
  if (running) return running;
  running = (async () => {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const name = `kampus-${stamp()}.db.gz`;
    const raw = path.join(BACKUP_DIR, `${name}.tmp`);
    const target = path.join(BACKUP_DIR, name);
    try {
      // VACUUM INTO, uygulama çalışırken bile tutarlı tek dosyalık bir kopya üretir
      await prisma.$executeRawUnsafe(`VACUUM INTO '${raw.replace(/'/g, "''")}'`);
      await pipeline(fs.createReadStream(raw), zlib.createGzip({ level: 9 }), fs.createWriteStream(target));
    } finally {
      await fsp.unlink(raw).catch(() => {});
    }
    await pruneBackups();
    const stat = await fsp.stat(target);
    // Dış depoya yükleme başarısız olsa da yerel yedek geçerlidir
    let offsite = null;
    if (offsiteConfig()) {
      offsite = await uploadBackup(target, name)
        .then(() => 'uploaded')
        .catch((err) => {
          console.error('[yedek] Dış depoya yüklenemedi:', err);
          return 'failed';
        });
    }
    return { name, size: stat.size, createdAt: stat.mtime, offsite };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

async function listBackups() {
  const names = await fsp.readdir(BACKUP_DIR).catch(() => []);
  const items = await Promise.all(
    names
      .filter((n) => NAME_RE.test(n))
      .map(async (name) => {
        const stat = await fsp.stat(path.join(BACKUP_DIR, name));
        return { name, size: stat.size, createdAt: stat.mtime };
      })
  );
  return items.sort((a, b) => b.name.localeCompare(a.name));
}

async function pruneBackups() {
  const items = await listBackups();
  await Promise.all(items.slice(keepCount()).map((b) => fsp.unlink(path.join(BACKUP_DIR, b.name)).catch(() => {})));
}

// İndirme için güvenli yol: yalnızca yedek adı biçimine uyan dosyalar
function backupPath(name) {
  if (!NAME_RE.test(String(name))) return null;
  const p = path.join(BACKUP_DIR, path.basename(name));
  return fs.existsSync(p) ? p : null;
}

async function runBackup() {
  try {
    const b = await createBackup();
    console.log(`[yedek] ${b.name} (${Math.round(b.size / 1024)} KB) alındı${b.offsite === 'uploaded' ? ', dış depoya yüklendi' : ''}.`);
  } catch (err) {
    console.error('[yedek] Veritabanı yedeği alınamadı:', err);
  }
}

module.exports = { BACKUP_DIR, createBackup, listBackups, backupPath, runBackup };
