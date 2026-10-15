import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Loader2 } from './icons';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';

// Onay metinleri güncellendiğinde ya da onayı hiç alınmamış (eski) hesaplarda
// uygulamaya girişte bir kez gösterilir. Zorunlu iki onay verilmeden uygulama
// kullanılamaz; vermek istemeyen hesabını Ayarlar'dan silebilir.
export default function ConsentGate() {
  const { t } = useI18n();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const [terms, setTerms] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [marketing, setMarketing] = useState(Boolean(user?.marketingConsent));
  const [saving, setSaving] = useState(false);

  if (!user?.consentRequired) return null;

  async function submit(e) {
    e.preventDefault();
    if (!terms || !transfer) return;
    setSaving(true);
    try {
      const res = await api.put('/profile/me/consents', { terms: true, transfer: true, marketing });
      setUser((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      toast.error(err.response?.data?.error || t('Onay kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay consent-gate" role="presentation">
      <form className="modal-sheet consent-gate-sheet" role="dialog" aria-modal="true" aria-labelledby="consent-title" onSubmit={submit}>
        <div className="consent-gate-icon" aria-hidden="true">
          <ShieldCheck size={26} weight="fill" />
        </div>
        <h3 id="consent-title">{t('Şartlarımızı güncelledik')}</h3>
        <p className="consent-gate-lead">
          {t('Premium planları, beğeni hakları ve Boost ile birlikte kullanım şartlarımızı ve KVKK aydınlatma metnimizi güncelledik. Devam etmek için onayın gerekiyor.')}
        </p>

        <label className="consent-row">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>
            <Link to="/kullanim-sartlari" target="_blank" rel="noopener">{t('Kullanım Şartları')}</Link>
            {t('’nı ve ')}
            <Link to="/topluluk-kurallari" target="_blank" rel="noopener">{t('Topluluk Kuralları')}</Link>
            {t('’nı kabul ediyorum; kişisel verilerimin ')}
            <Link to="/gizlilik" target="_blank" rel="noopener">{t('KVKK Aydınlatma Metni')}</Link>
            {t('’ne göre işleneceğini okudum.')} <em>{t('(zorunlu)')}</em>
          </span>
        </label>
        <label className="consent-row">
          <input type="checkbox" checked={transfer} onChange={(e) => setTransfer(e.target.checked)} />
          <span>
            {t('Hizmetin çalışması için verilerimin yurt dışındaki sunucularda (ABD ve AB) saklanmasına ve işlenmesine açık rıza veriyorum.')} <em>{t('(zorunlu)')}</em>
          </span>
        </label>
        <label className="consent-row">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
          <span>
            {t('Kampanya, etkinlik ve yeniliklerden e-postayla haberdar olmak istiyorum.')} <em>{t('(isteğe bağlı)')}</em>
          </span>
        </label>

        <button type="submit" className="btn" disabled={saving || !terms || !transfer}>
          {saving ? <Loader2 size={16} className="spin" /> : null} {t('Onayla ve devam et')}
        </button>
        <p className="consent-gate-foot">
          {t('Onay vermek istemiyorsan hesabını Ayarlar > Hesabı Sil ile silebilirsin.')}{' '}
          <button type="button" className="consent-gate-logout" onClick={logout}>
            {t('Çıkış yap')}
          </button>
        </p>
      </form>
    </div>
  );
}
