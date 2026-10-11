// Profil fotoğrafı ve öğrenci belgesi yükleme ayarları
const multer = require('multer');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('../lib/paths');
const fs = require('fs');
const { safeUploadName } = require('../lib/uploadNames');

// Herkese açık dosyalar (profil fotoğrafı, gönderi/hikaye görseli) — /uploads
// altında statik olarak servis edilir, kimlik doğrulama gerekmez.
const publicDir = PUBLIC_UPLOADS;
// Özel/hassas dosyalar (öğrenci belgesi gibi) — statik olarak servis edilmez,
// yalnızca routes/files.js üzerinden yetki kontrolüyle indirilebilir.
const privateDir = PRIVATE_UPLOADS;

for (const dir of [publicDir, privateDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(destDir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destDir),
    // Uzantı kabul edilen türden üretilir, kullanıcının dosya adından değil (lib/uploadNames.js)
    filename: (req, file, cb) => cb(null, safeUploadName(file)),
  });
}

// Herkese açık klasöre yalnızca görsel; PDF yalnızca özel klasöre (öğrenci belgesi)
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const imageFilter = (req, file, cb) => {
  if (IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Desteklenmeyen dosya türü. JPEG, PNG ya da WEBP yükle.'));
};
const fileFilter = (req, file, cb) => {
  if ([...IMAGE_TYPES, 'application/pdf'].includes(file.mimetype)) cb(null, true);
  else cb(new Error('Desteklenmeyen dosya türü. JPEG, PNG, WEBP veya PDF yükleyin.'));
};

const upload = multer({
  storage: makeStorage(publicDir),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB sınır
  fileFilter: imageFilter,
});

// Aynı kurallarla, ama özel klasöre yazan ayrı bir multer örneği
// (ör. öğrenci belgesi — herkese açık olmamalı).
upload.private = multer({
  storage: makeStorage(privateDir),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter,
});

module.exports = upload;
