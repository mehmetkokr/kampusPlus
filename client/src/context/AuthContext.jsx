import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
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
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token geçersizse oturumu temizle
        setToken(null);
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, [token]);

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

  function login(newToken, newUser, rememberMe = true) {
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
