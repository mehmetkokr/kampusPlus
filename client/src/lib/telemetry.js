// Hata takibi ve kullanım analitiği (tarayıcı tarafı).
// - Hatalar /api/telemetry/errors'a gider; VITE_SENTRY_DSN ile derlendiyse
//   Sentry'ye de gönderilir.
// - Olaylar biriktirilip /api/telemetry/events'e toplu gönderilir.
// Ziyaretçi, tarayıcıda üretilen rastgele bir anonim kimlikle sayılır; IP,
// cihaz veya konum bilgisi gönderilmez. Hiçbir hata uygulamayı bozmaz.
import { API_BASE_URL } from '../config';

const ENDPOINT = `${API_BASE_URL}/api/telemetry`;
const ANON_KEY = 'kp-anon';
const MAX_ERRORS_PER_SESSION = 10;
const FLUSH_MS = 5000;

let anonId = null;
export function getAnonId() {
  if (anonId) return anonId;
  try {
    anonId = localStorage.getItem(ANON_KEY);
    if (!anonId) {
      anonId = (crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`).toLowerCase();
      localStorage.setItem(ANON_KEY, anonId);
    }
  } catch {
    // Gizli sekme vb.: bu oturumluk kimlik
    anonId = anonId || `s-${Math.random().toString(36).slice(2, 14)}`;
  }
  return anonId;
}

function authHeader() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function post(path, body) {
  try {
    return fetch(`${ENDPOINT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(body),
      keepalive: true, // sayfa kapanırken de gönderilsin
    }).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

// ---------------- Analitik ----------------
let queue = [];
let timer = null;

export function flushEvents() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  post('/events', { anonId: getAnonId(), events });
  if (queue.length) flushEvents();
}

let lastView = { path: null, at: 0 };

export function track(name, props) {
  if (import.meta.env.MODE === 'test') return;
  // Aynı sayfanın art arda iki kez sayılmasını önle (geliştirmede StrictMode, yönlendirmeler)
  if (name === 'page_view') {
    const path = window.location.pathname;
    if (lastView.path === path && Date.now() - lastView.at < 1500) return;
    lastView = { path, at: Date.now() };
  }
  queue.push({ name, path: window.location.pathname, ...(props ? { props } : {}) });
  if (queue.length >= 10) flushEvents();
  else if (!timer) timer = setTimeout(flushEvents, FLUSH_MS);
}

// ---------------- Hatalar ----------------
const seen = new Set();
let sentry = null;

export function reportError(error, extra = {}) {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Bilinmeyen hata');
    const key = `${err.message}|${(err.stack || '').split('\n')[1] || ''}`;
    if (seen.has(key) || seen.size >= MAX_ERRORS_PER_SESSION) return;
    seen.add(key);
    sentry?.captureException(err, { extra });
    if (import.meta.env.DEV) return; // yerelde konsol yeterli
    post('/errors', {
      message: err.message || err.name,
      stack: err.stack,
      componentStack: extra.componentStack,
      path: window.location.pathname,
    });
  } catch {
    // raporlama hiçbir zaman yeni hata üretmemeli
  }
}

// Tarayıcı eklentileri ve ağ kesintisi kaynaklı, bizim düzeltemeyeceğimiz gürültü
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i, /Network Error/i, /Load failed/i, /AbortError/i];

export function installTelemetry() {
  getAnonId();
  window.addEventListener('error', (e) => {
    const msg = e.error?.message || e.message || '';
    if (IGNORED.some((re) => re.test(msg))) return;
    reportError(e.error || new Error(msg));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    // Axios istek hataları (4xx/5xx) zaten sayfada ele alınır, hata sayılmaz
    if (reason?.isAxiosError || reason?.response) return;
    const msg = reason?.message || String(reason || '');
    if (IGNORED.some((re) => re.test(msg))) return;
    reportError(reason instanceof Error ? reason : new Error(msg));
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents();
  });
  window.addEventListener('pagehide', flushEvents);
  window.addEventListener('appinstalled', () => track('pwa_installed'));

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    import('@sentry/browser')
      .then((S) => {
        S.init({ dsn, environment: import.meta.env.MODE, sendDefaultPii: false, tracesSampleRate: 0 });
        sentry = S;
      })
      .catch(() => {});
  }
}
