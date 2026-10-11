// Telefona yükleme (PWA) ve service worker kaydı.
// Service worker yalnızca yayın derlemesinde kaydolur; yerelde Vite'ın anında
// yenileme özelliğiyle karışmasın diye kapalıdır (VITE_SW_DEV=true ile açılır).

let installPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function registerServiceWorker() {
  // Önceki açılışta "yeni sürüm" yüzünden sayfa yenilendiyse işaret temizlenir
  setTimeout(() => {
    try {
      sessionStorage.removeItem('kp-chunk-reload');
    } catch {
      // önemsiz
    }
  }, 10000);

  // Tarayıcının kendi "yükle" önerisi yakalanır; Ayarlar'daki düğmeyle gösterilir
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    notify();
  });

  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD && import.meta.env.VITE_SW_DEV !== 'true') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const canPromptInstall = () => Boolean(installPrompt);

export async function promptInstall() {
  if (!installPrompt) return false;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  notify();
  return outcome === 'accepted';
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
