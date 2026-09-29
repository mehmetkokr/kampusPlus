// Backend sunucusunun adresi tek bir yerden yönetilir.
// .env dosyasındaki VITE_API_URL değişkeninden okunur.
// Tanımlı değilse (örn. .env dosyası eksikse) varsayılan olarak
// http://localhost:4000 kullanılır - backend'in çalıştığı varsayılan adres.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
