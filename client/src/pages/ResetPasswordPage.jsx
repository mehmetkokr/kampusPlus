import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!token) {
      toast.error('Bağlantı geçersiz. Lütfen e-postandaki bağlantıyı kullan.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Şifre sıfırlanırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />

      <Link to="/login" className="auth-back">
        <ArrowLeft size={15} /> Girişe Dön
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          kampüs<span className="dot">·</span>
        </div>
        <p className="auth-tagline">yeni şifreni belirle</p>

        <div className="auth-card">
          {!token ? (
            <div className="empty-state">
              <div className="empty-icon"><KeyRound size={28} /></div>
              <h3>Bağlantı Geçersiz</h3>
              <p className="muted">
                Bu bağlantı eksik veya bozuk görünüyor. Şifre sıfırlama işlemini e-postandaki
                bağlantı üzerinden başlatmayı dene.
              </p>
              <Link to="/forgot-password" className="btn" style={{ marginTop: 16, display: 'inline-block' }}>
                Yeni Bağlantı İste
              </Link>
            </div>
          ) : done ? (
            <div className="empty-state">
              <div className="empty-icon"><CheckCircle2 size={28} /></div>
              <h3>Şifren Güncellendi</h3>
              <p className="muted">Artık yeni şifrenle giriş yapabilirsin.</p>
              <button className="btn" style={{ marginTop: 16 }} onClick={() => navigate('/login')}>
                Girişe Git
              </button>
            </div>
          ) : (
            <>
              <h2>Yeni Şifre Belirle</h2>
              <p className="muted">Hesabın için yeni bir şifre gir. En az 8 karakter olmalıdır.</p>

              <form onSubmit={handleSubmit}>
                <label>Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />

                <label>Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={8}
                  required
                />

                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-foot">
          Hesabın yok mu? <Link to="/register">Kayıt Ol</Link>
        </p>
      </div>
    </div>
  );
}
