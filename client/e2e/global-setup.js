// Deneme verisi: bir üniversite, iki öğrenci; Mert, Ayşe'yi önceden beğenmiş
// (Ayşe beğenince eşleşme olur).
import { db, bcrypt, PASSWORD, UNI_DOMAIN, USERS } from './db.js';

export default async function globalSetup() {
  const prisma = db();
  const uni = await prisma.university.create({ data: { name: 'E2E Üniversitesi', emailDomain: UNI_DOMAIN } });
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const base = {
    passwordHash,
    universityId: uni.id,
    verificationStatus: 'auto_verified',
    department: 'Bilgisayar Mühendisliği',
    classYear: 3,
    birthDate: new Date('2003-04-12'),
    age: 23,
    intent: 'friendship',
    bio: 'Deneme hesabı',
    schoolEmailVerifiedAt: new Date(),
  };
  const ayse = await prisma.user.create({ data: { ...base, ...USERS.ayse } });
  const mert = await prisma.user.create({ data: { ...base, ...USERS.mert } });
  await prisma.like.create({ data: { fromUserId: mert.id, toUserId: ayse.id } });
  await prisma.$disconnect();
}
