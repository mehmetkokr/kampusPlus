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
          <svg viewBox="11.5 4.5 52.5 52.5">
            <path className="ll-stem" d="M13 9h11v46H13z" />
            <path className="ll-arm" d="M21 41 37 9h11L25 50z" />
            <path className="ll-leg" d="M21 26h11l18 29H39z" />
            <path className="ll-fold" d="M24 26h8l5 8-13 6z" />
            <circle className="ll-ring" cx="55" cy="14" r="6" />
            <path className="ll-dot" d="M55 8.5v11M49.5 14h11" />
          </svg>
        </div>
      </div>
      <div className="ll-foot">
        <p className="ll-label">{label}</p>
      </div>
    </div>
  );
}
