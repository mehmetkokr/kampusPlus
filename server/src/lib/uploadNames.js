// Yüklenen dosyaların adı ve uzantısı: uzantı ASLA kullanıcının gönderdiği
// dosya adından alınmaz, kabul edilen türden üretilir. Aksi halde içeriği
// geçerli bir PNG olan ama adı "x.html" olan bir dosya sitenin kendi
// adresinden HTML sayfası olarak açılabilir (depolanan XSS).
// Ad, tahmin edilemesin diye kriptografik rastgele değerle üretilir.
const crypto = require('crypto');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
  'text/plain': '.txt',
};

function safeUploadName(file) {
  const ext = MIME_EXT[file.mimetype] || '.bin';
  return `${file.fieldname}-${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;
}

// Tarayıcıda doğrudan gösterilmesi güvenli türler (görsel, ses, PDF). Diğer
// her şey indirilecek dosya olarak verilir.
const INLINE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.webm', '.ogg', '.mp3', '.m4a', '.wav', '.pdf']);

// Yüklenen dosyalar için ek güvenlik başlıkları: içerik koklama kapalı, sayfa
// olarak açılsa bile betik çalıştıramaz (sandbox); güvenli olmayan türler indirilir.
function setUploadHeaders(res, filePath) {
  const ext = require('path').extname(filePath).toLowerCase();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  if (!INLINE_EXT.has(ext)) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
  }
}

module.exports = { MIME_EXT, safeUploadName, setUploadHeaders, INLINE_EXT };
