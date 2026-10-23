import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AtSign, ChevronRight, Download, Eye, EyeOff, KeyRound, X as CloseIcon } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { isNative, saveFile } from '../lib/native';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { useSocket } from '../lib/socket';

const PASSWORD_MIN = 8;

// Ayarlar > Güvenlik ve veriler: şifre değiştirme ve verilerimi indir
export default function AccountSecurity() {
  const { t } = useI18n();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const res = await api.get('/profile/me/export', { responseType: 'blob' });
      // Tarayıcıda indirilir, telefon uygulamasında paylaşım menüsü açılır
      await saveFile(res.data, `kampus-verilerim-${new Date().toISOString().slice(0, 10)}.json`);
      if (!isNative) toast.success('Verilerin indirildi.');
    } catch (err) {
      // Hata yanıtı da blob olarak gelir: içindeki mesajı oku
      let message = 'Verilerin hazırlanamadı.';
      try {
        message = JSON.parse(await err.response.data.text()).error || message;
      } catch {
        // varsayılan mesaj
      }
      toast.error(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 4 }}>{t('Güvenlik ve Veriler')}</h3>
      <p className="muted" style={{ marginBottom: 4 }}>
        {t('Şifreni değiştir ya da hakkında tuttuğumuz verilerin bir kopyasını al.')}
      </p>

      <button type="button" className="settings-link-row" onClick={() => setShowEmail(true)}>
        <div className="settings-link-row-icon">
          <AtSign size={16} aria-hidden="true" />
        </div>
        <div className="settings-link-row-text">
          <div className="settings-row-label">{t('E-posta Adresini Değiştir')}</div>
          <div className="settings-row-desc">{user?.email}</div>
        </div>
        <ChevronRight size={16} className="muted" aria-hidden="true" />
      </button>

      <button type="button" className="settings-link-row" onClick={() => setShowPassword(true)}>
        <div className="settings-link-row-icon">
          <KeyRound size={16} aria-hidden="true" />
        </div>
        <div className="settings-link-row-text">
          <div className="settings-row-label">{t('Şifreyi Değiştir')}</div>
          <div className="settings-row-desc">{t('Diğer cihazlardaki oturumların kapanır, bu cihaz açık kalır.')}</div>
        </div>
        <ChevronRight size={16} className="muted" aria-hidden="true" />
      </button>

      <button type="button" className="settings-link-row" onClick={exportData} disabled={exporting} style={{ borderBottom: 'none' }}>
        <div className="settings-link-row-icon">
          <Download size={16} aria-hidden="true" />
        </div>
        <div className="settings-link-row-text">
          <div className="settings-row-label">{exporting ? t('Hazırlanıyor...') : t('Verilerimi İndir')}</div>
          <div className="settings-row-desc">{t('Profilin, gönderilerin, gönderdiğin mesajlar ve tercihlerin tek bir dosyada (KVKK).')}</div>
        </div>
        <ChevronRight size={16} className="muted" aria-hidden="true" />
      </button>

      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
      {showEmail && <ChangeEmailModal onClose={() => setShowEmail(false)} />}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, error }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="password-field-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          required
        />
        <button type="button" className="password-toggle-btn" onClick={() => setVisible((v) => !v)} aria-label={visible ? t('Şifreyi gizle') : t('Şifreyi göster')}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="error-text" style={{ marginTop: 6 }}>{t(error)}</p>}
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const { login, user } = useAuth();
  const socket = useSocket();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const errs = {};
    if (next.length < PASSWORD_MIN) errs.newPassword = `Yeni şifre en az ${PASSWORD_MIN} karakter olmalı.`;
    if (next !== repeat) errs.repeat = 'Şifreler eşleşmiyor.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await api.put(
        '/auth/password',
        { currentPassword: current, newPassword: next },
        { headers: socket?.id ? { 'X-Socket-Id': socket.id } : undefined }
      );
      // Yeni oturum anahtarıyla devam (eski anahtar artık geçersiz)
      const remember = Boolean(localStorage.getItem('token'));
      login(res.data.token, user, remember, res.data.fileToken);
      toast.success(res.data.message);
      onClose();
    } catch (err) {
      const data = err.response?.data;
      if (data?.field) setErrors({ [data.field]: data.error });
      else toast.error(data?.error || 'Şifre değiştirilemedi.');
    } finally {
      setSaving(false);
    }
  }

  // Sayfa katmanından bağımsız açılsın: cam efektli kartların içinde kalmasın
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pw-title">
        <div className="modal-header">
          <h3 id="pw-title">{t('Şifreyi Değiştir')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <CloseIcon />
          </button>
        </div>
        <form onSubmit={submit} style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PasswordField id="pw-current" label={t('Mevcut şifre')} value={current} onChange={setCurrent} autoComplete="current-password" error={errors.currentPassword} />
          <PasswordField id="pw-new" label={t('Yeni şifre')} value={next} onChange={setNext} autoComplete="new-password" error={errors.newPassword} />
          <PasswordField id="pw-repeat" label={t('Yeni şifre (tekrar)')} value={repeat} onChange={setRepeat} autoComplete="new-password" error={errors.repeat} />
          <button type="submit" className="btn" disabled={saving || !current || !next || !repeat}>
            {saving ? t('Kaydediliyor...') : t('Şifreyi Değiştir')}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// E-posta değiştirme: aynı üniversitenin okul adresi, yeni adrese gelen kodla
function ChangeEmailModal({ onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const { user, setUser } = useAuth();
  const domain = user?.university?.emailDomain || user?.email?.split('@')[1];
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devConsole, setDevConsole] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/email/send-code', { newEmail, password });
      setSent(true);
      setDevConsole(Boolean(res.data.devConsole));
    } catch (err) {
      setError(err.response?.data?.error || t('Kod gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/email', { newEmail, code });
      setUser((prev) => ({ ...prev, email: res.data.email }));
      toast.success(res.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('E-posta değiştirilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="email-title">
        <div className="modal-header">
          <h3 id="email-title">{t('E-posta Adresini Değiştir')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <CloseIcon />
          </button>
        </div>
        {!sent ? (
          <form onSubmit={sendCode} style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {t('Yeni adres de üniversitenin okul e-postası olmalı (@{domain}). Örneğin lisanstan yüksek lisansa geçince adresin değiştiyse.', { domain })}
            </p>
            <div>
              <label htmlFor="new-email">{t('Yeni okul e-postası')}</label>
              <input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={`ornek@${domain || 'universite.edu.tr'}`} autoComplete="email" required />
            </div>
            <PasswordField id="email-pw" label={t('Şifren')} value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
            <button type="submit" className="btn" disabled={busy || !newEmail || !password}>
              {busy ? t('Gönderiliyor...') : t('Yeni adrese kod gönder')}
            </button>
          </form>
        ) : (
          <form onSubmit={confirm} style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label htmlFor="email-code">{t('{email} adresine gelen kod', { email: newEmail })}</label>
            <input
              id="email-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              style={{ letterSpacing: '0.4em', fontSize: 22, textAlign: 'center' }}
              autoFocus
            />
            {devConsole && <p className="field-hint">{t('Geliştirme ortamı: e-posta sunucusu (SMTP) ayarlı olmadığı için kod, sunucu konsoluna yazıldı.')}</p>}
            {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
            <button type="submit" className="btn" disabled={busy || code.length !== 6}>
              {busy ? t('Doğrulanıyor...') : t('Adresi değiştir')}
            </button>
            <button type="button" className="btn-secondary" onClick={sendCode} disabled={busy}>
              {t('Kodu tekrar gönder')}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
