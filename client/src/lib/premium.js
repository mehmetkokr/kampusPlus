// Üyelik planlarının (Plus ve Premium) arayüzde ortak gösterimi.
// Fiyat ve haklar sunucudan gelir (/api/premium/plans ve /status); burada
// biçimlendirme ve hangi planın hangi özelliği içerdiği var.
// Kurallar: server/src/lib/premium.js (PLANS.features ile aynı olmalı)

export const PLAN_ORDER = ['plus', 'premium'];

export const PERIOD_LABEL = { plus: '/ ay', premium: '/ ay' };

// Öne çıkan plan rozeti
export const PLAN_BADGE = { premium: 'EN KAPSAMLI' };

// Plana açık özellikler (sunucudaki PLANS.features)
export const PLAN_FEATURES = {
  plus: ['campus'],
  premium: ['campus', 'undo', 'seeLikes', 'filters', 'incognito'],
};

// Planların kartlarda yazan özellik listesi (kısa, yalnızca gerçekten çalışanlar)
export const PLAN_HIGHLIGHTS = {
  plus: ['Başka bir üniversitede Kart Modu', 'Aramada tüm üniversiteler'],
  premium: [
    'Plus’taki her şey',
    'Seni kimlerin beğendiğini gör',
    'Gizli mod',
    'Gelişmiş filtreler (yaş, sınıf, ne arıyor)',
    'Kart Modu’nda son kararını geri al',
  ],
};

// Kullanıcının etkin planı bu özelliği içeriyor mu
export function hasFeature(user, feature) {
  if (!user?.isPremium) return false;
  const plan = PLAN_FEATURES[user.premiumPlan] ? user.premiumPlan : 'premium';
  return PLAN_FEATURES[plan].includes(feature);
}

export const formatTL = (n) =>
  typeof n === 'number' ? `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

// Planın kısa hak listesi: "Günde 30 beğeni", "1 Boost"
export function planPerks(plan, t) {
  if (!plan) return [];
  return [
    plan.dailyLikes === null ? t('Sınırsız beğeni') : t('Günde {n} beğeni', { n: plan.dailyLikes }),
    t('Günde {n} Süper Beğeni', { n: plan.dailySuperLikes }),
    plan.boosts === 1 ? t('1 Boost') : t('{n} Boost', { n: plan.boosts }),
  ];
}

// "14:30" gibi saat ya da "yarın 00:00"
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
