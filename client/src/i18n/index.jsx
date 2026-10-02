import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import en, { patterns as enPatterns } from './en';

// Hafif çoklu dil desteği. Anahtar olarak Türkçe metnin kendisi kullanılır:
//   t('Keşfet')                     -> "Discover" (İngilizce seçiliyse)
//   t('{n} kişi seni beğendi', { n }) -> "{n} people liked you" + değişken
// Sözlükte karşılığı olmayan metin Türkçe gösterilir (hiçbir şey bozulmaz).
//
// Dil kaynağı: giriş yapılmışsa hesabın tercihi (user.language), değilse
// tarayıcıda hatırlanan seçim, o da yoksa tarayıcının dili.
const STORAGE_KEY = 'kp-lang';
const DICTS = { en };
const PATTERNS = { en: enPatterns };

function readStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    // depolama kapalı olabilir
  }
  return typeof navigator !== 'undefined' && /^en\b/i.test(navigator.language || '') ? 'en' : 'tr';
}

function interpolate(text, vars) {
  if (typeof text !== 'string' || !vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

const I18nContext = createContext({ lang: 'tr', t: (s, v) => interpolate(s, v), setLang: () => {} });

export function I18nProvider({ children }) {
  const { user, setUser } = useAuth();
  const [guestLang, setGuestLang] = useState(readStoredLang);
  const lang = user?.language === 'en' || user?.language === 'tr' ? user.language : guestLang;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback(
    (text, vars) => {
      if (typeof text !== 'string') return text;
      const dict = DICTS[lang];
      if (dict && dict[text] !== undefined) return interpolate(dict[text], vars);
      for (const [re, fn] of PATTERNS[lang] || []) {
        const m = text.match(re);
        if (m) return fn(m);
      }
      return interpolate(text, vars);
    },
    [lang]
  );

  const setLang = useCallback(
    async (next) => {
      if (next !== 'tr' && next !== 'en') return;
      setGuestLang(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // depolama kapalıysa yalnızca bu oturumda geçerli
      }
      if (user) {
        setUser((prev) => ({ ...prev, language: next }));
        await api.put('/profile/me/appearance', { language: next }).catch(() => {});
      }
    },
    [user, setUser]
  );

  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
