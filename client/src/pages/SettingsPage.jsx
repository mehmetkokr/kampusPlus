import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, ShieldOff, Snowflake, Trash2, X, LogOut, Crown, Settings as SettingsIcon } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PaywallModal from '../components/PaywallModal';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';

const VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Herkese Açık' },
  { value: 'university', label: 'Yalnızca Üniversitem' },
  { value: 'nobody', label: 'Kimseye Gösterme' },
];

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [notifyMatches, setNotifyMatches] = useState(true);
  const [notifyMessages, setNotifyMessages] = useState(true);
  const [notifyPostActivity, setNotifyPostActivity] = useState(true);
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState('everyone');
  const [showActivityStatus, setShowActivityStatus] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('tr');
  const [saving, setSaving] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showPaywall, setShowPaywall] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleCancelPremium() {
    if (!(await confirm({ title: 'Otomatik yenileme kapatılsın mı?', message: 'Premium üyeliğin mevcut süre dolana kadar devam eder, sonra yenilenmez.', confirmLabel: 'Yenilemeyi kapat' }))) return;
    setCancelling(true);
    try {
      await api.post('/premium/cancel');
      setUser((prev) => ({ ...prev, isPremium: false }));
      toast.success('Otomatik yenileme kapatıldı.');
    } catch (err) {
      toast.error('İşlem tamamlanamadı.');
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    if (user) {
      setNotifyMatches(user.notifyMatches ?? true);
      setNotifyMessages(user.notifyMessages ?? true);
      setNotifyPostActivity(user.notifyPostActivity ?? true);
      setWeeklySummaryEnabled(user.weeklySummaryEnabled ?? true);
      setProfileVisibility(user.profileVisibility || 'everyone');
      setShowActivityStatus(user.showActivityStatus ?? true);
      setSwipeEnabled(user.swipeEnabled ?? true);
      setTheme(user.theme || 'dark');
      setLanguage(user.language || 'tr');
    }
  }, [user]);

  async function updatePreference(key, value) {
    setSaving(true);
    try {
      const res = await api.put('/profile/me/notifications', { [key]: value });
      setUser((prev) => ({ ...prev, ...res.data.user }));
    } catch (err) {
      toast.error('Tercih kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function updatePrivacy(next) {
    setSaving(true);
    try {
      const res = await api.put('/profile/me/privacy', next);
      setUser((prev) => ({ ...prev, ...res.data.user }));
    } catch (err) {
      toast.error('Gizlilik tercihi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAppearance(next) {
    setSaving(true);
    try {
      const res = await api.put('/profile/me/appearance', next);
      setUser((prev) => ({ ...prev, ...res.data.user }));
    } catch (err) {
      toast.error('Görünüm tercihi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  async function loadBlockedUsers() {
    try {
      const res = await api.get('/users/me/blocked');
      setBlockedUsers(res.data);
      setBlockedLoaded(true);
    } catch (err) {
      toast.error('Engellenen kullanıcılar alınamadı.');
    }
  }

  function toggleBlockedSection() {
    setShowBlocked((v) => !v);
    if (!blockedLoaded) loadBlockedUsers();
  }

  async function handleUnblock(targetUserId) {
    setBlockedUsers((prev) => prev.filter((b) => b.user.id !== targetUserId));
    try {
      await api.post(`/users/${targetUserId}/unblock`);
      toast.success('Engel kaldırıldı.');
    } catch (err) {
      toast.error('Engel kaldırılamadı.');
      loadBlockedUsers();
    }
  }

  async function handleFreeze() {
    const ok = await confirm({
      title: 'Hesabın dondurulsun mu?',
      message: 'Profilin, gönderilerin ve Kart Modu kartın diğer öğrencilerden gizlenir; oturumun kapanır. Tekrar giriş yaptığında hesabın otomatik olarak aktifleşir.',
      confirmLabel: 'Hesabı dondur',
    });
    if (!ok) return;
    try {
      await api.post('/profile/me/freeze');
      toast.success('Hesabın donduruldu.');
      logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Hesap dondurulamadı.');
    }
  }

  async function handleLogoutAllDevices() {
    const ok = await confirm({
      title: 'Tüm cihazlardan çıkış yapılsın mı?',
      message: 'Bu cihaz dahil, hesabına giriş yapılmış tüm telefon ve bilgisayarlardaki oturumlar kapanır. Tekrar girmek için şifren gerekir.',
      confirmLabel: 'Tümünden çıkış yap',
    });
    if (!ok) return;
    try {
      await api.post('/profile/logout-all');
      toast.success('Tüm cihazlardan çıkış yapıldı.');
      logout();
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız oldu.');
    }
  }

  async function handleDeleteAccount(e) {
    e.preventDefault();
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/profile/me', { data: { password: deletePassword } });
      toast.success('Hesabın silindi. Görüşmek üzere!');
      logout();
      navigate('/');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Hesap silinemedi.');
    } finally {
      setDeleting(false);
    }
  }

  if (!user) return null;

  return (
    <div className="container">
      <PageHeader
        compact
        tone="violet"
        icon={SettingsIcon}
        eyebrow={t("Tercihler & gizlilik")}
        title={t("Ayarlar")}
        onBack={() => navigate('/profile')}
      />

      {/* ---------- Premium ---------- */}
      <div className={`settings-premium-card ${user.isPremium ? 'is-active' : ''}`}>
        <div className="settings-premium-card-top">
          <Crown size={20} color={user.isPremium ? 'var(--amber)' : 'var(--text-muted)'} />
          <h4>{user.isPremium ? t("Premium Üyesin") : t("KampüsPlus Premium")}</h4>
          {user.isPremium && <span className="premium-badge">{t("AKTİF")}</span>}
        </div>
        {user.isPremium ? (
          <>
            <p>
              {user.premiumUntil
                ? t('Üyeliğin {date} tarihine kadar aktif. Tüm üniversitelerdeki kişileri görebilirsin.', { date: new Date(user.premiumUntil).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR') })
                : t("Tüm üniversitelerdeki kişileri görebilirsin.")}
            </p>
            <button className="btn-secondary" onClick={handleCancelPremium} disabled={cancelling}>
              {cancelling ? t("İşleniyor...") : t("Otomatik Yenilemeyi Kapat")}
            </button>
          </>
        ) : (
          <>
            <p>{t('Şu an sadece {uni} içindeki kişileri görebiliyorsun. Premium ile tüm üniversitelerden kişilerle tanış, aramada sınır olmadan sonuç gör.', { uni: user.university?.name || '' })}</p>
            <button className="btn-premium-cta" onClick={() => setShowPaywall(true)}>
              <Crown size={16} /> {t("Premium'a Geç")}
            </button>
          </>
        )}
      </div>

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}

      {/* ---------- Bildirimler ---------- */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>{t("Bildirimler")}</h3>
        <p className="muted" style={{ marginBottom: 4 }}>
          {t("Hangi durumlarda bildirim almak istediğini seç.")}
        </p>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Yeni Eşleşme Bildirimleri")}</div>
            <div className="settings-row-desc">{t("Biriyle eşleştiğinde haberdar ol.")}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={notifyMatches}
              disabled={saving}
              onChange={(e) => {
                setNotifyMatches(e.target.checked);
                updatePreference('notifyMatches', e.target.checked);
              }}
            />
            <span className="switch-track" />
          </label>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Yeni Mesaj Bildirimleri")}</div>
            <div className="settings-row-desc">{t("Sana mesaj geldiğinde haberdar ol.")}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={notifyMessages}
              disabled={saving}
              onChange={(e) => {
                setNotifyMessages(e.target.checked);
                updatePreference('notifyMessages', e.target.checked);
              }}
            />
            <span className="switch-track" />
          </label>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Beğeni ve Yorum Bildirimleri")}</div>
            <div className="settings-row-desc">{t("Gönderin beğenildiğinde veya yorum yapıldığında haberdar ol.")}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={notifyPostActivity}
              disabled={saving}
              onChange={(e) => {
                setNotifyPostActivity(e.target.checked);
                updatePreference('notifyPostActivity', e.target.checked);
              }}
            />
            <span className="switch-track" />
          </label>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Haftalık Özet")}</div>
            <div className="settings-row-desc">{t("Her Pazartesi haftanın özetini (takipçi, beğeni, eşleşme, mesaj) al.")}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={weeklySummaryEnabled}
              disabled={saving}
              onChange={(e) => {
                setWeeklySummaryEnabled(e.target.checked);
                updatePreference('weeklySummaryEnabled', e.target.checked);
              }}
            />
            <span className="switch-track" />
          </label>
        </div>
      </div>

      {/* ---------- Gizlilik ---------- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>{t("Gizlilik")}</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          {t("Profilini kimlerin görebileceğini kontrol et.")}
        </p>

        <label>{t("Profil Görünürlüğü")}</label>
        <select
          value={profileVisibility}
          disabled={saving}
          onChange={(e) => {
            setProfileVisibility(e.target.value);
            updatePrivacy({ profileVisibility: e.target.value });
          }}
          style={{ marginBottom: 4 }}
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.label)}
            </option>
          ))}
        </select>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Çevrimiçi Durumunu Göster")}</div>
            <div className="settings-row-desc">{t("Kapatırsan son görülme bilgin gizlenir.")}</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={showActivityStatus}
              disabled={saving}
              onChange={(e) => {
                setShowActivityStatus(e.target.checked);
                updatePrivacy({ showActivityStatus: e.target.checked });
              }}
            />
            <span className="switch-track" />
          </label>
        </div>

        {/* Kart Modu: kapatan kişi yalnızca akış ve kulüpleri kullanır, kimsenin destesinde görünmez */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">{t("Kart Modu")}</div>
            <div className="settings-row-desc">
              {t("Kapatırsan Kart Modu menüden kalkar ve sen de kimsenin kartında görünmezsin. Akış ve kulüpler aynen çalışır.")}
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={swipeEnabled}
              disabled={saving}
              onChange={(e) => {
                setSwipeEnabled(e.target.checked);
                updatePrivacy({ swipeEnabled: e.target.checked });
              }}
            />
            <span className="switch-track" />
          </label>
        </div>

        <button
          className="settings-link-row"
          style={{ borderBottom: 'none', paddingTop: 16 }}
          onClick={toggleBlockedSection}
        >
          <div className="settings-link-row-icon">
            <ShieldOff size={16} />
          </div>
          <div className="settings-link-row-text">
            <div className="settings-row-label">{t("Engellenen Kullanıcılar")}</div>
            <div className="settings-row-desc">
              {blockedLoaded ? t('{n} kullanıcı', { n: blockedUsers.length }) : t("Listeyi görüntüle")}
            </div>
          </div>
        </button>

        {showBlocked && (
          <div style={{ marginTop: 4 }}>
            {!blockedLoaded && <p className="muted">{t("Yükleniyor...")}</p>}
            {blockedLoaded && blockedUsers.length === 0 && (
              <p className="muted">{t("Engellediğin kimse yok.")}</p>
            )}
            {blockedLoaded &&
              blockedUsers.map((b) => (
                <div className="blocked-user-row" key={b.blockId}>
                  <img
                    className="blocked-user-avatar"
                    src={b.user.photoUrl ? `${API_BASE_URL}${b.user.photoUrl}` : undefined}
                    alt={b.user.fullName}
                  />
                  <div className="blocked-user-name">{b.user.fullName}</div>
                  <button className="unblock-btn" onClick={() => handleUnblock(b.user.id)}>
                    {t("Engeli Kaldır")}
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ---------- Görünüm ve Dil ---------- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>{t("Görünüm ve Dil")}</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          {t("Uygulamanın nasıl görüneceğini seç.")}
        </p>

        <label>{t("Tema")}</label>
        <div className="theme-toggle-group" style={{ marginBottom: 16 }}>
          <button
            type="button"
            className={`theme-toggle-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => {
              setTheme('dark');
              updateAppearance({ theme: 'dark' });
            }}
          >
            <Moon size={18} />
            {t("Koyu")}
          </button>
          <button
            type="button"
            className={`theme-toggle-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => {
              setTheme('light');
              updateAppearance({ theme: 'light' });
            }}
          >
            <Sun size={18} />
            {t("Açık")}
          </button>
        </div>

        <label>{t("Dil")}</label>
        <select
          value={language}
          disabled={saving}
          onChange={(e) => {
            setLanguage(e.target.value);
            setLang(e.target.value);
          }}
        >
          <option value="tr">{t("Türkçe")}</option>
          <option value="en">{t("English")}</option>
        </select>
      </div>

      {/* ---------- Hesap: Tehlike Bölgesi ---------- */}
      <div className="card danger-zone-card" style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>{t("Hesap")}</h3>
        <p className="muted" style={{ marginBottom: 4 }}>
          {t("Bu işlemler hesabını etkiler, dikkatli ol.")}
        </p>

        <button className="danger-row-btn" onClick={handleLogoutAllDevices}>
          <div className="settings-link-row-icon">
            <LogOut size={16} />
          </div>
          <div className="settings-link-row-text">
            <div className="settings-row-label">{t("Tüm Cihazlardan Çıkış Yap")}</div>
            <div className="settings-row-desc">{t("Bu cihaz dahil tüm oturumları kapatır, tekrar giriş yapman gerekir.")}</div>
          </div>
        </button>

        <button className="danger-row-btn" onClick={handleFreeze}>
          <div className="settings-link-row-icon">
            <Snowflake size={16} />
          </div>
          <div className="settings-link-row-text">
            <div className="settings-row-label">{t("Hesabı Dondur")}</div>
            <div className="settings-row-desc">{t("Profilin gizlenir, tekrar girişte otomatik açılır.")}</div>
          </div>
        </button>

        <button className="danger-row-btn" onClick={() => setShowDeleteModal(true)}>
          <div className="settings-link-row-icon">
            <Trash2 size={16} />
          </div>
          <div className="settings-link-row-text">
            <div className="settings-row-label">{t("Hesabı Sil")}</div>
            <div className="settings-row-desc">{t("Bu işlem geri alınamaz, tüm verilerin silinir.")}</div>
          </div>
        </button>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("Hesabı Sil")}</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDeleteAccount}>
              <p className="muted" style={{ marginBottom: 14 }}>
                {t('Bu işlem geri alınamaz. Profilin, eşleşmelerin, mesajların ve tüm verilerin kalıcı olarak silinir. Devam etmek için şifreni gir.')}
              </p>
              {deleteError && <p className="error-text">{deleteError}</p>}
              <label>{t("Şifre")}</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="submit"
                className="btn"
                disabled={deleting}
                style={{ background: 'var(--coral)', color: '#fff' }}
              >
                {deleting ? t("Siliniyor...") : t("Hesabımı Kalıcı Olarak Sil")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
