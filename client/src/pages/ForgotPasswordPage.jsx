import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import AuthBackdrop from '../components/AuthBackdrop';
import { useI18n } from '../i18n';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'İstek gönderilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />

      <ThemeToggle className="auth-theme-toggle" />

      <Link to="/login" className="auth-back">
        <ArrowLeft size={15} /> {t("Girişe Dön")}
      </Link>

      <div className="auth-content">
        <div className="auth-wordmark">
          {t("kampüs")}<span className="dot">·</span>
        </div>
        <p className="auth-tagline">{t("şifreni sıfırlayalım")}</p>

        <div className="auth-card">
          {sent ? (
            <div className="empty-state">
              <div className="empty-icon"><MailCheck size={28} /></div>
              <h3>{t("E-postanı Kontrol Et")}</h3>
              <p className="muted">
                {t('{email} ile bir hesap varsa, şifre sıfırlama bağlantısı gönderildi.', { email })}
              </p>
            </div>
          ) : (
            <>
              <h2>{t("Şifremi Unuttum")}</h2>
              <p className="muted">{t("Kayıtlı e-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.")}</p>

              <form onSubmit={handleSubmit}>
                <label>{t("E-posta")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("ornek@ogrenci.universite.edu.tr")}
                  required
                />

                <button className="btn" type="submit" disabled={loading}>
                  {loading ? t("Gönderiliyor...") : t("Sıfırlama Bağlantısı Gönder")}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="auth-foot">
          {t("Hesabın yok mu?")} <Link to="/register">{t("Kayıt Ol")}</Link>
        </p>
      </div>
    </div>
  );
}
