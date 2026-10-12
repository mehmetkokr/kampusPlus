// Temayı ilk boyamadan önce uygula: kayıtlı seçim (kp-theme), yoksa cihazın
// açık/koyu ayarı. Böylece sayfa açılırken yanlış renkte bir an görünmez.
// Ayrı dosyadadır: güvenlik politikası (CSP) satır içi betiğe izin vermez.
try {
  var saved = localStorage.getItem('kp-theme');
  var light = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
} catch (e) {}

// Uzun logo açılışı oturumda bir kez oynar (bkz. src/lib/splash.js): bu
// sekmede daha önce oynadıysa ilk ekranda logo yalnızca belirir.
try {
  if (sessionStorage.getItem('kp-intro')) document.documentElement.setAttribute('data-intro', 'seen');
} catch (e) {}
