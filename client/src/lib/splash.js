// Açılış ekranının (index.html #boot-splash) kaldırılması.
//
// Ekran, uygulama gerçekten bir sayfa gösterene kadar durur: #root dolmuş ve
// içinde tam ekran yükleme ekranı kalmamış olmalı (lazy sayfa ve oturum
// kontrolü bitmiş). Oturumdaki ilk açılışta logo animasyonu sonuna kadar
// izlensin diye en az INTRO_MS, sonraki açılışlarda logo bir an net görünsün
// diye en az REPEAT_MS beklenir (sayfa açılışından itibaren).
// Ardından logo büyüyüp solarak sayfaya geçer (bkz. styles/logo-loader.css).
const INTRO_MS = 2700;
const REPEAT_MS = 800;
const MAX_WAIT_MS = 10000; // bir şey takılsa bile açılış ekranı sonsuza dek kalmasın
const LEAVE_MS = 550;

export function hideSplashWhenReady() {
  const splash = document.getElementById('boot-splash');
  const root = document.getElementById('root');
  if (!splash || !root) return;

  const html = document.documentElement;
  const firstVisit = html.getAttribute('data-intro') !== 'seen';
  try {
    sessionStorage.setItem('kp-intro', '1');
  } catch {
    // gizli sekme vb.: her açılışta tam animasyon oynar, sorun değil
  }
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
        // Sonraki sayfa geçişlerinde ve aynı sekmedeki açılışlarda sade hâl
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
