// Kullanıcıların yüklediği dosyalar sitenin kendi adresinden sunulur. Bir
// dosya tarayıcıda sayfa gibi açılabilirse (HTML, SVG...) içindeki betik
// sitenin yetkileriyle çalışır. Yeni yüklemelerde uzantı zaten doğrulanmış
// türden üretiliyor (lib/fileValidation.js); bu katman eski yüklemeler dahil
// her dosyayı güvenli başlıklarla sunar:
//   - Görsel, ses ve PDF tarayıcıda açılır, geri kalan her şey indirilir.
//   - Bilinmeyen uzantılar application/octet-stream olarak gider.
//   - Dosya yanıtlarında betik ve form çalışmaz (CSP sandbox; PDF görüntüleyici
//     sandbox içinde açılmadığı için PDF'te yalnızca betik/eklenti kapatılır).
const path = require('path');

const INLINE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
};

const DOWNLOAD_TYPES = {
  '.txt': 'text/plain; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.zip': 'application/zip',
};

const SANDBOX_CSP = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'; sandbox";
const PDF_CSP = "default-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

// Content-Disposition için güvenli dosya adı (RFC 6266 / 5987)
function dispositionName(name) {
  const clean = String(name || 'dosya').replace(/[\r\n"\\/]/g, '_').slice(0, 200);
  const ascii = clean.replace(/[^\x20-\x7e]/g, '_');
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

// Başlıkları ayarlar; döndürdüğü tür res.sendFile/express.static'e verilir
function applySafeFileHeaders(res, filePath, downloadName) {
  const ext = path.extname(filePath).toLowerCase();
  const inlineType = INLINE_TYPES[ext];
  const type = inlineType || DOWNLOAD_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', ext === '.pdf' ? PDF_CSP : SANDBOX_CSP);
  res.setHeader(
    'Content-Disposition',
    `${inlineType ? 'inline' : 'attachment'}; ${dispositionName(downloadName || path.basename(filePath))}`
  );
  return type;
}

// express.static için: yalnızca görseller herkese açık klasörden sunulur
const PUBLIC_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function publicUploadGuard(req, res, next) {
  if (!PUBLIC_EXTS.has(path.extname(req.path).toLowerCase())) return res.status(404).end();
  next();
}

function publicStaticHeaders(res, filePath) {
  applySafeFileHeaders(res, filePath);
  // Ad rastgele ve içerik değişmez: uzun süre önbellekte kalabilir
  res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
}

// res.sendFile ile özel dosya gönderir
function sendPrivateFile(res, filePath, downloadName) {
  const type = applySafeFileHeaders(res, filePath, downloadName);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  return res.sendFile(filePath, { headers: { 'Content-Type': type } });
}

module.exports = { applySafeFileHeaders, publicUploadGuard, publicStaticHeaders, sendPrivateFile, dispositionName };
