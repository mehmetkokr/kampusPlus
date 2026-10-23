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
  plus: ['campus', 'badge'],
  premium: ['campus', 'badge', 'priority', 'undo', 'seeLikes', 'filters', 'incognito'],
};

// Plus ve Premium karşılaştırması: yalnızca uygulamada gerçekten çalışan haklar.
// plus / premium: [çevrilecek metin, değerler] üreten fonksiyon (plan bilgisinden) ya da true / false
export const FEATURE_ROWS = [
  { key: 'likes', label: 'Günlük beğeni', desc: 'Kart Modu ve Keşfet’te', plus: (p) => ['{n}', { n: p?.dailyLikes ?? 30 }], premium: () => ['Sınırsız'] },
  { key: 'super', label: 'Süper Beğeni', desc: 'Karşı tarafa bildirim gider, destesinde ilk sen çıkarsın', plus: (p) => ['Günde {n}', { n: p?.dailySuperLikes ?? 1 }], premium: (p) => ['Günde {n}', { n: p?.dailySuperLikes ?? 5 }] },
  { key: 'boost', label: 'Boost', desc: 'Profilin 30 dakika kampüsünde en üstte', plus: (p) => ['Ayda {n}', { n: p?.boosts ?? 1 }], premium: (p) => ['Ayda {n}', { n: p?.boosts ?? 4 }] },
  { key: 'campus', label: 'Başka üniversitede Kart Modu', desc: 'İstediğin üniversitenin öğrencileriyle tanış', plus: true, premium: true },
  { key: 'search', label: 'Tüm üniversitelerde arama', desc: 'Aramada kampüs sınırı kalkar', plus: true, premium: true },
  { key: 'badge', label: 'Profil rozeti', desc: 'Profilinde ve kartında Plus / Premium rozeti', plus: true, premium: true },
  { key: 'seeLikes', label: 'Seni beğenenleri gör', desc: 'Listeden tek dokunuşla eşleş', plus: false, premium: true },
  { key: 'priority', label: 'Öncelikli görünürlük', desc: 'Destelerde Premium olmayanlardan önce çıkarsın', plus: false, premium: true },
  { key: 'filters', label: 'Gelişmiş filtreler', desc: 'Yaş, sınıf ve ne aradığına göre', plus: false, premium: true },
  { key: 'incognito', label: 'Gizli mod', desc: 'Yalnızca beğendiğin kişiler seni görür', plus: false, premium: true },
  { key: 'undo', label: 'Son kararı geri al', desc: 'Yanlışlıkla geçtiğin kişiyi geri getir', plus: false, premium: true },
];

// Plan kartlarında yazan özellik listesi (beğeni, Süper Beğeni, Boost ayrıca gösterilir)
export const PLAN_HIGHLIGHTS = {
  plus: ['Başka bir üniversitede Kart Modu', 'Tüm üniversitelerde arama', 'Profilinde Plus rozeti'],
  premium: [
    'Plus’taki her şey',
    'Seni kimlerin beğendiğini gör',
    'Destelerde öncelikli görünürlük',
    'Gelişmiş filtreler (yaş, sınıf, ne arıyor)',
    'Gizli mod',
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
