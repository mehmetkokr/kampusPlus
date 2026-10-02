// Yüklenen dosyaların klasörleri tek yerden yönetilir.
// Yerelde sunucu klasörünün içindedir (server/uploads, server/private-uploads).
// Railway gibi her dağıtımda kodu sıfırdan kuran ortamlarda STORAGE_DIR kalıcı
// diske (Volume, ör. /data) yönlendirilir; aksi halde her güncellemede
// fotoğraflar ve öğrenci belgeleri silinir.
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, '..', '..');
const PUBLIC_UPLOADS = path.join(STORAGE_DIR, 'uploads');
const PRIVATE_UPLOADS = path.join(STORAGE_DIR, 'private-uploads');

for (const dir of [PUBLIC_UPLOADS, PRIVATE_UPLOADS]) fs.mkdirSync(dir, { recursive: true });

module.exports = { STORAGE_DIR, PUBLIC_UPLOADS, PRIVATE_UPLOADS };
