import React from 'react';
import '../styles/cube-loader.css';

// İzometrik kayan küp yükleme animasyonu.
// mode="fullscreen": uygulama açılırken / oturum kontrolünde tüm ekran
// mode="overlay"   : giriş-kayıt gibi işlemler sırasında sayfanın üstünde
// mode="inline"    : bir bölümün içinde
const CUBE = (
  <svg viewBox="0 0 48 56" aria-hidden="true">
    <polygon className="l" points="0,14 24,28 24,56 0,42" />
    <polygon className="r" points="24,28 48,14 48,42 24,56" />
    <polygon className="t" points="24,0 48,14 24,28 0,14" />
  </svg>
);

const SHADOW = (
  <svg viewBox="0 0 48 56" aria-hidden="true">
    <polygon points="24,0 48,14 24,28 0,14" />
  </svg>
);

export default function CubeLoader({ label = 'Yükleniyor', mode = 'inline' }) {
  return (
    <div
      className={`cube-loader ${mode === 'fullscreen' ? 'is-fullscreen' : ''} ${mode === 'overlay' ? 'is-overlay' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="cl-stage" aria-hidden="true">
        {['cl-a', 'cl-b', 'cl-c'].map((c) => (
          <span key={`s-${c}`} className={`cl-shadow ${c}`}>
            {SHADOW}
          </span>
        ))}
        {['cl-a', 'cl-b', 'cl-c'].map((c) => (
          <span key={c} className={`cl-cube ${c}`}>
            {CUBE}
          </span>
        ))}
      </div>
      <p className="cl-label">{label}</p>
    </div>
  );
}
