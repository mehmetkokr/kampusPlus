import React, { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../i18n';
import { currentSubscription, disablePush, enablePush, pushSupport } from '../lib/push';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/pwa';

// Ayarlar > Bildirimler: bu cihaza anlık bildirim ve uygulamayı ana ekrana yükleme
export default function PushSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const [support] = useState(pushSupport);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(support === 'denied');
  const [installable, setInstallable] = useState(canPromptInstall);

  useEffect(() => {
    currentSubscription()
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => {});
    return onInstallChange(() => setInstallable(canPromptInstall()));
  }, []);

  async function toggle(next) {
    setBusy(true);
    try {
      if (next) {
        const res = await enablePush();
        if (res.ok) {
          setEnabled(true);
          toast.success(t('Anlık bildirimler bu cihazda açıldı.'));
        } else if (res.reason === 'denied') {
          setDenied(true);
        }
      } else {
        await disablePush(null, { byUser: true });
        setEnabled(false);
      }
    } catch {
      toast.error(t('Anlık bildirimler açılamadı. Biraz sonra tekrar dene.'));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      await api.post('/push/test');
      toast.success(t('Deneme bildirimi gönderildi.'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('Deneme bildirimi gönderilemedi.'));
    }
  }

  let desc = t('Uygulama kapalıyken de bu cihaza bildirim gelsin.');
  if (support === 'ios-install') desc = t("iPhone'da önce uygulamayı ana ekrana ekle, sonra buradan aç.");
  else if (support === 'unsupported') desc = t('Bu tarayıcı anlık bildirimleri desteklemiyor.');
  else if (denied) desc = t('Bildirim izni tarayıcı ayarlarından kapatılmış. Açmak için tarayıcının site ayarlarına git.');
  const available = support === 'ok' && !denied;
  const showIosHint = isIOS() && !isStandalone();

  return (
    <>
      <div className="settings-row">
        <div>
          <div className="settings-row-label">{t('Anlık Bildirimler')}</div>
          <div className="settings-row-desc">{desc}</div>
          {available && enabled && (
            <button
              type="button"
              onClick={sendTest}
              style={{ marginTop: 4, minHeight: 32, padding: 0, border: 0, background: 'none', color: 'var(--amber-soft)', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {t('Deneme bildirimi gönder')}
            </button>
          )}
        </div>
        <label className="switch">
          <input
            type="checkbox"
            aria-label={t('Anlık Bildirimler')}
            checked={available && enabled}
            disabled={!available || busy}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="switch-track" />
        </label>
      </div>

      {installable && !isStandalone() && (
        <button
          type="button"
          className="settings-link-row"
          onClick={async () => {
            if (await promptInstall()) toast.success(t('kampüs· ana ekranına eklendi.'));
          }}
        >
          <div className="settings-link-row-icon">
            <Download size={18} aria-hidden="true" />
          </div>
          <div className="settings-link-row-text">
            <div className="settings-row-label">{t('Uygulamayı Yükle')}</div>
            <div className="settings-row-desc">{t('Ana ekranından tek dokunuşla aç, tam ekran kullan.')}</div>
          </div>
        </button>
      )}

      {showIosHint && (
        <div className="settings-row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="settings-row-label">{t('Ana Ekrana Ekle')}</div>
            <div className="settings-row-desc">
              {t('Safari’de alttaki Paylaş')} <Share size={13} aria-label={t('Paylaş')} style={{ verticalAlign: '-2px' }} />{' '}
              {t('düğmesine dokun, sonra “Ana Ekrana Ekle”yi seç.')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
