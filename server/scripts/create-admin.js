// Öğrenci hesaplarından bağımsız bir yönetici (admin) hesabı oluşturur.
// Kullanım: npm run admin:create
//
// - E-posta ve ad terminalde sorulur, şifre gizli girilir (ekranda görünmez).
// - Hesap öğrenci listelerinde (keşif, arama, Kart Modu) görünmez
//   (bkz. src/lib/privacy.js) ve Kart Modu kapalı başlar.
// - Aynı e-posta zaten varsa yalnızca admin yetkisi verilir, şifresi değişmez.
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');
const { normalizeEmail } = require('../src/lib/text');

const PASSWORD_MIN = 8;

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

// Yazılan karakterleri ekrana basmadan okur
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = normalizeEmail(await ask('Admin e-postası: '));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Geçerli bir e-posta adresi gir.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } });
    console.log(`✅ ${existing.fullName} (${email}) artık admin. Şifresi değişmedi.`);
    return;
  }

  const fullName = (await ask('Görünen ad (ör. kampüs· Destek): ')) || 'kampüs· Yönetim';
  const password = await askHidden(`Şifre (en az ${PASSWORD_MIN} karakter): `);
  if (password.length < PASSWORD_MIN) throw new Error(`Şifre en az ${PASSWORD_MIN} karakter olmalı.`);
  const again = await askHidden('Şifre (tekrar): ');
  if (again !== password) throw new Error('Şifreler eşleşmiyor.');

  // Her kullanıcının bir üniversitesi olmak zorunda; admin için önemi yok
  const university = await prisma.university.findFirst({ orderBy: { id: 'asc' } });
  if (!university) throw new Error('Veritabanında üniversite yok. Önce: npm run prisma:seed');

  const user = await prisma.user.create({
    data: {
      email,
      fullName,
      passwordHash: await bcrypt.hash(password, 10),
      universityId: university.id,
      isAdmin: true,
      verificationStatus: 'verified',
      profileVisibility: 'nobody',
      swipeEnabled: false,
    },
  });
  console.log(`✅ Admin hesabı oluşturuldu: ${user.fullName} (${user.email})`);
  console.log('   Giriş: /login → ardından /admin');
}

main()
  .catch((err) => {
    console.error('❌', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
