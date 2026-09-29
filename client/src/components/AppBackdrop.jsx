import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Uygulama içi sayfaların arkasındaki ortam ışığı. Cam (glass) yüzeylerin
// bulanıklaştıracak bir şeyi olsun diye yavaşça süzülen renkli ışık küreleri
// çizer; renkler bulunulan menüye göre yumuşak geçişle değişir.
const PALETTES = [
  { match: '/discover', a: '#3b82f6', b: '#8b5cf6', c: '#22d3ee', accent: '#60a5fa' },
  { match: '/feed', a: '#e8a33d', b: '#e2596b', c: '#8b5cf6', accent: '#f0b25c' },
  { match: '/clubs', a: '#8b5cf6', b: '#45d8c0', c: '#e8a33d', accent: '#a78bfa' },
  { match: '/classmates', a: '#45d8c0', b: '#3b82f6', c: '#a3e635', accent: '#45d8c0' },
  { match: '/confessions', a: '#ec4899', b: '#8b5cf6', c: '#e2596b', accent: '#f472b6' },
  { match: '/matches', a: '#45d8c0', b: '#e8a33d', c: '#3b82f6', accent: '#45d8c0' },
  { match: '/chat', a: '#45d8c0', b: '#e8a33d', c: '#3b82f6', accent: '#45d8c0' },
  { match: '/group', a: '#45d8c0', b: '#8b5cf6', c: '#e8a33d', accent: '#45d8c0' },
  { match: '/profile', a: '#e8a33d', b: '#8b5cf6', c: '#45d8c0', accent: '#f0b25c' },
  { match: '/settings', a: '#8b5cf6', b: '#e8a33d', c: '#3b82f6', accent: '#a78bfa' },
  { match: '/notifications', a: '#e8a33d', b: '#3b82f6', c: '#e2596b', accent: '#f0b25c' },
];

const DEFAULT_PALETTE = { a: '#e8a33d', b: '#45d8c0', c: '#8b5cf6', accent: '#f0b25c' };

export function paletteFor(pathname) {
  return PALETTES.find((p) => pathname.startsWith(p.match)) || DEFAULT_PALETTE;
}

export default function AppBackdrop() {
  const { pathname } = useLocation();
  const palette = paletteFor(pathname);

  // Vurgu rengini kök elemana yaz: navbar ve sayfa başlıkları bunu kullanır
  useEffect(() => {
    document.documentElement.style.setProperty('--page-accent', palette.accent);
  }, [palette.accent]);

  return (
    <div className="app-backdrop" aria-hidden="true">
      <div className="app-orb app-orb-a" style={{ backgroundColor: palette.a }} />
      <div className="app-orb app-orb-b" style={{ backgroundColor: palette.b }} />
      <div className="app-orb app-orb-c" style={{ backgroundColor: palette.c }} />
      <div className="app-grid" />
      <div className="auth-grain" />
      <div className="app-vignette" />
    </div>
  );
}
