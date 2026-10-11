// Profil fotoğrafı ve öğrenci belgesi yükleme ayarları
const multer = require('multer');

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const crypto = require('crypto');
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
    // Geçici, uzantısız rastgele ad: kalıcı adı ve uzantıyı doğrulanmış türe
    // göre lib/fileValidation.js (verifyUpload) verir
    filename: (req, file, cb) => cb(null, `tmp-${crypto.randomBytes(16).toString('hex')}`),
  });
}

// Herkese açık klasöre yalnızca görsel yazılır; PDF yalnızca özel klasöre
// (öğrenci belgesi) kabul edilir. Asıl kontrol imzaya bakan verifyUpload'dadır.
const imageFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
  else cb(badRequest('Desteklenmeyen dosya türü. JPEG, PNG veya WEBP yükleyin.'));
};
const documentFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) cb(null, true);
  else cb(badRequest('Desteklenmeyen dosya türü. JPEG, PNG, WEBP veya PDF yükleyin.'));
};

const upload = multer({
  storage: makeStorage(publicDir),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB sınır
  fileFilter: imageFilter,
});

// Özel klasöre yazan ayrı bir multer örneği (ör. öğrenci belgesi — herkese açık olmamalı)
upload.private = multer({
  storage: makeStorage(privateDir),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: documentFilter,
});

module.exports = upload;
