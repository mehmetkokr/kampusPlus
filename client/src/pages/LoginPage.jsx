import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, EyeOff } from '../components/icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';
import LogoLoader from '../components/LogoLoader';
import { minDuration } from '../utils/wait';
import { useI18n } from '../i18n';
import { isNative } from '../lib/native';
import ThemeToggle from '../components/ThemeToggle';
import { NeonCheckbox } from '@/components/ui/animated-check-box';

// Sunucu oturumu kapattıysa giriş ekranında nedeni gösterilir
const SESSION_REASONS = {
  banned: 'Hesabın askıya alındı. Bir yanlışlık olduğunu düşünüyorsan destek ekibine yaz.',
  logout_all: 'Tüm cihazlardan çıkış yapıldı. Devam etmek için tekrar giriş yap.',
  password_changed: 'Şifren değiştiği için oturumun kapandı. Yeni şifrenle giriş yap.',
};

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  // Yönetici iki adımlı doğrulaması açıksa şifreden sonra uygulamadaki kod istenir
  const [needsCode, setNeedsCode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [searchParams] = useSearchParams();
  const sessionNotice = SESSION_REASONS[searchParams.get('reason')];

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const waitSuccess = minDuration(1200);
    const waitError = minDuration(600);

    try {
      const res = await api.post('/auth/login', { email, password, ...(needsCode ? { totpCode } : {}) });
      if (res.data.twoFactorRequired) {
        await waitError();
        setNeedsCode(true);
        return;
      }
      // Giriş animasyonu görünsün; login() sayfayı hemen yönlendirdiği için önce beklenir
      await waitSuccess();
      login(res.data.token, res.data.user, rememberMe, res.data.fileToken);
      if (res.data.reactivated) {
        toast.success('Hesabın yeniden aktifleştirildi. Tekrar hoş geldin!');
      }
      navigate('/discover');
    } catch (err) {
      await waitError();
      toast.error(err.response?.data?.error || 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />
      {loading && <LogoLoader mode="overlay" label={t("Giriş yapılıyor")} />}

      <ThemeToggle className="auth-theme-toggle" />

      {/* Telefon uygulamasında tanıtım sayfası yok; geri düğmesi gösterilmez */}
      {!isNative && (
        <Link to="/" className="auth-back">
          <ArrowLeft size={15} /> {t("Anasayfa")}
        </Link>
      )}

      <div className="auth-content">
        <div className="auth-wordmark">
          {t("kampüs")}<span className="dot">+</span>
        </div>
        <p className="auth-tagline">{t("sadece kendi üniversitenden insanlarla tanış")}</p>

        <div className="auth-card">
          <h2>{t("Tekrar hoş geldin")}</h2>
          <p className="muted">{t("Hesabına giriş yap")}</p>
          {sessionNotice && (
            <p className="auth-notice" role="status">
              {t(sessionNotice)}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <label>{t("E-posta")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("ornek@ogrenci.universite.edu.tr")}
              required
            />

            <label>{t("Şifre")}</label>
            <div className="password-field-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("Şifreyi gizle") : t("Şifreyi göster")}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            <div className="auth-row-between">
              {/* Telefon uygulamasında oturum hep hatırlanır; kutu gösterilmez */}
              {isNative ? (
                <span />
              ) : (
                <NeonCheckbox
                  className="remember-me-check"
                  size={22}
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  label={t("Beni Hatırla")}
                />
              )}
              <Link to="/forgot-password" className="forgot-password-link">
                {t("Şifremi Unuttum")}
              </Link>
            </div>

            {needsCode && (
              <div className="totp-step">
                <label htmlFor="totp-code">{t('Doğrulama kodu')}</label>
                <p className="muted" style={{ margin: '0 0 8px', fontSize: 13.5 }}>
                  {t('Kimlik doğrulama uygulamandaki 6 haneli kodu yaz.')}
                </p>
                <input
                  id="totp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  style={{ letterSpacing: '0.4em', fontSize: 20, textAlign: 'center' }}
                  autoFocus
                  required
                />
              </div>
            )}

            <button className="btn" type="submit" disabled={loading || (needsCode && totpCode.length !== 6)}>
              {loading ? t("Giriş yapılıyor...") : needsCode ? t('Doğrula ve giriş yap') : t("Giriş Yap")}
            </button>
          </form>

          <div className="auth-trust">
            <ShieldCheck size={13} /> {t("Yalnızca doğrulanmış üniversite öğrencileri")}
          </div>
        </div>

        <p className="auth-foot">
          {t("Hesabın yok mu?")} <Link to="/register">{t("Kayıt Ol")}</Link>
        </p>
      </div>
    </div>
  );
}
