import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';
import CubeLoader from '../components/CubeLoader';
import { minDuration } from '../utils/wait';
import { useI18n } from '../i18n';
import ThemeToggle from '../components/ThemeToggle';
import SocialLogin from '../components/SocialLogin';

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();
  // Apple/Google ile gelip okul hesabı bulunamadıysa: şifreyle girince bağlanır
  const oauthTicket = useLocation().state?.oauthTicket;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    const waitSuccess = minDuration(1200);
    const waitError = minDuration(600);

    try {
      const res = await api.post('/auth/login', { email, password, oauthTicket });
      // Giriş animasyonu görünsün; login() sayfayı hemen yönlendirdiği için önce beklenir
      await waitSuccess();
      login(res.data.token, res.data.user, rememberMe);
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
      {loading && <CubeLoader mode="overlay" label={t("Giriş yapılıyor")} />}

      <ThemeToggle className="auth-theme-toggle" />

      <Link to="/" className="auth-back">
        <ArrowLeft size={15} /> {t("Anasayfa")}
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          {t("kampüs")}<span className="dot">·</span>
        </div>
        <p className="auth-tagline">{t("sadece kendi üniversitenden insanlarla tanış")}</p>

        <div className="auth-card">
          <h2>{t("Tekrar hoş geldin")}</h2>
          <p className="muted">{t("Hesabına giriş yap")}</p>

          <SocialLogin />

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
              <label className="remember-me-check">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                {t("Beni Hatırla")}
              </label>
              <Link to="/forgot-password" className="forgot-password-link">
                {t("Şifremi Unuttum")}
              </Link>
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? t("Giriş yapılıyor...") : t("Giriş Yap")}
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
