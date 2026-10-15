import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Crown, Globe2, Search as SearchIcon, Loader2, Heart, Undo2, Rocket } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { track } from '../lib/telemetry';
import { PLAN_BADGE, PLAN_ORDER, PERIOD_LABEL, formatTL, planPerks, savingVsWeekly } from '../lib/premium';

// Uygulama içinde ücretli bir özelliğe tıklanınca her yerden aynı şekilde
// açılan ortak Premium penceresi: üç plan (haftalık / aylık / yıllık), her
// planın beğeni ve boost hakları, Mesafeli Satış Sözleşmesi onayı.
// contextText: kullanıcıyı buraya getiren aksiyona özel kısa açıklama.
export default function PaywallModal({ onClose, onUpgraded, contextText, hideScope = false }) {
  const { t } = useI18n();
  const { setUser, user } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState('monthly');
  const [info, setInfo] = useState(null);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    track('paywall_view');
    api
      .get('/premium/status')
      .then((res) => setInfo(res.data))
      .catch(() => {});
  }, []);

  // Ödeme sağlayıcısı bağlanana kadar yayında satın alma kapalıdır
  const checkoutAvailable = info?.checkoutAvailable !== false;
  const plans = PLAN_ORDER.map((key) => info?.plans?.find((p) => p.key === key)).filter(Boolean);
  const selected = plans.find((p) => p.key === plan);

  async function handleUpgrade() {
    if (!consent) return;
    track('checkout_click', { plan });
    setSaving(true);
    try {
      const res = await api.post('/premium/activate', { plan, consent: true });
      setUser((prev) => ({
        ...prev,
        isPremium: true,
        premiumUntil: res.data.premiumUntil,
        premiumAutoRenew: res.data.premiumAutoRenew,
        premiumPlan: res.data.plan,
        boostCredits: res.data.boostCredits,
      }));
      toast.success(t('Premium üyeliğin aktif! {n} Boost hakkın hesabına eklendi.', { n: selected?.boosts ?? 0 }));
      onUpgraded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet paywall-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="paywall-title">
        <div className="modal-header">
          <span />
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <X size={16} />
          </button>
        </div>

        <div className="paywall-icon">
          <Crown size={26} weight="fill" />
        </div>
        <h3 id="paywall-title">{t('kampüs· Premium')}</h3>
        <p className="paywall-modal-sub">
          {t(contextText || 'Bu içerik sadece Premium üyelere açık.')}
          {/* Kampüs sınırı yalnızca keşif/arama bağlamında anlamlı (geri alma ya da beğenenlerde değil) */}
          {!hideScope && user?.university?.name && <> {t('Şu an sadece {uni} içindeki kişileri görebiliyorsun.', { uni: user.university.name })}</>}
        </p>

        <ul className="paywall-feature-list">
          <li>
            <Globe2 size={16} /> {t("Türkiye'deki tüm üniversitelerden kişileri keşfet")}
          </li>
          <li>
            <SearchIcon size={16} /> {t('Aramada üniversite sınırı olmadan sonuç gör')}
          </li>
          <li>
            <Heart size={16} /> {t('Seni kimlerin beğendiğini gör, daha fazla beğeni hakkı')}
          </li>
          <li>
            <Rocket size={16} /> {t('Boost: profilin {m} dakika boyunca kampüsünde en üstte', { m: info?.boostMinutes ?? 30 })}
          </li>
          <li>
            <Undo2 size={16} /> {t('Kart Modu’nda son kararını geri al')}
          </li>
        </ul>

        <div className="paywall-plan-grid" role="radiogroup" aria-label={t('Plan seç')}>
          {(plans.length ? plans : PLAN_ORDER.map((key) => ({ key }))).map((p) => {
            const saving = savingVsWeekly(plans, p.key);
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={plan === p.key}
                className={`paywall-plan-card ${plan === p.key ? 'active' : ''}`}
                onClick={() => setPlan(p.key)}
              >
                {PLAN_BADGE[p.key] && <span className="plan-badge">{t(PLAN_BADGE[p.key])}</span>}
                <span className="plan-label">{t(p.label || { weekly: 'Haftalık', monthly: 'Aylık', yearly: 'Yıllık' }[p.key])}</span>
                <span className="plan-price">{formatTL(p.amount)}</span>
                <span className="plan-period">{t(PERIOD_LABEL[p.key])}</span>
                <span className="plan-perks">
                  {planPerks(p, t).map((perk) => (
                    <span key={perk}>{perk}</span>
                  ))}
                </span>
                {saving && <span className="plan-saving">{t('%{n} tasarruf', { n: saving })}</span>}
              </button>
            );
          })}
        </div>
        {info && (
          <p className="paywall-free-note">
            {t('Ücretsiz hesapta günde {n} beğeni hakkın var; Boost yalnızca Premium planlarla gelir.', { n: info.freeDailyLikes })}
          </p>
        )}

        {checkoutAvailable && (
          <label className="paywall-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              <Link to="/mesafeli-satis-sozlesmesi" target="_blank" rel="noopener">
                {t('Mesafeli Satış Sözleşmesi')}
              </Link>
              {t('’ni ve ön bilgilendirmeyi okudum. Dijital hizmetin hemen başlamasını onaylıyorum; bu nedenle cayma hakkımın sona ereceğini biliyorum. Üyelik dönem sonunda otomatik yenilenir, Ayarlar’dan istediğim an kapatabilirim.')}
            </span>
          </label>
        )}

        <button
          className="btn-premium-cta"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleUpgrade}
          disabled={saving || !checkoutAvailable || !consent || !selected}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Crown size={16} weight="fill" />}
          {saving
            ? t('İşleniyor...')
            : checkoutAvailable
              ? t('{plan} Premium’a geç · {price}', { plan: t(selected?.label || ''), price: formatTL(selected?.amount) })
              : t('Çok Yakında')}
        </button>
        {!checkoutAvailable && (
          <p className="paywall-modal-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('Ödeme sistemi hazırlanıyor. Premium çok yakında satışa açılacak.')}
          </p>
        )}
      </div>
    </div>
  );
}
