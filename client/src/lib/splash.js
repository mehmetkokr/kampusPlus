// Açılış ekranının (index.html #boot-splash) kaldırılması.
//
// Ekran, uygulama gerçekten bir sayfa gösterene kadar durur: #root dolmuş ve
// içinde tam ekran yükleme ekranı kalmamış olmalı (lazy sayfa ve oturum
// kontrolü bitmiş). Sitenin her açılışında logo animasyonu sonuna kadar
// izlensin diye en az INTRO_MS beklenir (sayfa açılışından itibaren); otomatik
// test tarayıcılarında (theme-init.js) logo yalnızca REPEAT_MS görünür.
// Ardından logo büyüyüp solarak sayfaya geçer (bkz. styles/logo-loader.css).
const INTRO_MS = 3000;
const REPEAT_MS = 800;
const MAX_WAIT_MS = 10000; // bir şey takılsa bile açılış ekranı sonsuza dek kalmasın
const LEAVE_MS = 550;

export function hideSplashWhenReady() {
  const splash = document.getElementById('boot-splash');
  const root = document.getElementById('root');
  if (!splash || !root) return;

  const html = document.documentElement;
  const firstVisit = html.getAttribute('data-intro') !== 'seen';
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const minUntil = reduce ? 0 : firstVisit ? INTRO_MS : REPEAT_MS;

  let done = false;
  const leave = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(fallback);
    const wait = Math.max(0, minUntil - performance.now());
    setTimeout(() => {
      splash.classList.add('is-leaving');
      setTimeout(() => {
        splash.remove();
        // Uygulama içindeki sonraki yükleme ekranlarında sade hâl
        html.setAttribute('data-intro', 'seen');
      }, LEAVE_MS);
    }, wait);
  };

  const ready = () => root.childElementCount > 0 && !root.querySelector('.logo-loader.is-fullscreen');
  const observer = new MutationObserver(() => ready() && leave());
  observer.observe(root, { childList: true, subtree: true });
  const fallback = setTimeout(leave, MAX_WAIT_MS);
  if (ready()) leave();
}

// Açılış ekranı kalkmaya başlayınca (ya da hiç yoksa hemen) cb çağrılır.
// Altında bekleyen sayfa kendi giriş animasyonunu bu ana göre başlatır;
// yoksa animasyon açılış ekranının arkasında oynayıp bitmiş olur.
export function whenSplashLeaves(cb) {
  const splash = document.getElementById('boot-splash');
  if (!splash || splash.classList.contains('is-leaving')) {
    cb();
    return () => {};
  }
  const observer = new MutationObserver(() => {
    if (!splash.isConnected || splash.classList.contains('is-leaving')) {
      observer.disconnect();
      cb();
    }
  });
  observer.observe(splash, { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.body, { childList: true });
  return () => observer.disconnect();
}
