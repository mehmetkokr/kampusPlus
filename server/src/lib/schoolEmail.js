// Okul e-postası kuralları: kayıt yalnızca seçilen üniversitenin alan adıyla
// (ya da alt alan adıyla, ör. ogr.mku.edu.tr) biten adreslerle yapılabilir.
function isSchoolEmail(email, university) {
  const uniDomain = university?.emailDomain?.toLowerCase();
  const emailDomain = email.split('@')[1]?.toLowerCase();
  return !!(uniDomain && emailDomain && (emailDomain === uniDomain || emailDomain.endsWith('.' + uniDomain)));
}

module.exports = { isSchoolEmail };
