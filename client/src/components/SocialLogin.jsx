import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { currentTheme } from '../utils/theme';

// "Apple ile devam et" ve "Google ile devam et". Sunucu istemci kimliklerini
// verir (/auth/oauth/config); tanımlı olmayan sağlayıcının düğmesi yayında
// gösterilmez. Geliştirmede tasarım görülebilsin diye ikisi de görünür.
//
// Sağlayıcı e-postası okulun adresiyse doğrudan giriş/kayıt olur. Değilse
// okul e-postası gerekir: kayıt sayfasına bir biletle gidilir ve hesap
// oluşturulunca (ya da şifreyle girilince) Apple/Google hesabı bağlanır.
const scripts = {};
function loadScript(src) {
  scripts[src] ||= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => {
      delete scripts[src];
      reject(new Error('script'));
    };
    document.head.appendChild(el);
  });
  return scripts[src];
}

let configPromise;
function getConfig() {
  configPromise ||= api
    .get('/auth/oauth/config')
    .then((r) => r.data)
    .catch(() => {
      configPromise = null;
      return { google: null, apple: null };
    });
  return configPromise;
}

const PROVIDER_NAME = { google: 'Google', apple: 'Apple' };

export default function SocialLogin({ divider = 'veya e-postanla' }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getConfig().then((c) => alive && setConfig(c));
    return () => {
      alive = false;
    };
  }, []);

  const preview = import.meta.env.DEV;
  const showGoogle = !!config?.google || (preview && !!config);
  const showApple = !!config?.apple || (preview && !!config);

  async function finish(provider, request) {
    setBusy(true);
    try {
      const { data } = await request;
      if (data.needsSchoolEmail) {
        toast.info(t('{provider} hesabın okul e-postana bağlı değil. Okul e-postanla devam et; hesabın {provider} ile bağlanacak.', { provider: PROVIDER_NAME[provider] }));
        navigate('/register', { state: { oauthTicket: data.ticket, oauthName: data.name, oauthProvider: provider } });
        return;
      }
      login(data.token, data.user, true);
      if (data.reactivated) toast.success('Hesabın yeniden aktifleştirildi. Tekrar hoş geldin!');
      navigate(data.isNew ? '/welcome' : '/discover');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Giriş doğrulanamadı. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  // Google kendi düğmesini çizer (marka kuralları ve güvenli açılır pencere)
  useEffect(() => {
    if (!config?.google || !googleRef.current) return undefined;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client')
      .then(() => {
        if (cancelled || !googleRef.current) return;
        const g = window.google.accounts.id;
        g.initialize({
          client_id: config.google,
          callback: (resp) => finish('google', api.post('/auth/oauth/google', { credential: resp.credential })),
          ux_mode: 'popup',
          auto_select: false,
        });
        g.renderButton(googleRef.current, {
          type: 'standard',
          theme: currentTheme() === 'light' ? 'outline' : 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          width: Math.min(400, googleRef.current.offsetWidth || 320),
          locale: lang === 'en' ? 'en' : 'tr',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // finish yalnızca toast/navigate kullanır; yeniden çizmeye gerek yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.google, lang]);

  async function appleSignIn() {
    if (!config?.apple) {
      toast.info(t('Apple ile giriş henüz ayarlanmadı.'));
      return;
    }
    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/tr_TR/appleid.auth.js');
      window.AppleID.auth.init({
        clientId: config.apple,
        scope: 'name email',
        redirectURI: `${window.location.origin}/login`,
        usePopup: true,
      });
      const res = await window.AppleID.auth.signIn();
      const n = res.user?.name;
      const name = n ? [n.firstName, n.lastName].filter(Boolean).join(' ') : undefined;
      await finish('apple', api.post('/auth/oauth/apple', { idToken: res.authorization?.id_token, name }));
    } catch (err) {
      // Kullanıcı pencereyi kapattıysa sessiz kal
      if (err?.error === 'popup_closed_by_user' || err?.error === 'user_cancelled_authorize') return;
      toast.error('Apple ile giriş başlatılamadı.');
    }
  }

  if (!showGoogle && !showApple) return null;

  return (
    <div className="social-login" aria-busy={busy}>
      {showApple && (
        <button type="button" className="social-btn social-apple" onClick={appleSignIn} disabled={busy}>
          <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.06 10.62c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.21.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.59-.75 2.99-.75 1.4 0 1.79.75 3.01.72 1.24-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.45-3.71zM11.77 3.86c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.1 1.77-.97 2.82 1.03.08 2.07-.52 2.71-1.28z"
            />
          </svg>
          {t('Apple ile devam et')}
        </button>
      )}

      {showGoogle &&
        (config?.google ? (
          <div ref={googleRef} className="social-google-slot" />
        ) : (
          <button type="button" className="social-btn social-google" onClick={() => toast.info(t('Google ile giriş henüz ayarlanmadı.'))}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
            </svg>
            {t('Google ile devam et')}
          </button>
        ))}

      <div className="social-divider">
        <span>{t(divider)}</span>
      </div>
    </div>
  );
}
