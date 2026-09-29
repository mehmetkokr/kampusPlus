// Premium durumu her yerde aynı mantıkla kontrol edilsin diye tek bir yerde
// tanımlanır. isPremium true olsa bile premiumUntil geçmişte kalmışsa
// kullanıcı artık premium sayılmaz (cron olmadan da anlık doğru sonuç verir).
function isPremiumActive(user) {
  if (!user || !user.isPremium) return false;
  if (!user.premiumUntil) return true; // süresiz/manuel verilmiş premium
  return new Date(user.premiumUntil).getTime() > Date.now();
}

module.exports = { isPremiumActive };
