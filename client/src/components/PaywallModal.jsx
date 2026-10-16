import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Crown, Loader2, Check } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { track } from '../lib/telemetry';
import { PLAN_BADGE, PLAN_FEATURES, PLAN_HIGHLIGHTS, PLAN_ORDER, PERIOD_LABEL, formatTL, planPerks } from '../lib/premium';

// Uygulama içinde ücretli bir özelliğe tıklanınca her yerden aynı şekilde
// açılan ortak üyelik penceresi: Plus ve Premium, her planın hakları ve
// özellikleri, Mesafeli Satış Sözleşmesi onayı.
// contextText: kullanıcıyı buraya getiren aksiyona özel kısa açıklama.
// requiredFeature: istenen özellik (ör. 'seeLikes'); onu içermeyen plan seçilemez.
export default function PaywallModal({ onClose, onUpgraded, contextText, requiredFeature }) {
  const { t } = useI18n();
  const { setUser } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState('premium');
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
  const allowed = (key) => !requiredFeature || PLAN_FEATURES[key]?.includes(requiredFeature);

  async function handleUpgrade() {
    if (!consent || !allowed(plan)) return;
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
      toast.success(t('{plan} üyeliğin aktif! {n} Boost hakkın hesabına eklendi.', { plan: t(selected?.label || ''), n: selected?.boosts ?? 0 }));
      onUpgraded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || t('İşlem tamamlanamadı.'));
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
        <h3 id="paywall-title">{t('kampüs+ üyelikleri')}</h3>
        <p className="paywall-modal-sub">{t(contextText || 'Bu özellik üyelere açık.')}</p>

        <div className="paywall-plan-grid is-two" role="radiogroup" aria-label={t('Plan seç')}>
          {(plans.length ? plans : PLAN_ORDER.map((key) => ({ key }))).map((p) => {
            const ok = allowed(p.key);
            return (
              <button
                key={p.key}
                type="button"
                role="radio"
                aria-checked={plan === p.key}
                aria-disabled={!ok}
                className={`paywall-plan-card ${plan === p.key ? 'active' : ''} ${ok ? '' : 'is-locked'}`}
                onClick={() => ok && setPlan(p.key)}
              >
                {PLAN_BADGE[p.key] && <span className="plan-badge">{t(PLAN_BADGE[p.key])}</span>}
                <span className="plan-label">{t(p.label || { plus: 'Plus', premium: 'Premium' }[p.key])}</span>
                <span className="plan-price">{formatTL(p.amount)}</span>
                <span className="plan-period">{t(PERIOD_LABEL[p.key])}</span>
                <span className="plan-perks">
                  {planPerks(p, t).map((perk) => (
                    <span key={perk}>{perk}</span>
                  ))}
                </span>
                <ul className="plan-features">
                  {PLAN_HIGHLIGHTS[p.key].map((f) => (
                    <li key={f}>
                      <Check size={13} aria-hidden="true" /> {t(f)}
                    </li>
                  ))}
                </ul>
                {!ok && <span className="plan-locked-note">{t('Bu özellik Premium’da')}</span>}
              </button>
            );
          })}
        </div>

        {checkoutAvailable && (
          <label className="paywall-consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              <Link to="/mesafeli-satis-sozlesmesi" target="_blank" rel="noopener">
                {t('Mesafeli Satış Sözleşmesi')}
              </Link>
              {t('’ni ve ön bilgilendirmeyi okudum. Dijital hizmetin hemen başlamasını onaylıyorum; bu nedenle cayma hakkımın sona ereceğini biliyorum. Üyelik her ay otomatik yenilenir, Ayarlar’dan istediğim an kapatabilirim.')}
            </span>
          </label>
        )}

        <button
          className="btn-premium-cta"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleUpgrade}
          disabled={saving || !checkoutAvailable || !consent || !selected || !allowed(plan)}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Crown size={16} weight="fill" />}
          {saving
            ? t('İşleniyor...')
            : checkoutAvailable
              ? t('{plan}’a geç · {price}', { plan: t(selected?.label || ''), price: formatTL(selected?.amount) })
              : t('Çok Yakında')}
        </button>
        {!checkoutAvailable && (
          <p className="paywall-modal-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {t('Ödeme sistemi hazırlanıyor. Üyelikler çok yakında satışa açılacak.')}
          </p>
        )}
      </div>
    </div>
  );
}
