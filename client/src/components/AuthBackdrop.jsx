import React from 'react';
import CampusSky from './CampusSky';

// Giriş/kayıt/şifre ekranlarının arka planı: kampüs gökyüzünün tam sürümü
// (koyu modda gece, açık modda sabah; fareyle hafif derinlik).
export default function AuthBackdrop() {
  return <CampusSky variant="auth" />;
}
