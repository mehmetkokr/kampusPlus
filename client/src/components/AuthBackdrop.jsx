import React, { useEffect, useRef } from 'react';

// Giriş/Kayıt ekranlarına özel, "kampüste gece" hissi veren canlı arka plan.
// Üç bulanık ışık küresi (amber + teal + sıcak turuncu) farklı hızlarda
// kayarak gerçek bir 3D derinlik hissi verir; fareye göre hafif paralaks
// eğimi eklenir. Gerçek bir video dosyası yerine bunu kullanıyoruz çünkü:
//   - Telif/lisans riski olmadan tamamen özgün
//   - Video dosyası indirmeden, her ekran boyutuna anında uyarlanıyor
//   - Performans: GPU dostu CSS transform animasyonları, video çözme yükü yok
export default function AuthBackdrop() {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function handleMove(e) {
      const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      wrap.style.setProperty('--mx', x.toFixed(3));
      wrap.style.setProperty('--my', y.toFixed(3));
    }

    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="auth-backdrop"
      style={{
        transform: 'rotateX(calc(var(--my, 0) * -2deg)) rotateY(calc(var(--mx, 0) * 2deg))',
      }}
    >
      <div className="auth-orb orb-1" />
      <div className="auth-orb orb-2" />
      <div className="auth-orb orb-3" />
      <div className="auth-grain" />
      <div className="auth-vignette" />
    </div>
  );
}
