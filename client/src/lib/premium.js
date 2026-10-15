// Premium planlarının arayüzde ortak gösterimi (fiyat, dönem, haklar).
// Değerler sunucudan gelir (/api/premium/plans ve /status); burada yalnızca
// biçimlendirme var. Kurallar: server/src/lib/premium.js

export const PLAN_ORDER = ['weekly', 'monthly', 'yearly'];

export const PERIOD_LABEL = { weekly: '/ hafta', monthly: '/ ay', yearly: '/ yıl' };

// Planlardaki öne çıkan rozetler
export const PLAN_BADGE = { monthly: 'EN POPÜLER', yearly: 'EN AVANTAJLI' };

export const formatTL = (n) =>
  typeof n === 'number' ? `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

// Planın kısa hak listesi: "Günde 50 beğeni", "3 Boost"
export function planPerks(plan, t) {
  if (!plan) return [];
  return [
    plan.dailyLikes === null ? t('Sınırsız beğeni') : t('Günde {n} beğeni', { n: plan.dailyLikes }),
    plan.boosts === 1 ? t('1 Boost') : t('{n} Boost', { n: plan.boosts }),
  ];
}

// Haftalık plana göre tasarruf yüzdesi (aylık/yıllık planı haftalık fiyatla kıyaslar)
export function savingVsWeekly(plans, key) {
  const weekly = plans?.find((p) => p.key === 'weekly');
  const plan = plans?.find((p) => p.key === key);
  if (!weekly || !plan || key === 'weekly') return null;
  const weeklyCost = (weekly.amount / weekly.days) * plan.days;
  const pct = Math.round((1 - plan.amount / weeklyCost) * 100);
  return pct > 0 ? pct : null;
}

// "14:30" gibi saat ya da "yarın 00:00"
export function formatTime(date) {
  return new Date(date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
