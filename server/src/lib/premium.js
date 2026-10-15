// Premium kuralları tek yerde: planlar, günlük beğeni sınırı, boost ve onay
// sürümü. Arayüz bu değerleri /api/premium/plans ucundan okur; fiyat ya da
// hak değişince yalnızca burası güncellenir.

// Ücretsiz hesapta günlük beğeni hakkı
const FREE_DAILY_LIKES = 5;
// Boost: profil bu süre boyunca Kart Modu ve Keşfet'te öne çıkar
const BOOST_MINUTES = 30;

// dailyLikes: null = sınırsız. boosts: satın alınca eklenen boost hakkı.
// dailySuperLikes: günlük Süper Beğeni hakkı (ücretsiz hesapta yok).
const PLANS = {
  weekly: { days: 7, amount: 39.9, label: 'Haftalık', dailyLikes: 50, boosts: 1, dailySuperLikes: 1 },
  monthly: { days: 30, amount: 99.9, label: 'Aylık', dailyLikes: null, boosts: 3, dailySuperLikes: 3 },
  yearly: { days: 365, amount: 799.9, label: 'Yıllık', dailyLikes: null, boosts: 36, dailySuperLikes: 5 },
};
const PLAN_KEYS = Object.keys(PLANS);

// Kayıt / onay metinleri değişince artırılır; eski sürümü onaylamış
// kullanıcıdan uygulamaya girişte yeniden onay istenir.
const CONSENT_VERSION = '2026-10-15';

// Premium durumu her yerde aynı mantıkla kontrol edilsin diye tek bir yerde
// tanımlanır. isPremium true olsa bile premiumUntil geçmişte kalmışsa
// kullanıcı artık premium sayılmaz (cron olmadan da anlık doğru sonuç verir).
function isPremiumActive(user) {
  if (!user || !user.isPremium) return false;
  if (!user.premiumUntil) return true; // süresiz/manuel verilmiş premium
  return new Date(user.premiumUntil).getTime() > Date.now();
}

// Etkin plan anahtarı; Premium değilse null. Plan kaydı olmayan eski
// üyelikler aylık sayılır (sınırsız beğeni).
function activePlan(user) {
  if (!isPremiumActive(user)) return null;
  return PLANS[user.premiumPlan] ? user.premiumPlan : 'monthly';
}

// Günlük beğeni sınırı; null = sınırsız
function dailyLikeLimit(user) {
  const plan = activePlan(user);
  return plan ? PLANS[plan].dailyLikes : FREE_DAILY_LIKES;
}

// Türkiye saatiyle bugünün başlangıcı (UTC+3, yaz saati yok) ve bir sonraki gün
function istanbulDayStart(now = new Date()) {
  const OFFSET = 3 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + OFFSET);
  const startLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(startLocal - OFFSET);
}
function nextIstanbulDayStart(now = new Date()) {
  return new Date(istanbulDayStart(now).getTime() + 24 * 60 * 60 * 1000);
}

// Bugünkü beğeni kullanımı: { limit, used, left, resetsAt } (left: null = sınırsız).
// Süper Beğeniler ayrı sayılır, normal beğeni hakkından düşmez.
async function likeQuota(prisma, user, now = new Date()) {
  const limit = dailyLikeLimit(user);
  const used = await prisma.like.count({ where: { fromUserId: user.id, isSuper: false, createdAt: { gte: istanbulDayStart(now) } } });
  return { limit, used, left: limit === null ? null : Math.max(0, limit - used), resetsAt: nextIstanbulDayStart(now) };
}

// Günlük Süper Beğeni hakkı (ücretsiz: 0)
function dailySuperLikeLimit(user) {
  const plan = activePlan(user);
  return plan ? PLANS[plan].dailySuperLikes : 0;
}
async function superLikeQuota(prisma, user, now = new Date()) {
  const limit = dailySuperLikeLimit(user);
  const used = await prisma.like.count({ where: { fromUserId: user.id, isSuper: true, createdAt: { gte: istanbulDayStart(now) } } });
  return { limit, used, left: Math.max(0, limit - used), resetsAt: nextIstanbulDayStart(now) };
}

// Gizli mod: Premium'u süren ve gizli modu açık kullanıcılar, yalnızca
// beğendikleri kişilerin listelerinde görünür. Premium biterse mod kendiliğinden
// etkisiz kalır. viewerId'nin göreceği adayları süzen Prisma koşulu:
function incognitoVisibleTo(viewerId, now = new Date()) {
  return {
    OR: [
      { incognito: false },
      { isPremium: false },
      { premiumUntil: { lte: now } },
      { sentLikes: { some: { toUserId: viewerId } } },
    ],
  };
}

const isBoosting = (user, now = Date.now()) => Boolean(user?.boostUntil && new Date(user.boostUntil).getTime() > now);

// Gerçek ödeme sağlayıcısı bağlanana kadar /api/premium/activate ödeme almadan
// premium açar. Bu yüzden yayında (production / Railway) varsayılan olarak
// kapalıdır; aksi halde herkes ücretsiz premium alabilirdi. Denemek için
// MOCK_PAYMENTS="true", yerelde kapatmak için MOCK_PAYMENTS="false" verilir.
function mockPaymentsEnabled(env = process.env) {
  if (env.MOCK_PAYMENTS !== undefined && env.MOCK_PAYMENTS !== '') return env.MOCK_PAYMENTS === 'true';
  const isProduction = env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME);
  return !isProduction;
}

module.exports = {
  FREE_DAILY_LIKES,
  BOOST_MINUTES,
  PLANS,
  PLAN_KEYS,
  CONSENT_VERSION,
  isPremiumActive,
  activePlan,
  dailyLikeLimit,
  istanbulDayStart,
  nextIstanbulDayStart,
  likeQuota,
  dailySuperLikeLimit,
  superLikeQuota,
  incognitoVisibleTo,
  isBoosting,
  mockPaymentsEnabled,
};
