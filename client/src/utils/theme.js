// Tek yerden tema yönetimi. Tüm sayfalar (tanıtım, giriş/kayıt, uygulama)
// aynı paleti kullanır; yalnızca açık/koyu mod değişir.
//
// Öncelik: oturum açıksa hesabın tercihi (user.theme) → tarayıcıda
// hatırlanan seçim (kp-theme) → cihazın açık/koyu ayarı.
const KEY = 'kp-theme';
const META_COLOR = { light: '#faf8f4', dark: '#100f0d' };

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

// Temayı uygular; remember=true ise seçimi tarayıcıda saklar
export function applyTheme(theme, { remember = false } = {}) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[t]);
  if (remember) {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // depolama kapalıysa yalnızca bu oturumda geçerli
    }
  }
  window.dispatchEvent(new CustomEvent('kp-theme-change', { detail: t }));
  return t;
}

// Oturum yokken (ana sayfa, giriş/kayıt) yapılan seçimi işaretler; giriş ya da
// kayıttan sonra bu seçim hesabın tercihine aktarılır (bkz. AuthContext.login).
const GUEST_FLAG = 'kp-theme-guest';

export function markGuestThemeChoice() {
  try {
    localStorage.setItem(GUEST_FLAG, '1');
  } catch {
    // yok say
  }
}

// Bekleyen misafir seçimini döndürür ve işareti temizler (yoksa null)
export function takeGuestThemeChoice() {
  try {
    if (localStorage.getItem(GUEST_FLAG) !== '1') return null;
    localStorage.removeItem(GUEST_FLAG);
    return getStoredTheme();
  } catch {
    return null;
  }
}
