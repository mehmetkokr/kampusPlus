import React, { useId } from 'react';

// kampüs+ logosu: zeminsiz, kurdele gibi katlanmış kırmızı "K" ve "+".
// Gövde koyu, üst kol daha koyu, alt bacak parlak kırmızı; bacağın gövdeden
// çıktığı yerdeki gölge katlanma hissi verir. Renkler temaya göre değişir
// (--brand-red*, index.css): koyu modda siyah zeminde parlasın diye açık ton.
// Aynı çizim public/favicon.svg, uygulama simgeleri (scripts/gen-brand.cjs) ve
// açılış animasyonunda (LogoLoader, index.html) kullanılır; değişirse hepsi birlikte.
export const BRAND_VIEWBOX = '11.5 4.5 52.5 52.5';
export const K_STEM = 'M13 9h11v46H13z';
export const K_ARM = 'M21 41 37 9h11L25 50z';
export const K_LEG = 'M21 26h11l18 29H39z';
export const K_FOLD = 'M24 26h8l5 8-13 6z';
export const PLUS_PATH = 'M55 8.5v11M49.5 14h11';

export default function BrandMark({ size = 36, className = '', title }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={size}
      viewBox={BRAND_VIEWBOX}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={K_STEM} fill="var(--brand-red-stem)" />
      <path d={K_ARM} fill="var(--brand-red-arm)" />
      <path d={K_LEG} fill="var(--brand-red)" />
      <path d={K_FOLD} fill={`url(#${id}f)`} />
      <path d={PLUS_PATH} stroke="var(--brand-red)" strokeWidth="4" strokeLinecap="square" fill="none" />
    </svg>
  );
}
