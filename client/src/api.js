import axios from 'axios';
import { API_BASE_URL } from './config';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Her isteğe, varsa token'ı otomatik ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

// Sohbet ekleri, öğrenci belgesi gibi "özel" dosyalar artık /api/files/...
// üzerinden, kimlik doğrulamasıyla servis ediliyor. <img>/<audio>/<a> gibi
// etiketler Authorization header'ı gönderemediği için, token'ı burada sorgu
// parametresi olarak ekliyoruz (yalnızca bu korumalı yol için).
export function buildFileUrl(relativePath) {
  if (!relativePath) return undefined;
  if (relativePath.startsWith('/api/files/')) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    return `${API_BASE_URL}${relativePath}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
  return `${API_BASE_URL}${relativePath}`;
}
