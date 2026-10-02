// Sohbet eklerinde (fotoğraf, sesli mesaj, dosya) kullanılan yükleme ayarları.
// Profil fotoğrafı/öğrenci belgesi için kullanılan upload.js'den ayrı tutulur
// çünkü burada daha geniş bir dosya türü seti ve daha büyük boyut sınırı gerekir.
const multer = require('multer');
const path = require('path');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('../lib/paths');
const fs = require('fs');

const publicDir = PUBLIC_UPLOADS;
// Sohbet ekleri (DM / grup / kulüp mesajları) herkese açık olmamalı — sadece
// ilgili sohbetin üyeleri routes/files.js üzerinden indirebilir.
const privateDir = PRIVATE_UPLOADS;

for (const dir of [publicDir, privateDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname) || '';
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
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
  else cb(new Error('Desteklenmeyen dosya türü.'));
};

const chatUpload = multer({
  storage: makeStorage(publicDir),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter,
});

// Gerçek kullanım: tüm sohbet ekleri buraya taşındı (bkz. routes/messages.js,
// routes/clubs.js) — özel klasöre yazar.
chatUpload.private = multer({
  storage: makeStorage(privateDir),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

module.exports = chatUpload;
