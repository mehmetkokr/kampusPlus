// Görsellerdeki gizli bilgileri (GPS konumu, cihaz modeli, çekim tarihi,
// yorumlar) siler. Paket gerektirmez: dosya yeniden kodlanmaz, yalnızca
// meta veri parçaları atlanır; görüntü verisi bit bit aynı kalır.
//   JPEG: APP1 (EXIF/XMP), APP3-APP13, APP15 ve yorum (COM) parçaları silinir;
//         yön bilgisi (Orientation) kaybolmasın diye yalnız onu taşıyan küçük
//         bir EXIF yeniden yazılır. JFIF (APP0), renk profili (APP2) ve
//         Adobe (APP14) korunur.
//   PNG:  eXIf, tEXt, zTXt, iTXt ve tIME parçaları silinir.
//   WebP: EXIF ve XMP parçaları silinir, VP8X bayrakları güncellenir.
// Tanınmayan ya da bozuk dosyada null döner (çağıran dosyayı reddeder).

function readOrientation(exif) {
  // exif: "Exif\0\0" + TIFF
  if (exif.length < 14 || exif.toString('latin1', 0, 4) !== 'Exif') return null;
  const tiff = exif.subarray(6);
  const order = tiff.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') return null;
  const le = order === 'II';
  const u16 = (o) => (le ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o) => (le ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
  try {
    const ifd = u32(4);
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

// Yalnızca yön bilgisini taşıyan en küçük EXIF parçası (APP1)
function orientationSegment(orientation) {
  const body = Buffer.alloc(6 + 8 + 2 + 12 + 4);
  body.write('Exif\0\0', 0, 'latin1');
  body.write('II', 6, 'latin1');
  body.writeUInt16LE(42, 8);
  body.writeUInt32LE(8, 10); // IFD0 uzaklığı
  body.writeUInt16LE(1, 14); // 1 kayıt
  body.writeUInt16LE(0x0112, 16); // Orientation
  body.writeUInt16LE(3, 18); // SHORT
  body.writeUInt32LE(1, 20);
  body.writeUInt16LE(orientation, 24);
  body.writeUInt32LE(0, 28); // sonraki IFD yok
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

function stripJpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const out = [buf.subarray(0, 2)];
  let orientation = null;
  let pos = 2;
  while (pos < buf.length) {
    if (buf[pos] !== 0xff) return null;
    let marker = buf[pos + 1];
    // Dolgu baytları (FF FF ...)
    while (marker === 0xff && pos + 2 < buf.length) {
      pos += 1;
      marker = buf[pos + 1];
    }
    // Uzunluksuz işaretler
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    if (marker === 0xd9) {
      out.push(buf.subarray(pos));
      break;
    }
    if (pos + 4 > buf.length) return null;
    const len = buf.readUInt16BE(pos + 2);
    const end = pos + 2 + len;
    if (len < 2 || end > buf.length) return null;
    const segment = buf.subarray(pos, end);

    // Görüntü verisinin başı: kalan her şey olduğu gibi kopyalanır
    if (marker === 0xda) {
      if (orientation && orientation !== 1) {
        // JFIF (APP0) varsa ilk parça olarak kalmalı
        const at = out[1] && out[1][1] === 0xe0 ? 2 : 1;
        out.splice(at, 0, orientationSegment(orientation));
      }
      out.push(buf.subarray(pos));
      return Buffer.concat(out);
    }

    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (marker === 0xe1) {
      orientation = orientation || readOrientation(segment.subarray(4));
    } else if (marker === 0xfe || (isApp && ![0xe0, 0xe2, 0xee].includes(marker))) {
      // yorum ve diğer uygulama parçaları atlanır
    } else if (marker === 0xe2 && segment.toString('latin1', 4, 15) !== 'ICC_PROFILE') {
      // APP2'de yalnızca renk profili tutulur (FlashPix vb. atlanır)
    } else {
      out.push(segment);
    }
    pos = end;
  }
  return null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  const out = [PNG_SIGNATURE];
  let pos = 8;
  while (pos + 12 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    const end = pos + 12 + len;
    if (end > buf.length) return null;
    if (!PNG_DROP.has(type)) out.push(buf.subarray(pos, end));
    pos = end;
    if (type === 'IEND') return Buffer.concat(out);
  }
  return null;
}

function stripWebp(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const chunks = [];
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const type = buf.toString('latin1', pos, pos + 4);
    const len = buf.readUInt32LE(pos + 4);
    const end = pos + 8 + len + (len % 2);
    if (pos + 8 + len > buf.length) return null;
    if (type !== 'EXIF' && type !== 'XMP ') {
      // Son parçada dolgu baytı eksik olabilir
      const chunk = Buffer.from(buf.subarray(pos, Math.min(end, buf.length)));
      if (type === 'VP8X' && chunk.length > 8) chunk[8] &= ~(0x08 | 0x04); // EXIF ve XMP bayrakları
      chunks.push(chunk);
    }
    pos = end;
  }
  const body = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  return Buffer.concat([head, body]);
}

const STRIPPERS = { jpg: stripJpeg, png: stripPng, webp: stripWebp };

// ext: 'jpg' | 'png' | 'webp'; başka türler olduğu gibi döner
function stripMetadata(buf, ext) {
  const strip = STRIPPERS[ext];
  if (!strip) return buf;
  try {
    return strip(buf);
  } catch {
    return null;
  }
}

module.exports = { stripMetadata, readOrientation };
