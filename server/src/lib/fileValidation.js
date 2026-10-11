// Yüklenen dosyaların gerçek türünü, yalnızca istemcinin gönderdiği
// Content-Type header'ına (mimetype) değil, dosyanın ikili imzasına
// (magic number) bakarak doğrular. mimetype ve dosya adı istemci tarafından
// kolayca sahteleştirilebilir; bu katman buna karşı korur:
//
//  1. Her uç yalnızca kendi türlerini kabul eder (ör. profil fotoğrafı
//     yalnızca görsel; "photo" alanına PDF ya da HTML gönderilemez).
//  2. İmza beyan edilen türle uyuşmalıdır.
//  3. Dosya adı ve uzantı istemciden alınmaz: uzantı doğrulanmış türden
//     üretilir, ad rastgeledir. Böylece içi PNG olan "x.html" gibi bir dosya
//     tarayıcıda asla HTML olarak açılamaz (depolanmış XSS).
//  4. Görsellerdeki GPS/cihaz bilgisi silinir (lib/stripMetadata.js).
//
// multer diskStorage kullandığı için dosya bu middleware çalıştığında
// zaten diske yazılmış olur; reddedilen dosya silinir.

const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const fileTypeChecker = require('file-type-checker');
const { stripMetadata } = require('./stripMetadata');

// Beyan edilen mimetype -> kabul edilen imza(lar) ve diske yazılacak uzantı
const TYPES = {
  'image/jpeg': { signatures: ['jpeg'], ext: 'jpg' },
  'image/png': { signatures: ['png'], ext: 'png' },
  'image/webp': { signatures: ['webp'], ext: 'webp' },
  'image/gif': { signatures: ['gif'], ext: 'gif' },
  'audio/webm': { signatures: ['webm'], ext: 'webm' },
  'audio/ogg': { signatures: ['ogg'], ext: 'ogg' },
  'audio/mpeg': { signatures: ['mp3'], ext: 'mp3' },
  'audio/mp4': { signatures: ['mp4', 'm4a', 'mov'], ext: 'm4a' },
  'audio/wav': { signatures: ['wav'], ext: 'wav' },
  'application/pdf': { signatures: ['pdf'], ext: 'pdf' },
  'application/msword': { signatures: ['doc'], ext: 'doc' },
  // .docx aslında bir ZIP konteyneridir; imza kontrolünde 'zip' olarak görünür.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { signatures: ['zip'], ext: 'docx' },
  'application/zip': { signatures: ['zip'], ext: 'zip' },
  // Düz metnin ikili imzası yoktur; yalnızca .txt olarak ve indirme şeklinde sunulur
  'text/plain': { signatures: null, ext: 'txt' },
};

const KINDS = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  chatPhoto: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  audio: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'],
  studentDoc: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  chatFile: Object.keys(TYPES),
};

const reject = async (req, res, message) => {
  await fsp.unlink(req.file.path).catch(() => {});
  return res.status(400).json({ error: message });
};

// kind: KINDS anahtarlarından biri
function verifyUpload(kind) {
  const allowed = new Set(KINDS[kind]);
  if (!allowed.size) throw new Error(`Bilinmeyen yükleme türü: ${kind}`);

  return async function verifyUploadMiddleware(req, res, next) {
    if (!req.file) return next();
    const declared = req.file.mimetype;
    const type = TYPES[declared];
    if (!type || !allowed.has(declared)) return reject(req, res, 'Bu alan için desteklenmeyen dosya türü.');

    try {
      let buffer = await fsp.readFile(req.file.path);
      if (type.signatures) {
        const detected = fileTypeChecker.detectFile(buffer);
        if (!detected || !type.signatures.includes(detected.extension)) {
          return reject(req, res, 'Dosya içeriği beyan edilen türle uyuşmuyor. Dosya bozuk veya yanıltıcı olabilir.');
        }
      }

      if (['jpg', 'png', 'webp'].includes(type.ext)) {
        const cleaned = stripMetadata(buffer, type.ext);
        if (!cleaned) return reject(req, res, 'Görsel okunamadı. Dosya bozuk olabilir.');
        buffer = cleaned;
      }

      const filename = `${req.file.fieldname}-${crypto.randomBytes(16).toString('hex')}.${type.ext}`;
      const target = path.join(path.dirname(req.file.path), filename);
      await fsp.writeFile(target, buffer);
      await fsp.unlink(req.file.path).catch(() => {});
      Object.assign(req.file, { filename, path: target, size: buffer.length });
      next();
    } catch (err) {
      console.error('Dosya doğrulanamadı:', err);
      return reject(req, res, 'Dosya doğrulanamadı.');
    }
  };
}

module.exports = { verifyUpload, KINDS, TYPES };
