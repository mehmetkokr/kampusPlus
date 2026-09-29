// Yüklenen dosyaların gerçek türünü, yalnızca istemcinin gönderdiği
// Content-Type header'ına (mimetype) değil, dosyanın ikili imzasına
// (magic number) bakarak doğrular. mimetype istemci tarafından kolayca
// sahteleştirilebilir (ör. bir .exe dosyasını "image/png" olarak
// işaretleyip yükleyebilir) - bu katman buna karşı ek bir güvenlik sağlar.
//
// multer diskStorage kullandığı için dosya bu middleware çalıştığında
// zaten diske yazılmış olur; imza uyuşmuyorsa dosya silinir ve istek
// reddedilir.

const fs = require('fs');
const fileTypeChecker = require('file-type-checker');

// Beyan edilen mimetype -> file-type-checker'ın kabul edebileceği gerçek imza(lar).
const MIME_TO_SIGNATURES = {
  'image/jpeg': ['jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'audio/webm': ['webm'],
  'audio/ogg': ['ogg'],
  'audio/mpeg': ['mp3'],
  'audio/mp4': ['mp4', 'm4a', 'mov'],
  'audio/wav': ['wav'],
  'application/pdf': ['pdf'],
  'application/msword': ['doc'],
  // .docx aslında bir ZIP konteyneridir; imza kontrolünde 'zip' olarak görünür.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['zip'],
  'application/zip': ['zip'],
};

// Bu türlerin güvenilir bir ikili imzası yoktur (düz metin gibi). Bu türler
// için yalnızca multer'ın fileFilter'ındaki mimetype kontrolüyle yetinilir.
const SIGNATURELESS_MIMETYPES = new Set(['text/plain']);

function verifyFileSignature(req, res, next) {
  if (!req.file) return next();

  const declaredMime = req.file.mimetype;

  if (SIGNATURELESS_MIMETYPES.has(declaredMime)) {
    return next();
  }

  const expectedSignatures = MIME_TO_SIGNATURES[declaredMime];
  if (!expectedSignatures) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Desteklenmeyen dosya türü.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const detected = fileTypeChecker.detectFile(buffer);

    if (!detected || !expectedSignatures.includes(detected.extension)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'Dosya içeriği beyan edilen türle uyuşmuyor. Dosya bozuk veya yanıltıcı olabilir.',
      });
    }

    next();
  } catch (err) {
    console.error('Dosya imzası doğrulanamadı:', err);
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Dosya doğrulanamadı.' });
  }
}

module.exports = { verifyFileSignature };
