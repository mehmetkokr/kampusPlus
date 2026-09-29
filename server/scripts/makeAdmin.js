// Bir kullanıcıyı e-posta adresiyle admin yapmak için kullanılır.
// Kullanım: node scripts/makeAdmin.js ornek@universite.edu.tr
require('dotenv').config();
const prisma = require('../src/lib/prisma');

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Kullanım: node scripts/makeAdmin.js eposta@adresi.com');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`"${email}" adresiyle kayıtlı bir kullanıcı bulunamadı. Önce siteye kayıt olmalısınız.`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { isAdmin: true },
  });

  console.log(`✅ ${updated.fullName} (${updated.email}) artık admin.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
