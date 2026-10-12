import React, { useState } from 'react';
import { X, Crown, Globe2, Eye, Search as SearchIcon, Loader2 } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { track } from '../lib/telemetry';

const PLAN_LABELS = {
  monthly: { label: 'Aylık', badge: null },
  yearly: { label: 'Yıllık', badge: 'EN AVANTAJLI' },
};

// Uygulama içinde ücretli (üniversite dışı erişim) bir özelliğe tıklanınca
// her yerden aynı şekilde açılabilecek ortak paywall modalı.
// contextText: kullanıcıyı buraya getiren aksiyona özel kısa açıklama.
export default function PaywallModal({ onClose, onUpgraded, contextText }) {
  const { t } = useI18n();
  const { setUser, user } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState('monthly');
  const [plans, setPlans] = useState(null);
  // Ödeme sağlayıcısı bağlanana kadar yayında satın alma kapalıdır
  const [checkoutAvailable, setCheckoutAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    track('paywall_view');
    api
      .get('/premium/status')
      .then((res) => {
        setPlans(res.data.plans);
        setCheckoutAvailable(res.data.checkoutAvailable !== false);
      })
      .catch(() => {});
  }, []);

  async function handleUpgrade() {
    track('checkout_click', { plan });
    setSaving(true);
    try {
      const res = await api.post('/premium/activate', { plan });
      setUser((prev) => ({ ...prev, isPremium: true, premiumUntil: res.data.premiumUntil, premiumAutoRenew: res.data.premiumAutoRenew }));
      toast.success('Premium üyeliğin aktif! Artık tüm üniversitelerdeki kişileri görebilirsin.');
      onUpgraded?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem tamamlanamadı.');
    } finally {
      setSaving(false);
    }
  }

  const priceByPlan = Object.fromEntries((plans || []).map((p) => [p.key, p]));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet paywall-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span />
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="paywall-icon">
          <Crown size={26} />
        </div>
        <h3>{t("KampüsPlus Premium")}</h3>
        <p className="paywall-modal-sub">
          {t(contextText || 'Bu içerik sadece Premium üyelere açık.')}{' '}
          {t('Şu an sadece {uni} içindeki kişileri görebiliyorsun.', { uni: user?.university?.name || '' })}
        </p>

        <ul className="paywall-feature-list">
          <li>
            <Globe2 size={16} /> {t("Türkiye'deki tüm üniversitelerden kişileri keşfet")}
          </li>
          <li>
            <SearchIcon size={16} /> {t("Aramada üniversite sınırı olmadan sonuç gör")}
          </li>
          <li>
            <Eye size={16} /> {t("Profilini kimlerin görüntülediğini gör")}
          </li>
        </ul>

        <div className="paywall-plan-row">
          {['monthly', 'yearly'].map((key) => (
            <div
              key={key}
              className={`paywall-plan-card ${plan === key ? 'active' : ''}`}
              onClick={() => setPlan(key)}
            >
              <div className="plan-label">{t(PLAN_LABELS[key].label)}</div>
              <div className="plan-price">
                {priceByPlan[key] ? `₺${priceByPlan[key].amount.toFixed(2)}` : '...'}
              </div>
              {PLAN_LABELS[key].badge && <span className="plan-badge">{PLAN_LABELS[key].badge}</span>}
            </div>
          ))}
        </div>

        <button
          className="btn-premium-cta"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleUpgrade}
          disabled={saving || !checkoutAvailable}
        >
          {saving ? <Loader2 size={16} className="spin" /> : <Crown size={16} />}
          {saving ? t("İşleniyor...") : checkoutAvailable ? t("Premium'a Geç") : t("Çok Yakında")}
        </button>
        {!checkoutAvailable && (
          <p className="paywall-modal-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            {t("Ödeme sistemi hazırlanıyor. Premium çok yakında satışa açılacak.")}
          </p>
        )}
      </div>
    </div>
  );
}
