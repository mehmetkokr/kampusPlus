// Yayında ilk hesapları sunucu konsoluna girmeden oluşturmak için.
// Railway > Variables ekranına eklenen değerlere göre açılışta çalışır;
// hesap zaten varsa hiçbir şeye dokunmaz (şifresi de değişmez).
//
//   ADMIN_EMAIL + ADMIN_PASSWORD  → yönetici hesabı (öğrenci listelerinde görünmez)
//   SEED_DEMO_USERS=true          → mku1/mku2/mku3@ogr.mku.edu.tr demo öğrencileri
//                                   (şifre 12345678; gerçek kullanıcılar gelmeden kapatıp
//                                   hesapları admin panelinden silin)
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

const DEMO_USERS = [
  { email: 'mku1@ogr.mku.edu.tr', fullName: 'Ahmet Yılmaz', department: 'Bilgisayar Mühendisliği', classYear: 2, age: 21 },
  { email: 'mku2@ogr.mku.edu.tr', fullName: 'Zeynep Kaya', department: 'Tıp', classYear: 3, age: 22 },
  { email: 'mku3@ogr.mku.edu.tr', fullName: 'Emre Demir', department: 'İşletme', classYear: 1, age: 19 },
];

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;
  if (password.length < 8) {
    console.error('[bootstrap] ADMIN_PASSWORD en az 8 karakter olmalı; admin oluşturulmadı.');
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isAdmin) await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } });
    return;
  }
  const university = await prisma.university.findFirst({ orderBy: { id: 'asc' } });
  if (!university) return;
  await prisma.user.create({
    data: {
      email,
      fullName: 'kampüs· Yönetim',
      passwordHash: await bcrypt.hash(password, 10),
      universityId: university.id,
      isAdmin: true,
      verificationStatus: 'verified',
      profileVisibility: 'nobody',
      swipeEnabled: false,
    },
  });
  console.log(`[bootstrap] Admin hesabı oluşturuldu: ${email}`);
}

async function ensureDemoUsers() {
  if (process.env.SEED_DEMO_USERS !== 'true') return;
  const university = await prisma.university.findFirst({ where: { emailDomain: 'mku.edu.tr' } });
  if (!university) return;
  const passwordHash = await bcrypt.hash('12345678', 10);
  for (const u of DEMO_USERS) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) continue;
    await prisma.user.create({
      data: { ...u, passwordHash, universityId: university.id, verificationStatus: 'auto_verified', intent: 'friendship' },
    });
    console.log(`[bootstrap] Demo öğrenci oluşturuldu: ${u.email}`);
  }
}

async function bootstrapAccounts() {
  try {
    await ensureAdmin();
    await ensureDemoUsers();
  } catch (err) {
    console.error('[bootstrap] İlk hesaplar oluşturulamadı:', err.message);
  }
}

module.exports = { bootstrapAccounts };
