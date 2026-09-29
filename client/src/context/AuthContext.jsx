import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

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

  // Kullanıcının tema tercihini <html> elementine uygula (CSS değişkenleri
  // [data-theme='light'] seçicisiyle geçersiz kılınıyor, bkz. index.css)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', user?.theme === 'light' ? 'light' : 'dark');
  }, [user?.theme]);

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
    setUser(newUser);
  }

  function logout() {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    document.documentElement.setAttribute('data-theme', 'dark');
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
