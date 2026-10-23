// Telefon uygulamasında (Capacitor) anlık bildirim: iOS'ta Apple, Android'de
// Google bildirim sistemi. lib/push.js uygulama içindeyse buraya yönlendirir;
// Ayarlar ekranı ve oturum akışı aynı fonksiyonları kullanır.
import { PushNotifications } from '@capacitor/push-notifications';
import api from '../api';
import { nativePlatform } from './native';

const TOKEN_KEY = 'kp-device-token';

const savedToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
const saveToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // önemsiz
  }
};

// Telefonun bildirim sisteminden cihaz anahtarını al
function registerForToken() {
  return new Promise((resolve, reject) => {
    const handles = [];
    const done = (fn, value) => {
      handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => done(reject, new Error('timeout')), 15000);
    handles.push(PushNotifications.addListener('registration', (t) => done(resolve, t.value)));
    handles.push(PushNotifications.addListener('registrationError', (e) => done(reject, new Error(e?.error || 'registration'))));
    PushNotifications.register().catch((e) => done(reject, e));
  });
}

export async function nativePermission() {
  try {
    return (await PushNotifications.checkPermissions()).receive;
  } catch {
    return 'denied';
  }
}

export async function enableNativePush() {
  let receive = await nativePermission();
  if (receive === 'prompt' || receive === 'prompt-with-rationale') receive = (await PushNotifications.requestPermissions()).receive;
  if (receive !== 'granted') return { ok: false, reason: receive === 'denied' ? 'denied' : 'dismissed' };
  const token = await registerForToken();
  await api.post('/push/device', { token, platform: nativePlatform });
  saveToken(token);
  return { ok: true };
}

// authToken: çıkışta oturum bilgisi silinmeden önce alınan token
export async function disableNativePush(authToken) {
  const token = savedToken();
  saveToken(null);
  if (!token) return;
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
  await api.delete('/push/device', { data: { token }, headers }).catch(() => {});
}

export async function nativeSubscribed() {
  return Boolean(savedToken()) && (await nativePermission()) === 'granted';
}
