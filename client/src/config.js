// Backend sunucusunun adresi tek bir yerden yönetilir.
// .env dosyasındaki VITE_API_URL değişkeninden okunur.
// Tanımlı değilse (örn. .env dosyası eksikse) varsayılan olarak
// http://localhost:4000 kullanılır - backend'in çalıştığı varsayılan adres.
// Yayında (npm run build) site ve API aynı sunucudan verilir: adres boş kalır
// ve istekler aynı alan adına gider. Ayrı bir API adresi gerekirse VITE_API_URL ver.
// Telefon uygulamasında (Capacitor) dosyalar telefondan açıldığı için API her
// zaman canlı sunucudur.
import { isNative, PUBLIC_SITE_URL } from './lib/native';

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (isNative ? PUBLIC_SITE_URL : import.meta.env.PROD ? '' : 'http://localhost:4000');
