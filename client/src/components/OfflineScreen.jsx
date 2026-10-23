import React, { useEffect, useState } from 'react';
import { Wifi, RotateCw } from './icons';
import { API_BASE_URL } from '../config';
import { isNative } from '../lib/native';
import { useI18n } from '../i18n';

// Telefon uygulamasında internet kesilince tam ekran "bağlantı yok" ekranı.
// Bağlantı gelince kendiliğinden kalkar; "Tekrar dene" sunucuya ulaşmayı dener.
// (Tarayıcıda service worker'ın çevrimdışı sayfası bu işi görür.)
export default function OfflineScreen() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(() => isNative && navigator.onLine === false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!isNative) return undefined;
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  async function retry() {
    setChecking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, { cache: 'no-store' });
      if (res.ok) setOffline(false);
    } catch {
      // hâlâ bağlantı yok
    } finally {
      setChecking(false);
    }
  }

  if (!offline) return null;
  return (
    <div className="offline-screen" role="alertdialog" aria-modal="true" aria-labelledby="offline-title" aria-describedby="offline-desc">
      <span className="offline-icon" aria-hidden="true">
        <Wifi size={30} />
      </span>
      <h2 id="offline-title">{t('İnternet bağlantısı yok')}</h2>
      <p id="offline-desc">{t('Wi-Fi ya da mobil veriyi kontrol et. Bağlantı gelince kaldığın yerden devam edersin.')}</p>
      <button type="button" className="btn" onClick={retry} disabled={checking}>
        <RotateCw size={17} className={checking ? 'spin' : ''} /> {t('Tekrar dene')}
      </button>
    </div>
  );
}
