import React from 'react';
import '../styles/logo-loader.css';

// Uygulama simgesinin animasyonlu hâli (bkz. styles/logo-loader.css).
// mode="fullscreen": sayfa yüklenirken / oturum kontrolünde tüm ekran
// mode="overlay"   : giriş-kayıt gibi işlemler sırasında sayfanın üstünde
// mode="inline"    : bir bölümün içinde
// Uygulama içinde her zaman sade hâl görünür (logo belirir). Uzun açılış
// animasyonu yalnızca index.html'deki ilk ekranda (#boot-splash) oynar.
export default function LogoLoader({ label = 'Yükleniyor', mode = 'inline' }) {
  return (
    <div
      className={`logo-loader ${mode === 'fullscreen' ? 'is-fullscreen' : ''} ${mode === 'overlay' ? 'is-overlay' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="ll-stage" aria-hidden="true">
        <div className="ll-mark">
          <svg viewBox="0 0 64 64">
            <path className="ll-k" pathLength="1" d="M19 14h7.5v20.2L37.6 23h9.2L34.7 34.6 48 50h-9.4l-9.4-11.4-2.7 2.6V50H19z" />
            <circle className="ll-ring" cx="52.5" cy="46" r="4.2" />
            <circle className="ll-dot" cx="52.5" cy="46" r="4.2" />
          </svg>
          <span className="ll-sheen" />
        </div>
      </div>
      <div className="ll-foot">
        <p className="ll-label">{label}</p>
      </div>
    </div>
  );
}
