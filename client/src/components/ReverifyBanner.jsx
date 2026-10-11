import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { ChevronRight, GraduationCap, X } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';

// Yıllık öğrencilik doğrulaması (server/src/lib/reverify.js). Süre dolunca
// okul e-postasına gelen kodla doğrulama istenir; ek süre de biterse profil
// Keşfet ve Kart Modu'ndan gizlenir. Bant bu oturum için kapatılabilir.
const KEY = 'kp-reverify-dismissed';

export function needsReverify(user) {
  return user?.reverify && user.reverify.status !== 'ok';
}

export default function ReverifyBanner() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!needsReverify(user) || pathname.startsWith('/chat/')) return null;
  const expired = user.reverify.status === 'expired';
  const hiddenAt = new Date(user.reverify.hiddenAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long' });

  function dismiss(e) {
    e?.stopPropagation();
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // önemsiz
    }
    setHidden(true);
  }

  return (
    <>
      {!hidden && (
        <aside className="announcement-banner" role="status" aria-live="polite">
          <button type="button" className="announcement-main" onClick={() => setOpen(true)}>
            <span className="announcement-icon" aria-hidden="true">
              <GraduationCap size={17} />
            </span>
            <span className="announcement-text">
              <b>{expired ? t('Profilin şu an gizli') : t('Öğrenciliğini yenile')}</b>
              <span>
                {expired
                  ? t('Okul e-postana gelen kodla doğrula, profilin hemen geri gelsin.')
                  : t('Yılda bir okul e-postanla doğruluyoruz. {date} tarihine kadar doğrulamazsan profilin gizlenir.', { date: hiddenAt })}
              </span>
            </span>
            <ChevronRight size={18} className="announcement-chev" aria-hidden="true" />
          </button>
          <button type="button" className="announcement-close" onClick={dismiss} aria-label={t('Daha sonra')}>
            <X size={16} />
          </button>
        </aside>
      )}
      {open && <ReverifyModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ReverifyModal({ onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const { setUser } = useAuth();
  const [sentTo, setSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/reverify/send-code');
      setSentTo(res.data.to);
    } catch (err) {
      setError(err.response?.data?.error || t('Kod gönderilemedi.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/auth/reverify', { code });
      setUser((prev) => ({ ...prev, reverify: res.data.reverify }));
      toast.success(res.data.message);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('Doğrulama tamamlanamadı.'));
    } finally {
      setBusy(false);
    }
  }

  // Sayfa katmanından bağımsız açılsın: cam efektli kartların içinde kalmasın
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="reverify-title">
        <div className="modal-header">
          <h3 id="reverify-title">{t('Öğrenciliğini yenile')}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <X />
          </button>
        </div>
        <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
            {t('kampüs· yalnızca öğrencilere açık. Kayıtlı okul e-postana 6 haneli bir kod göndereceğiz. Mezun olduysan ya da okul adresin artık çalışmıyorsa kod ulaşmaz; hesabın silinmez ama listelerde görünmez.')}
          </p>
          {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}
          {!sentTo ? (
            <button type="button" className="btn" onClick={send} disabled={busy}>
              {busy ? t('Gönderiliyor...') : t('Okul e-postama kod gönder')}
            </button>
          ) : (
            <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label htmlFor="reverify-code">{t('{email} adresine gelen kod', { email: sentTo })}</label>
              <input
                id="reverify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ letterSpacing: '0.4em', fontSize: 22, textAlign: 'center' }}
                autoFocus
              />
              <button type="submit" className="btn" disabled={busy || code.length !== 6}>
                {busy ? t('Doğrulanıyor...') : t('Doğrula')}
              </button>
              <button type="button" className="btn-secondary" onClick={send} disabled={busy}>
                {t('Kodu tekrar gönder')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
