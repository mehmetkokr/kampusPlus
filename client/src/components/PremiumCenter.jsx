import React, { useCallback, useEffect, useState } from 'react';
import { Crown, Heart, Rocket, CalendarDays, Loader2, Star, EyeOff } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { PLAN_ORDER, PERIOD_LABEL, formatTL, formatTime } from '../lib/premium';
import CampusSwitchSheet from './CampusSwitchSheet';

// Ayarlar > Üyelik alanı: üyelik durumu (Plus ya da Premium), bugünkü beğeni
// hakkı, boost hakları ve boost başlatma, Kart Modu kampüsü, iki planın
// karşılaştırması, otomatik yenileme.
export default function PremiumCenter({ onOpenPaywall }) {
  const { t, lang } = useI18n();
  const { setUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);
  const [showCampus, setShowCampus] = useState(false);

  const load = useCallback(() => {
    api
      .get('/premium/status')
      .then((res) => setStatus(res.data))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  // Boost sürerken kalan süre dakikada bir güncellensin
  const boosting = status?.boostUntil && new Date(status.boostUntil) > new Date();
  useEffect(() => {
    if (!boosting) return undefined;
    const id = setInterval(() => {
      setTick((n) => n + 1);
      if (new Date(status.boostUntil) <= new Date()) load();
    }, 30000);
    return () => clearInterval(id);
  }, [boosting, status?.boostUntil, load]);

  async function startBoost() {
    if (
      !(await confirm({
        title: t('Boost başlatılsın mı?'),
        message: t('Profilin {m} dakika boyunca kampüsündeki öğrencilerin Kart Modu ve Keşfet listelerinde en üstte görünür. 1 Boost hakkın kullanılır.', { m: status.boostMinutes }),
        confirmLabel: t('Boost başlat'),
      }))
    )
      return;
    setBusy(true);
    try {
      const res = await api.post('/premium/boost');
      setStatus(res.data);
      setUser((prev) => ({ ...prev, boostCredits: res.data.boostCredits, boostUntil: res.data.boostUntil }));
      toast.success(t('Boost başladı! Profilin {time} saatine kadar öne çıkarılıyor.', { time: formatTime(res.data.boostUntil) }));
    } catch (err) {
      toast.error(err.response?.data?.error || t('Boost başlatılamadı.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleIncognito(enabled) {
    if (!status.features?.includes('incognito')) return onOpenPaywall();
    setBusy(true);
    setStatus((s) => ({ ...s, incognito: enabled }));
    try {
      const res = await api.put('/premium/incognito', { enabled });
      setStatus(res.data);
      toast.success(enabled ? t('Gizli mod açık: yalnızca beğendiğin kişiler seni görür.') : t('Gizli mod kapalı.'));
    } catch (err) {
      setStatus((s) => ({ ...s, incognito: !enabled }));
      toast.error(err.response?.data?.error || t('İşlem tamamlanamadı.'));
    } finally {
      setBusy(false);
    }
  }

  async function cancelRenew() {
    if (!(await confirm({ title: t('Otomatik yenileme kapatılsın mı?'), message: t('Üyeliğin mevcut süre dolana kadar devam eder, sonra yenilenmez.'), confirmLabel: t('Yenilemeyi kapat') }))) return;
    setBusy(true);
    try {
      const res = await api.post('/premium/cancel');
      setUser((prev) => ({ ...prev, premiumAutoRenew: res.data.premiumAutoRenew }));
      setStatus((s) => ({ ...s, premiumAutoRenew: res.data.premiumAutoRenew }));
      toast.success(t('Otomatik yenileme kapatıldı.'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('İşlem tamamlanamadı.'));
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <div className="settings-premium-card">
        <div className="premium-center-loading">
          <Loader2 size={18} className="spin" />
        </div>
      </div>
    );
  }

  const plans = PLAN_ORDER.map((k) => status.plans.find((p) => p.key === k)).filter(Boolean);
  const current = plans.find((p) => p.key === status.plan);
  const dateFmt = (d) => new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const likes = status.likes;

  return (
    <div className={`settings-premium-card ${status.isPremium ? 'is-active' : ''}`}>
      <div className="settings-premium-card-top">
        <Crown size={20} weight="fill" color={status.isPremium ? 'var(--amber)' : 'var(--text-muted)'} />
        <h4>{status.isPremium ? t('{plan} üyesin', { plan: t(current?.label || 'Premium') }) : t('kampüs+ üyelikleri')}</h4>
        {status.isPremium && <span className="premium-badge">{t('AKTİF')}</span>}
      </div>

      {/* Durum: bugünkü beğeni, boost, üyelik süresi */}
      <dl className="premium-stats">
        <div>
          <dt>
            <Heart size={15} /> {t('Bugünkü beğeni')}
          </dt>
          <dd>{likes.limit === null ? t('Sınırsız') : t('{left} / {limit} kaldı', { left: likes.left, limit: likes.limit })}</dd>
          {likes.limit !== null && <dd className="premium-stat-note">{t('Gece 00:00’da yenilenir')}</dd>}
        </div>
        <div>
          <dt>
            <Star size={15} /> {t('Süper Beğeni')}
          </dt>
          <dd>{status.superLikes.limit === 0 ? '—' : t('{left} / {limit} kaldı', { left: status.superLikes.left, limit: status.superLikes.limit })}</dd>
          <dd className="premium-stat-note">{status.superLikes.limit === 0 ? t('Plus ve Premium’da günlük') : t('Gece 00:00’da yenilenir')}</dd>
        </div>
        <div>
          <dt>
            <Rocket size={15} /> {t('Boost hakkı')}
          </dt>
          <dd>{status.boostCredits}</dd>
          <dd className="premium-stat-note">{boosting ? t('Şu an öne çıkıyorsun · bitiş {time}', { time: formatTime(status.boostUntil) }) : t('Her biri {m} dakika', { m: status.boostMinutes })}</dd>
        </div>
        {status.isPremium && status.premiumUntil && (
          <div>
            <dt>
              <CalendarDays size={15} /> {t('Üyelik')}
            </dt>
            <dd>{dateFmt(status.premiumUntil)}</dd>
            <dd className="premium-stat-note">{status.premiumAutoRenew ? t('Otomatik yenilenir') : t('Yenilenmeyecek')}</dd>
          </div>
        )}
      </dl>

      {/* Gizli mod (Premium) */}
      <div className="settings-row premium-incognito">
        <div>
          <div className="settings-row-label">
            <EyeOff size={15} /> {t('Gizli mod')}
          </div>
          <div className="settings-row-desc">
            {t('Açıkken Kart Modu ve Keşfet’te yalnızca senin beğendiğin kişilere görünürsün.')}
            {!status.features?.includes('incognito') && ` ${t('Premium’a özel.')}`}
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            aria-label={t('Gizli mod')}
            checked={Boolean(status.incognito)}
            disabled={busy}
            onChange={(e) => toggleIncognito(e.target.checked)}
          />
          <span className="switch-track" />
        </label>
      </div>

      {/* Kart Modu kampüsü (Plus ve Premium) */}
      {status.features?.includes('campus') && (
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t('Kart Modu kampüsü')}</div>
            <div className="settings-row-desc">
              {status.swipeUniversity ? status.swipeUniversity.name : t('Kendi kampüsün')} · {t('Akış ve kulüpler hep kendi kampüsünde kalır.')}
            </div>
          </div>
          <button type="button" className="btn-secondary settings-row-btn" onClick={() => setShowCampus(true)}>
            {t('Değiştir')}
          </button>
        </div>
      )}

      <div className="premium-actions">
        {(status.boostCredits > 0 || boosting) && (
          <button type="button" className="btn-premium-cta" onClick={startBoost} disabled={busy || boosting}>
            <Rocket size={16} weight="fill" /> {boosting ? t('Boost sürüyor') : t('Boost başlat')}
          </button>
        )}
        <button type="button" className={status.isPremium ? 'btn-secondary' : 'btn-premium-cta'} onClick={onOpenPaywall}>
          <Crown size={16} /> {status.isPremium ? t('Planı yenile ya da değiştir') : t('Plus ya da Premium’a geç')}
        </button>
      </div>

      {/* Tüm planlar tek bakışta */}
      <div className="premium-table-wrap">
        <table className="premium-table">
          <caption className="sr-only">{t('Planların karşılaştırması')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Plan')}</th>
              <th scope="col">{t('Ücret')}</th>
              <th scope="col">{t('Beğeni / gün')}</th>
              <th scope="col">{t('Süper / gün')}</th>
              <th scope="col">{t('Boost')}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.key} className={status.plan === p.key ? 'is-current' : ''}>
                <th scope="row">{t(p.label)}</th>
                <td>
                  {formatTL(p.amount)}
                  <span className="premium-table-period">{t(PERIOD_LABEL[p.key])}</span>
                </td>
                <td>{p.dailyLikes === null ? t('Sınırsız') : p.dailyLikes}</td>
                <td>{p.dailySuperLikes}</td>
                <td>{p.boosts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="premium-footnote">
        {t('Plus: başka bir üniversitede Kart Modu ve tüm üniversitelerde arama. Premium: bunlara ek olarak seni beğenenleri görme, Gizli mod, gelişmiş filtreler ve Kart Modu’nda geri alma. Boost hakların üyeliğin bitse de kaybolmaz.')}
      </p>

      {showCampus && <CampusSwitchSheet onClose={() => setShowCampus(false)} onChanged={load} />}

      {status.isPremium && status.premiumUntil && status.premiumAutoRenew && (
        <button type="button" className="premium-cancel" onClick={cancelRenew} disabled={busy}>
          {t('Otomatik yenilemeyi kapat')}
        </button>
      )}
    </div>
  );
}
