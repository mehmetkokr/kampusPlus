// Premium durumu her yerde aynı mantıkla kontrol edilsin diye tek bir yerde
// tanımlanır. isPremium true olsa bile premiumUntil geçmişte kalmışsa
// kullanıcı artık premium sayılmaz (cron olmadan da anlık doğru sonuç verir).
function isPremiumActive(user) {
  if (!user || !user.isPremium) return false;
  if (!user.premiumUntil) return true; // süresiz/manuel verilmiş premium
  return new Date(user.premiumUntil).getTime() > Date.now();
}

// Gerçek ödeme sağlayıcısı bağlanana kadar /api/premium/activate ödeme almadan
// premium açar. Bu yüzden yayında (production / Railway) varsayılan olarak
// kapalıdır; aksi halde herkes ücretsiz premium alabilirdi. Denemek için
// MOCK_PAYMENTS="true", yerelde kapatmak için MOCK_PAYMENTS="false" verilir.
function mockPaymentsEnabled(env = process.env) {
  if (env.MOCK_PAYMENTS !== undefined && env.MOCK_PAYMENTS !== '') return env.MOCK_PAYMENTS === 'true';
  const isProduction = env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME);
  return !isProduction;
}

module.exports = { isPremiumActive, mockPaymentsEnabled };
