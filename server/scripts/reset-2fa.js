// Telefonunu kaybeden yönetici için iki adımlı doğrulamayı sunucudan kapatır.
// Kullanım (sunucu klasöründe): npm run admin:reset-2fa -- yonetici@ornek.edu.tr
require('dotenv').config();
const prisma = require('../src/lib/prisma');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Kullanım: npm run admin:reset-2fa -- <e-posta>');
    process.exit(1);
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('Bu e-postayla bir hesap bulunamadı.');
    process.exit(1);
  }
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
  console.log(`${user.fullName} için iki adımlı doğrulama kapatıldı. Panelden yeniden kurabilir.`);
  await prisma.$disconnect();
})();
