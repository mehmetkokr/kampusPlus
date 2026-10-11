// Fotoğraflardaki gömülü üst verinin (EXIF: GPS konumu, cihaz, tarih; XMP;
// IPTC; PNG metin blokları) sunucuda silinmesi. Tanışma uygulamasında bir
// fotoğrafın çekildiği yerin konumu kişinin evini gösterebilir. Tarayıcı
// fotoğrafı yeniden çizerken bunu zaten siler, ama API'ye doğrudan gönderilen
// dosyalar için bu son savunma katmanıdır. Görüntü verisine dokunulmaz.
const fs = require('fs');

// JPEG: SOS'a (görüntü verisi) kadar segmentler gezilir; APP1 (EXIF/XMP),
// APP13 (IPTC/Photoshop) ve COM (yorum) segmentleri atılır.
function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf; // beklenmeyen yapı: dokunma
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      parts.push(buf.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) {
      parts.push(buf.subarray(i)); // görüntü verisi ve sonrası olduğu gibi
      return Buffer.concat(parts);
    }
    const len = buf.readUInt16BE(i + 2);
    const end = i + 2 + len;
    if (len < 2 || end > buf.length) return buf;
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) parts.push(buf.subarray(i, end));
    i = end;
  }
  return buf;
}

// PNG: eXIf ve metin blokları (tEXt, zTXt, iTXt) atılır
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(buf) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.subarray(0, 8).equals(SIG)) return buf;
  const parts = [SIG];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) return buf;
    if (!PNG_DROP.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}

// WebP: EXIF ve XMP blokları atılır, VP8X başlığındaki bayraklar temizlenir
function stripWebp(buf) {
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return buf;
  const parts = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('latin1', i, i + 4);
    const size = buf.readUInt32LE(i + 4);
    const end = i + 8 + size + (size % 2);
    if (end > buf.length + 1) return buf;
    let chunk = buf.subarray(i, Math.min(end, buf.length));
    if (type === 'EXIF' || type === 'XMP ') {
      i = end;
      continue;
    }
    if (type === 'VP8X') {
      chunk = Buffer.from(chunk);
      chunk[8] &= ~(0x08 | 0x04); // EXIF ve XMP bayrakları
    }
    parts.push(chunk);
    i = end;
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4);
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

const STRIPPERS = { 'image/jpeg': stripJpeg, 'image/png': stripPng, 'image/webp': stripWebp };

function stripImageMetadata(buf, mimetype) {
  const fn = STRIPPERS[mimetype];
  return fn ? fn(buf) : buf;
}

// Diske yazılmış yüklemeyi yerinde temizler (değişiklik yoksa dosyaya dokunmaz)
function stripFileMetadata(filePath, mimetype) {
  if (!STRIPPERS[mimetype]) return false;
  const buf = fs.readFileSync(filePath);
  const out = stripImageMetadata(buf, mimetype);
  if (out.length === buf.length) return false;
  fs.writeFileSync(filePath, out);
  return true;
}

module.exports = { stripImageMetadata, stripFileMetadata, stripJpeg, stripPng, stripWebp };
