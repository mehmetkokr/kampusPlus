import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';

// Ayarlar > İzinler ve onaylar (KVKK): ticari ileti izni açılıp kapatılır;
// zorunlu onayların tarihi gösterilir ve nasıl geri çekileceği açıklanır.
export default function ConsentSettings() {
  const { t, lang } = useI18n();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const fmt = (d) => (d ? new Date(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR') : '—');

  async function setMarketing(value) {
    setSaving(true);
    setUser((prev) => ({ ...prev, marketingConsent: value }));
    try {
      const res = await api.put('/profile/me/consents', { marketing: value });
      setUser((prev) => ({ ...prev, ...res.data }));
      toast.success(value ? t('Kampanya e-postalarına izin verdin.') : t('Kampanya e-postası izni kapatıldı.'));
    } catch (err) {
      setUser((prev) => ({ ...prev, marketingConsent: !value }));
      toast.error(err.response?.data?.error || t('Tercih kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 4 }}>{t('İzinler ve onaylar')}</h3>
      <p className="muted consent-settings-lead" style={{ marginBottom: 12 }}>
        {t('KVKK kapsamında verdiğin onaylar. Ayrıntılar ')}
        <Link to="/gizlilik">{t('KVKK Aydınlatma Metni')}</Link>
        {t('’nde.')}
      </p>

      <div className="settings-row">
        <div>
          <div className="settings-row-label">{t('Kampanya ve yenilik e-postaları')}</div>
          <div className="settings-row-desc">{t('İsteğe bağlı. Kapatırsan hesabınla ilgili zorunlu e-postalar (doğrulama kodu, şifre sıfırlama) yine gelir.')}</div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            aria-label={t('Kampanya ve yenilik e-postaları')}
            checked={Boolean(user?.marketingConsent)}
            disabled={saving}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          <span className="switch-track" />
        </label>
      </div>

      <dl className="consent-dates">
        <div>
          <dt>{t('Kullanım şartları ve aydınlatma metni')}</dt>
          <dd>{t('Onaylandı: {date}', { date: fmt(user?.termsAcceptedAt) })}</dd>
        </div>
        <div>
          <dt>{t('Yurt dışına aktarım açık rızası')}</dt>
          <dd>{t('Verildi: {date}', { date: fmt(user?.transferConsentAt) })}</dd>
        </div>
      </dl>
      <p className="settings-row-desc" style={{ marginTop: 8 }}>
        {t('Zorunlu onaylar hizmetin çalışması için gerekli. Geri çekmek istersen Hesap > Hesabı Sil ile hesabını ve verilerini silebilir ya da taleplerini destek adresimize yazabilirsin.')}
      </p>
    </div>
  );
}
