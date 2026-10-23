// Anlık bildirim aboneliği: izin isteme, cihazı kaydetme, kapatma.
// Tarayıcıda Web Push; telefon uygulamasında telefonun kendi bildirim sistemi
// (lib/nativePush.js). Dışarıya açılan fonksiyonlar ikisinde de aynıdır.
import api from '../api';
import { isIOS, isStandalone } from './pwa';
import { isNative } from './native';

const nativePush = () => import('./nativePush');

export function pushSupport() {
  if (isNative) return 'ok';
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  // iPhone/iPad'de anlık bildirim yalnızca ana ekrana eklenmiş uygulamada çalışır
  if (!supported && isIOS() && !isStandalone()) return 'ios-install';
  if (!supported) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

// Base64url açık anahtarı tarayıcının beklediği bayt dizisine çevir
function keyToBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  // Yerelde service worker kayıtlı değilse burada kaydedilir
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (isNative) return (await (await nativePush()).nativeSubscribed()) ? { native: true } : null;
  if (pushSupport() !== 'ok') return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

// Kullanıcı Ayarlar'dan kapattıysa bu tarayıcıda kendiliğinden yeniden açılmaz
const OFF_KEY = 'kp-push-off';
const setOff = (off) => {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1');
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // önemsiz
  }
};
const isOff = () => {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
};

export async function enablePush() {
  setOff(false);
  if (isNative) return (await nativePush()).enableNativePush();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' };
  const reg = await registration();
  const { data } = await api.get('/push/key');
  let sub = await reg.pushManager.getSubscription();
  // Sunucu anahtarı değiştiyse eski abonelik geçersizdir: yenisi alınır
  if (sub && sub.options?.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    const expected = keyToBytes(data.publicKey);
    if (current.length !== expected.length || current.some((b, i) => b !== expected[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(data.publicKey) });
  await api.post('/push/subscribe', { subscription: sub.toJSON() });
  return { ok: true };
}

// token: çıkış sırasında oturum bilgisi silinmeden önce alınan token
// byUser: kullanıcı Ayarlar'dan kapattı (çıkışta değil)
export async function disablePush(token, { byUser = false } = {}) {
  if (byUser) setOff(true);
  if (isNative) return (await nativePush()).disableNativePush(token);
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint }, headers }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// Uygulama açılınca ya da giriş yapılınca: bu tarayıcıda bildirim izni daha
// önce verildiyse abonelik sessizce (izin penceresi açılmadan) yenilenir ve
// giriş yapan hesaba bağlanır.
export async function resyncPush() {
  try {
    if (isOff()) return;
    // Uygulamada izin daha önce verildiyse cihaz anahtarı sessizce yenilenir
    if (isNative) {
      if ((await (await nativePush()).nativePermission()) === 'granted') await enablePush();
      return;
    }
    if (pushSupport() === 'ok' && Notification.permission === 'granted') await enablePush();
  } catch {
    // önemsiz
  }
}
