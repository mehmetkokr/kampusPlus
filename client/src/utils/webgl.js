import { useEffect, useRef, useState } from 'react';
import { currentTheme } from './theme';

// 3D efektler için ortak yardımcılar. WebGL yoksa ya da kullanıcı hareketi
// azaltmayı seçtiyse bileşenler sade (statik) görünüme düşer.

let webglCache;
export function hasWebGL() {
  if (webglCache !== undefined) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    webglCache = !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

// Açık/koyu mod değişince yeniden çizilsin (applyTheme bir olay yayınlar)
export function useThemeMode() {
  const [mode, setMode] = useState(() => currentTheme());
  useEffect(() => {
    const onChange = () => setMode(currentTheme());
    window.addEventListener('kp-theme-change', onChange);
    return () => window.removeEventListener('kp-theme-change', onChange);
  }, []);
  return mode;
}

// Öğe ekrana yaklaşınca true; 3D sahne yalnızca görünürken çizilir
export function useNearViewport(margin = '200px') {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near];
}

// Telefonlarda çözünürlüğü düşür (GPU ve pil)
export const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

// Telefon ya da zayıf cihazda (az çekirdek/bellek, veri tasarrufu) 3D sahneler
// hiç yüklenmez: sürekli çalışan WebGL pili ve işlemciyi yorar, ~650 KB
// JavaScript indirir ve sayfanın açılmasını geciktirir. Yerine statik görünüm.
export function prefersLightweight() {
  if (typeof window === 'undefined') return true;
  const nav = window.navigator || {};
  if (nav.connection?.saveData) return true;
  if (isSmallScreen()) return true;
  if ((nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4) return true;
  return false;
}

// Ağır 3D parçası ne zaman yüklensin: WebGL varsa, veri tasarrufu kapalıysa ve
// sayfa ilk çizimini bitirdikten sonra (tarayıcı boşa çıkınca)
export function useDeferredWebGL(delay = 1200) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!hasWebGL() || prefersLightweight()) return undefined;
    let idle;
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => setOk(true), { timeout: 2000 });
      else setOk(true);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback?.(idle);
    };
  }, [delay]);
  return ok;
}
