import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user, rememberMe);
      if (res.data.reactivated) {
        toast.success('Hesabın yeniden aktifleştirildi. Tekrar hoş geldin!');
      }
      navigate('/discover');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />

      <Link to="/" className="auth-back">
        <ArrowLeft size={15} /> Anasayfa
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          kampüs<span className="dot">·</span>
        </div>
        <p className="auth-tagline">sadece kendi üniversitenden insanlarla tanış</p>

        <div className="auth-card">
          <h2>Tekrar hoş geldin</h2>
          <p className="muted">Hesabına giriş yap</p>

          <form onSubmit={handleSubmit}>
            <label>E-posta</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ornek@ogrenci.universite.edu.tr"
              required
            />

            <label>Şifre</label>
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
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
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
                Beni Hatırla
              </label>
              <Link to="/forgot-password" className="forgot-password-link">
                Şifremi Unuttum
              </Link>
            </div>

            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          <div className="auth-trust">
            <ShieldCheck size={13} /> Yalnızca doğrulanmış üniversite öğrencileri
          </div>
        </div>

        <p className="auth-foot">
          Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}
