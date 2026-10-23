// Telefon uygulaması (Capacitor: iOS ve Android) ile tarayıcı arasındaki farklar
// tek yerde. Uygulama kodu aynıdır; yalnızca şu noktalar ayrışır:
//  - Uygulama dosyaları telefonun içinden (capacitor://localhost) açılır, API
//    ve yüklenen fotoğraflar canlı sunucudan gelir (config.js).
//  - Paylaşılan bağlantılar uygulamanın iç adresi değil, sitenin adresidir.
//  - Titreşim, durum çubuğu, geri tuşu ve bildirimler telefonun kendi
//    sistemleriyle çalışır.
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const nativePlatform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

// Sitenin herkese açık adresi: paylaşılan bağlantılar ve telefon uygulamasının API'si
export const PUBLIC_SITE_URL = 'https://kampusplus.com.tr';

// Paylaşılabilir bağlantı: tarayıcıda sitenin kendi adresi, uygulamada canlı site
export function shareUrl(path = '/') {
  const origin = isNative ? PUBLIC_SITE_URL : window.location.origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

// Kısa dokunsal geri bildirim. iPhone tarayıcısı navigator.vibrate'i
// desteklemez; uygulamada telefonun titreşim motoru kullanılır.
// pattern: tek süre (ms) ya da [titreşim, ara, titreşim, ...]
export async function haptic(pattern = 12) {
  if (isNative) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      const beats = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0) : [pattern];
      for (const [i, ms] of beats.entries()) {
        await Haptics.impact({ style: ms > 18 ? ImpactStyle.Medium : ImpactStyle.Light });
        const gap = Array.isArray(pattern) ? pattern[i * 2 + 1] : 0;
        if (gap) await new Promise((r) => setTimeout(r, gap));
      }
    } catch {
      // titreşim yoksa sessizce geç
    }
    return;
  }
  navigator.vibrate?.(pattern);
}

// Paylaş: uygulamada telefonun paylaşım menüsü (WhatsApp, Instagram, Mesajlar…),
// tarayıcıda bağlantı panoya kopyalanır. Dönen değer: 'shared' | 'copied' | 'cancelled'
export async function shareLink({ title, text, path }) {
  const url = shareUrl(path);
  if (isNative) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, url, dialogTitle: title });
      return 'shared';
    } catch {
      return 'cancelled'; // kullanıcı menüyü kapattı
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}

// Bağlantıyı uygulamanın içinde açılan tarayıcı penceresinde aç (gizlilik,
// sözleşmeler, dış siteler). Tarayıcıda yeni sekme.
export async function openInBrowser(url) {
  if (isNative) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
    return;
  }
  window.open(url, '_blank', 'noopener');
}

// Uygulamayı değerlendir: birkaç eşleşmeden sonra telefonun kendi puan
// penceresi, en fazla 120 günde bir. (Apple pencereyi yılda en çok 3 kez
// gösterir; gösterip göstermemeye kendisi karar verir.)
const REVIEW_KEY = 'kp-review';
export async function maybeAskForReview() {
  if (!isNative) return;
  try {
    const state = JSON.parse(localStorage.getItem(REVIEW_KEY) || '{}');
    state.matches = (state.matches || 0) + 1;
    const due = state.matches >= 3 && (!state.askedAt || Date.now() - state.askedAt > 120 * 86400000);
    if (due) state.askedAt = Date.now();
    localStorage.setItem(REVIEW_KEY, JSON.stringify(state));
    if (!due) return;
    // Eşleşme ekranı kapanıp kullanıcı mutlu anındayken
    setTimeout(async () => {
      const { InAppReview } = await import('@capacitor-community/in-app-review');
      InAppReview.requestReview().catch(() => {});
    }, 2500);
  } catch {
    // önemsiz
  }
}

// Dosyayı kaydet: tarayıcıda indirilir; uygulamada telefonun geçici klasörüne
// yazılıp paylaşım menüsü açılır (Dosyalar'a kaydet, Mail, AirDrop…).
export async function saveFile(blob, filename) {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
  await Share.share({ title: filename, files: [uri] }).catch(() => {});
}
