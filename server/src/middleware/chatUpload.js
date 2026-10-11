// Sohbet eklerinde (fotoğraf, sesli mesaj, dosya) kullanılan yükleme ayarları.
// Profil fotoğrafı/öğrenci belgesi için kullanılan upload.js'den ayrı tutulur
// çünkü burada daha geniş bir dosya türü seti ve daha büyük boyut sınırı gerekir.
const multer = require('multer');

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const crypto = require('crypto');
const { PRIVATE_UPLOADS } = require('../lib/paths');
const fs = require('fs');

// Sohbet ekleri (DM / grup / kulüp mesajları) herkese açık olmamalı — sadece
// ilgili sohbetin üyeleri routes/files.js üzerinden indirebilir.
const privateDir = PRIVATE_UPLOADS;

if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir, { recursive: true });

function makeStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    // Geçici, uzantısız rastgele ad: kalıcı adı ve uzantıyı doğrulanmış türe
    // göre lib/fileValidation.js (verifyUpload) verir
    filename: (req, file, cb) => cb(null, `tmp-${crypto.randomBytes(16).toString('hex')}`),
  });
}

const ALLOWED_TYPES = [
  // görsel
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // ses (tarayıcı MediaRecorder çıktıları)
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  // belge
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(badRequest('Desteklenmeyen dosya türü.'));
};

// Sohbet ekleri yalnızca özel klasöre yazılır (bkz. routes/messages.js,
// routes/clubs.js); herkese açık klasöre sohbet eki yazan bir yol yoktur.
const chatUpload = {
  private: multer({
    storage: makeStorage(privateDir),
    limits: { fileSize: 20 * 1024 * 1024, files: 1 }, // 20MB
    fileFilter,
  }),
};

module.exports = chatUpload;
