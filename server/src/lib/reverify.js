// Yıllık öğrencilik doğrulaması. Okul e-postası kayıtta doğrulanır; mezun olan
// ya da okuldan ayrılan biri hesabını süresiz kullanmasın diye her yıl aynı
// adrese gelen kodla yeniden doğrulama istenir. 12. aydan itibaren uygulamada
// hatırlatma görünür, 30 günlük ek sürenin sonunda profil Keşfet ve Kart
// Modu'ndan gizlenir (hesap silinmez; doğrulayınca hemen geri gelir).
const DAY = 24 * 60 * 60 * 1000;
const REVERIFY_AFTER_MS = 365 * DAY;
const GRACE_MS = 30 * DAY;

// Doğrulamanın sayılmaya başladığı an (eski hesaplarda kayıt tarihi)
const verifiedAt = (user) => new Date(user.schoolEmailVerifiedAt || user.createdAt);

// 'ok' | 'due' (hatırlatma, hâlâ görünür) | 'expired' (listelerden gizli)
function reverifyStatus(user, now = Date.now()) {
  const age = now - verifiedAt(user).getTime();
  if (age < REVERIFY_AFTER_MS) return 'ok';
  return age < REVERIFY_AFTER_MS + GRACE_MS ? 'due' : 'expired';
}

function reverifyInfo(user, now = Date.now()) {
  const dueAt = new Date(verifiedAt(user).getTime() + REVERIFY_AFTER_MS);
  return { status: reverifyStatus(user, now), dueAt, hiddenAt: new Date(dueAt.getTime() + GRACE_MS) };
}

// Prisma koşulu: doğrulaması süresi geçmemiş kullanıcılar
function recentlyVerifiedWhere(now = Date.now()) {
  const cutoff = new Date(now - REVERIFY_AFTER_MS - GRACE_MS);
  return {
    OR: [{ schoolEmailVerifiedAt: { gte: cutoff } }, { schoolEmailVerifiedAt: null, createdAt: { gte: cutoff } }],
  };
}

module.exports = { reverifyStatus, reverifyInfo, recentlyVerifiedWhere, REVERIFY_AFTER_MS, GRACE_MS };
