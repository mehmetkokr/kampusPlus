// Okul e-postası kuralları: kayıt yalnızca seçilen üniversitenin alan adıyla
// (ya da alt alan adıyla, ör. ogr.mku.edu.tr) biten adreslerle yapılabilir.
const prisma = require('./prisma');

function isSchoolEmail(email, university) {
  const uniDomain = university?.emailDomain?.toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return !!(uniDomain && emailDomain && (emailDomain === uniDomain || emailDomain.endsWith('.' + uniDomain)));
}

// Adresin ait olduğu üniversite (en uzun eşleşen alan adı); yoksa null
async function findUniversityForEmail(email) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;
  const universities = await prisma.university.findMany({
    where: { emailDomain: { not: null } },
    select: { id: true, name: true, emailDomain: true },
  });
  return (
    universities
      .filter((u) => isSchoolEmail(email, u))
      .sort((a, b) => b.emailDomain.length - a.emailDomain.length)[0] || null
  );
}

module.exports = { isSchoolEmail, findUniversityForEmail };
