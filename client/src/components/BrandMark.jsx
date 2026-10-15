import React, { useId } from 'react';

// kampüs+ uygulama simgesi: mavi-çivit geçişli zemin, beyaz "k" ve açık mavi "+".
// Aynı çizim public/favicon.svg, uygulama simgeleri (scripts/gen-brand.cjs) ve
// açılış animasyonunda (LogoLoader, index.html) kullanılır; değişirse hepsi birlikte.
export const BRAND_GRADIENT = ['#2E9BFF', '#4F46E5'];
export const BRAND_PLUS = '#9BD7FF';
export const K_PATH = 'M17 16h7.5v20.2L35.6 25h9.2L32.7 36.6 46 52h-9.4l-9.4-11.4-2.7 2.6V52H17z';
export const PLUS_PATH = 'M50 8.8v12.4M43.8 15h12.4';

export default function BrandMark({ size = 36, className = '', title }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND_GRADIENT[0]} />
          <stop offset="1" stopColor={BRAND_GRADIENT[1]} />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}g)`} />
      <rect width="64" height="64" rx="15" fill={`url(#${id}h)`} />
      <path d={K_PATH} fill="#fff" />
      <path d={PLUS_PATH} stroke={BRAND_PLUS} strokeWidth="4.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
