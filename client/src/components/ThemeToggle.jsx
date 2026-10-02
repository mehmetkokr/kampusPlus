import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { applyTheme, currentTheme, markGuestThemeChoice } from '../utils/theme';

// Açık / koyu mod düğmesi. Her yerde aynı davranır:
// - Oturum açıksa seçim hemen hesaba kaydedilir (Ayarlar'a gitmeye gerek yok).
// - Oturum yoksa seçim tarayıcıda hatırlanır ve giriş/kayıt sonrası hesaba
//   aktarılır; yani ana sayfada seçilen mod uygulamada da geçerli olur.
export default function ThemeToggle({ className = '' }) {
  const { t } = useI18n();
  const { user, setUser } = useAuth();
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const onChange = (e) => setTheme(e.detail);
    window.addEventListener('kp-theme-change', onChange);
    return () => window.removeEventListener('kp-theme-change', onChange);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(applyTheme(next, { remember: true }));
    if (user) {
      setUser((prev) => (prev ? { ...prev, theme: next } : prev));
      api.put('/profile/me/appearance', { theme: next }).catch(() => {});
    } else {
      markGuestThemeChoice();
    }
  }

  // Uygulama başlığındaki ikon düğmeleriyle (zil, dişli) aynı görünsün
  const base = className.includes('icon-btn-amber') ? '' : 'theme-toggle-btn';
  const label = theme === 'light' ? t('Koyu moda geç') : t('Açık moda geç');
  return (
    <button type="button" className={`${base} ${className}`.trim()} onClick={toggle} aria-label={label} title={label}>
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
