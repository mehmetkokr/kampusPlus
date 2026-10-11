import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setFileToken } from '../api';
import { disablePush, resyncPush } from '../lib/push';
import { applyTheme, getStoredTheme, systemTheme, takeGuestThemeChoice } from '../utils/theme';

const AuthContext = createContext(null);

// Kayıt formu kısa; doğum tarihi, bölüm ve sınıf e-posta doğrulandıktan sonra
// başlangıç ekranında (/welcome) alınır. Bunlar eksikken uygulamaya geçilmez.
// Profil henüz tam yüklenmediyse (alan hiç yoksa) karar verilmez.
export function needsBasics(user) {
  if (!user || user.isAdmin || !('department' in user)) return false;
  return !user.department || !user.classYear || !user.birthDate;
}

// "Beni Hatırla" işaretliyse token localStorage'da (tarayıcı kapansa da kalır),
// işaretli değilse sessionStorage'da (sekme kapanınca silinir) tutulur.
function readStoredToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Token varsa, kullanıcı profilini çek
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/profile/me')
      .then((res) => {
        setFileToken(res.data.fileToken);
        setUser(res.data);
      })
      .catch(() => {
        // Token geçersizse oturumu temizle
        setToken(null);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Bildirim izni daha önce verildiyse bu cihazın aboneliği giriş yapan hesaba bağlanır
  useEffect(() => {
    if (user?.id) resyncPush();
  }, [user?.id]);

  // Tema: oturum açıksa hesabın tercihi; değilse (tanıtım, giriş/kayıt)
  // tarayıcıda hatırlanan seçim ya da cihazın açık/koyu ayarı. Tüm sayfalar
  // aynı paleti kullanır, yalnızca mod değişir (bkz. utils/theme.js).
  useEffect(() => {
    if (user) {
      applyTheme(user.theme === 'light' ? 'light' : 'dark', { remember: true });
    } else if (!loading) {
      applyTheme(getStoredTheme() || systemTheme());
    }
  }, [user, user?.theme, loading]);

  // Sunucu oturumu kapattı (askıya alma, tüm cihazlardan çıkış, şifre
  // değişikliği): bu cihazda da çıkış yapılır ve giriş ekranına dönülür
  useEffect(() => {
    const onEnded = (e) => {
      const reason = e.detail?.reason;
      logout();
      if (window.location.pathname !== '/login') window.location.href = `/login${reason ? `?reason=${encodeURIComponent(reason)}` : ''}`;
    };
    window.addEventListener('kp-session-ended', onEnded);
    return () => window.removeEventListener('kp-session-ended', onEnded);
    // logout yalnızca durum ayarlayıcıları kullanır; dinleyici bir kez kurulur
  }, []);

  // Dosya anahtarı 24 saat geçerli: uygulama uzun süre açık kalırsa yenilenir
  useEffect(() => {
    if (!token) return undefined;
    const id = setInterval(() => {
      api.get('/profile/me').then((res) => setFileToken(res.data.fileToken)).catch(() => {});
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [token]);

  function login(newToken, newUser, rememberMe = true, newFileToken = null) {
    setFileToken(newFileToken);
    // Önce her iki depolamayı da temizle, sonra tercihe göre yaz
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    if (rememberMe) {
      localStorage.setItem('token', newToken);
    } else {
      sessionStorage.setItem('token', newToken);
    }
    setToken(newToken);

    // Giriş yapmadan önce (ana sayfa, giriş/kayıt ekranı) açık/koyu seçildiyse
    // en son seçim geçerli olur ve hesaba da kaydedilir.
    const guestTheme = takeGuestThemeChoice();
    if (guestTheme && guestTheme !== newUser?.theme) {
      setUser({ ...newUser, theme: guestTheme });
      api.put('/profile/me/appearance', { theme: guestTheme }).catch(() => {});
      return;
    }
    setUser(newUser);
  }

  function logout() {
    setFileToken(null);
    // Gerçek zamanlı bağlantı modülü ayrı parçada; yalnızca açılmışsa kapatılır
    import('../lib/socket').then((m) => m.closeSocket()).catch(() => {});
    // Bu cihaz artık çıkış yapan hesabın bildirimlerini almasın
    disablePush(localStorage.getItem('token') || sessionStorage.getItem('token'));
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    // Çıkışta tema korunur: tanıtım ve giriş sayfaları da aynı modda kalır
  }

  return (
    <AuthContext.Provider value={{ token, user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
