import React from 'react';
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { useReducedMotion } from 'framer-motion';
import { isSmallScreen, useThemeMode } from '../../utils/webgl';

// Ana sayfanın üst kısmında yavaş dalgalanan renk geçişi (ShaderGradient).
// Uygulamanın Apple renkleri: açık modda soluk mavi-mor, koyu modda gece
// mavisi. Hareketi azaltmayı seçenlerde durur; ekrandan çıkınca tuval
// kaldırılır (kütüphanenin lazyLoad'u). Işık türü "3d": yalnızca ortam ışığı,
// dışarıdan HDR dosyası indirilmez. Bu dosya ayrı bir parça olarak yüklenir.
const PALETTE = {
  light: { color1: '#a9cdff', color2: '#cfcaff', color3: '#f5f5f7', brightness: 1.25 },
  dark: { color1: '#0b2f73', color2: '#1c1a5e', color3: '#000000', brightness: 0.75 },
};

export default function HeroGradient() {
  const mode = useThemeMode();
  const reduce = useReducedMotion();
  const p = PALETTE[mode] || PALETTE.dark;

  return (
    <div className="landing-hero-gradient" aria-hidden="true" data-html2canvas-ignore>
      <ShaderGradientCanvas style={{ position: 'absolute', inset: 0 }} pixelDensity={isSmallScreen() ? 0.8 : 1} fov={45} pointerEvents="none">
        <ShaderGradient
          type="waterPlane"
          animate={reduce ? 'off' : 'on'}
          uTime={0.2}
          uSpeed={0.08}
          uStrength={1.6}
          uDensity={1.1}
          uFrequency={5.5}
          uAmplitude={0}
          rotationX={0}
          rotationY={10}
          rotationZ={50}
          color1={p.color1}
          color2={p.color2}
          color3={p.color3}
          reflection={0.1}
          lightType="3d"
          brightness={p.brightness}
          grain="off"
          cAzimuthAngle={180}
          cPolarAngle={90}
          cDistance={3.4}
          cameraZoom={1}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
