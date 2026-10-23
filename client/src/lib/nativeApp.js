// Telefon uygulaması açılışı (yalnızca Capacitor içinde çalışır):
//  - Durum çubuğu yazıları temaya göre (koyu modda açık, açık modda koyu)
//  - Android geri tuşu: önceki sayfa, ilk sayfadaysa uygulamadan çık
//  - Bildirime ya da kampusplus.com.tr bağlantısına dokununca uygulamada o sayfa
//  - Gizlilik/sözleşme sayfaları ve dış siteler uygulama içi tarayıcı penceresinde
//  - <html class="is-native">: uzun basınca metin seçimi/baloncuk gibi web
//    davranışları CSS'te kapatılır (styles/native.css)
// Sayfa değişimi, React Router'ı bilen NativeNavigation bileşenine
// "kp-navigate" olayıyla iletilir (App.jsx).
import { isNative, nativePlatform, openInBrowser, PUBLIC_SITE_URL } from './native';

// Uygulamanın kendi ekranı olmayan, okunacak belgeler: tarayıcı penceresinde açılır
const DOCUMENT_PATHS = ['/gizlilik', '/kullanim-sartlari', '/topluluk-kurallari', '/mesafeli-satis-sozlesmesi'];

export const NAVIGATE_EVENT = 'kp-navigate';
const go = (path) => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: path }));

// Tam adres ya da yol → uygulama içi yol (başka sitelere ait adresler yok sayılır)
export function appPath(url) {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  try {
    const u = new URL(url);
    const site = new URL(PUBLIC_SITE_URL);
    if (u.hostname !== site.hostname && u.hostname !== `www.${site.hostname}`) return null;
    return `${u.pathname}${u.search}${u.hash}` || '/';
  } catch {
    return null;
  }
}

// Bağlantı tıklamalarını yakala: belge sayfaları ve başka siteler uygulamanın
// içinde değil, üstte açılan tarayıcı penceresinde açılır
function interceptLinks() {
  document.addEventListener(
    'click',
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      const internal = url.origin === window.location.origin;
      if (internal && DOCUMENT_PATHS.includes(url.pathname)) {
        e.preventDefault();
        openInBrowser(`${PUBLIC_SITE_URL}${url.pathname}${url.search}`);
      } else if (!internal && /^https?:$/.test(url.protocol)) {
        const path = appPath(url.href);
        e.preventDefault();
        // kampusplus.com.tr sayfası uygulamanın kendi ekranında açılır; dosyalar
        // (sohbet ekleri, fotoğraflar) ve belgeler tarayıcı penceresinde
        const isFile = path && /^\/(api|uploads)\//.test(path);
        if (path && !isFile && !DOCUMENT_PATHS.includes(url.pathname)) go(path);
        else openInBrowser(url.href);
      }
    },
    true
  );
}

export async function initNativeApp() {
  if (!isNative) return;
  document.documentElement.classList.add('is-native');
  interceptLinks();
  const [{ App }, { StatusBar, Style }, { PushNotifications }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/push-notifications'),
  ]);

  // Durum çubuğu: tema değiştikçe yazı rengi uyar
  const syncStatusBar = () => {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    StatusBar.setStyle({ style: light ? Style.Light : Style.Dark }).catch(() => {});
    // Android'de çubuğun zemini de sayfa rengine uyar (iOS'ta sayfa çubuğun altına uzanır)
    if (nativePlatform === 'android') StatusBar.setBackgroundColor({ color: light ? '#f5f5f7' : '#000000' }).catch(() => {});
  };
  syncStatusBar();
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Android geri tuşu
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) window.history.back();
    else App.exitApp();
  });

  // kampusplus.com.tr bağlantısı uygulamayı açtıysa (evrensel bağlantı)
  App.addListener('appUrlOpen', ({ url }) => {
    const path = appPath(url);
    if (path) go(path);
  });

  // Bildirime dokunuldu: ilgili sayfayı aç
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const path = appPath(notification?.data?.url);
    go(path || '/notifications');
  });
}
