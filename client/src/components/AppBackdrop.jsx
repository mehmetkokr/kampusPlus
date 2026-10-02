import React, { useEffect } from 'react';
import CampusSky from './CampusSky';

// Uygulama içi sayfaların arkasındaki canlı ortam: kampüs gökyüzünün sakin
// sürümü (renk moduna göre gece ya da sabah). Vurgu rengi tüm sayfalarda aynı.
const PAGE_ACCENT = '#e0835a';

export default function AppBackdrop() {
  useEffect(() => {
    document.documentElement.style.setProperty('--page-accent', PAGE_ACCENT);
  }, []);

  return <CampusSky variant="app" />;
}
