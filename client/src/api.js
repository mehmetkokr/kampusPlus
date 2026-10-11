import axios from 'axios';
import { API_BASE_URL } from './config';
import { getAnonId } from './lib/telemetry';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Her isteğe, varsa token'ı otomatik ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Kayıt hunisi için anonim ziyaretçi kimliği (kişisel veri değildir)
  config.headers['X-Anon-Id'] = getAnonId();
  return config;
});

// Token artık geçersizse (süresi dolmuş, hesap silinmiş veya yasaklanmış)
// oturumu hemen temizle ve giriş sayfasına yönlendir. Böylece yasaklı bir
// kullanıcı bir sonraki isteğinde otomatik olarak dışarı atılır; sayfada
// takılı kalıp eski önbelleğe güvenmez.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Zorunlu iki adımlı doğrulama: kurmamış yönetici kurulum sayfasına yönlenir
    if (error.response?.data?.code === 'TWO_FACTOR_SETUP_REQUIRED' && window.location.pathname !== '/admin/settings') {
      window.location.href = '/admin/settings';
      return Promise.reject(error);
    }
    if (status === 401 || error.response?.data?.code === 'ACCOUNT_BANNED') {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Sohbet ekleri, öğrenci belgesi gibi "özel" dosyalar /api/files/... üzerinden,
// yetki kontrolüyle açılır. <img>/<audio>/<a> etiketleri başlık gönderemediği
// için adrese yalnızca dosya açmaya yarayan 24 saatlik anahtar eklenir; oturum
// anahtarı adrese asla yazılmaz (sunucu kayıtlarına ve geçmişe düşmesin).
// Anahtar girişte ve /profile/me ile gelir (bkz. AuthContext).
let fileToken = null;
export function setFileToken(value) {
  fileToken = value || null;
}

export function buildFileUrl(relativePath) {
  if (!relativePath) return undefined;
  if (relativePath.startsWith('/api/files/')) {
    return `${API_BASE_URL}${relativePath}${fileToken ? `?ft=${encodeURIComponent(fileToken)}` : ''}`;
  }
  return `${API_BASE_URL}${relativePath}`;
}
