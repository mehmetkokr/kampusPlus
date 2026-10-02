// Profil fotoğrafı ve öğrenci belgesi yükleme ayarları
const multer = require('multer');
const path = require('path');
const { PUBLIC_UPLOADS, PRIVATE_UPLOADS } = require('../lib/paths');
const fs = require('fs');

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
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
  });
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Desteklenmeyen dosya türü. JPEG, PNG, WEBP veya PDF yükleyin.'));
  }
};

const upload = multer({
  storage: makeStorage(publicDir),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB sınır
  fileFilter,
});

// Aynı kurallarla, ama özel klasöre yazan ayrı bir multer örneği
// (ör. öğrenci belgesi — herkese açık olmamalı).
upload.private = multer({
  storage: makeStorage(privateDir),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;
