// Yaş, doğum tarihinden her istekte yeniden hesaplanır; böylece veritabanında
// saklanan eski bir "age" değeri yıllar içinde bayatlamaz.
const MIN_AGE = 18;
const MAX_AGE = 100;

function ageFromBirthDate(birthDate, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

// Doğum tarihi girişini doğrular: geçerli tarih, gelecekte değil, 18-100 yaş.
// Hata varsa { error }, yoksa { date, age } döner.
function parseBirthDate(input) {
  if (!input) return { error: 'Doğum tarihi zorunludur.' };
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return { error: 'Geçerli bir doğum tarihi giriniz.' };
  const age = ageFromBirthDate(date);
  if (age < MIN_AGE) return { error: `Kampüs+'a katılmak için en az ${MIN_AGE} yaşında olmalısın.` };
  if (age > MAX_AGE) return { error: 'Geçerli bir doğum tarihi giriniz.' };
  return { date, age };
}

// Profil nesnesindeki "age" alanını doğum tarihinden güncel olarak doldurur.
function withLiveAge(user) {
  if (!user) return user;
  const live = ageFromBirthDate(user.birthDate);
  return live === null ? user : { ...user, age: live };
}

module.exports = { ageFromBirthDate, parseBirthDate, withLiveAge, MIN_AGE };
