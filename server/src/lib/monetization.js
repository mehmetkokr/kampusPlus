// Grup C — Ek gelir kanalları: Kulüp/etkinlik öne çıkarma, Profil boost,
// Öncelikli doğrulama. Üçü de aynı ödeme altyapısını paylaşır:
// PaymentLog tablosu (bkz. routes/premium.js'teki mock "activate" akışıyla
// birebir aynı desen) ve aynı "mock ödeme" yaklaşımı. Gerçek bir ödeme
// sağlayıcısı (iyzico vb.) bağlanınca sadece bu dosyadaki tek bir yerden
// PaymentLog.provider/providerRef doldurulacak şekilde genişletilebilir.
//
// Not: routes/premium.js'teki PLANS objesiyle kasıtlı olarak AYRI tutuldu -
// premium üyelik "abonelik" mantığında, buradakiler "tek seferlik satın alma"
// (bkz. plan.kind) mantığında. İkisi de aynı PaymentLog.plan alanına farklı
// anahtarlarla yazıyor, bu yüzden admin/PaymentLog dökümünde plan adından
// hangi ürün olduğu ayırt edilebiliyor.

const MONETIZATION_PLANS = {
  club_highlight_7d: { kind: 'club_highlight', days: 7, amount: 79.9, label: 'Kulüp Öne Çıkarma (7 gün)' },
  event_highlight_3d: { kind: 'event_highlight', days: 3, amount: 39.9, label: 'Etkinlik Öne Çıkarma (3 gün)' },
  profile_boost_24h: { kind: 'profile_boost', days: 1, amount: 24.9, label: 'Profil Boost (24 saat)' },
  profile_boost_72h: { kind: 'profile_boost', days: 3, amount: 59.9, label: 'Profil Boost (72 saat)' },
  priority_verification: { kind: 'priority_verification', days: null, amount: 19.9, label: 'Öncelikli Doğrulama' },
};

function isFutureDate(date) {
  return !!date && new Date(date).getTime() > Date.now();
}

function isBoostActive(user) {
  return isFutureDate(user?.boostedUntil);
}

function isHighlightActive(entity) {
  return isFutureDate(entity?.highlightedUntil);
}

// Bir plan satın alındığında var olan bitiş tarihinin üzerine ekler (yenileme
// mantığı premium.js -> /activate ile aynı): hâlâ aktifse üstüne ekle, değilse
// bugünden başlat.
function extendUntil(currentUntil, days) {
  const base = isFutureDate(currentUntil) ? new Date(currentUntil) : new Date();
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

module.exports = { MONETIZATION_PLANS, isBoostActive, isHighlightActive, extendUntil, isFutureDate };
