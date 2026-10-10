import React, { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import './animated-check-box.css';

// Animasyonlu onay kutusu (NeonCheckbox). İşaretlenince tik çizilir, kutu
// parlar, kenarda ışık akar; etrafa parçacık, halka ve kıvılcım saçılır.
// Kaynak örnekten farklar:
//  - Gerçek <input> görünmez ama klavyeyle (Tab, Boşluk) kullanılabilir ve
//    odak halkası gösterir; kaynakta "hidden" olduğu için erişilemiyordu.
//  - Animasyonlar Next.js'e özel <style jsx> yerine animated-check-box.css'te.
//  - Renk varsayılan olarak uygulamanın vurgu rengi; tone="neon" kaynaktaki
//    neon yeşili kullanır.
//  - "Hareketi azalt" açıksa yalnızca tik ve renk değişir.
const PARTICLES = [
  ['25px', '-25px'], ['-25px', '-25px'], ['25px', '25px'], ['-25px', '25px'],
  ['35px', '0px'], ['-35px', '0px'], ['0px', '35px'], ['0px', '-35px'],
  ['20px', '-30px'], ['-20px', '30px'], ['30px', '20px'], ['-30px', '-20px'],
];

const NeonCheckbox = ({ label, className = '', tone = 'accent', size = 24, checked: controlledChecked, defaultChecked, onChange, id, ...props }) => {
  const autoId = useId();
  const inputId = id || autoId;
  const [internalChecked, setInternalChecked] = useState(defaultChecked || false);
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;
  // Animasyon yalnızca kullanıcı işaretleyince oynar (sayfa açılışında değil)
  const [burst, setBurst] = useState(0);

  const handleChange = (e) => {
    if (!isControlled) setInternalChecked(e.target.checked);
    if (e.target.checked) setBurst((n) => n + 1);
    onChange?.(e);
  };

  return (
    <label
      htmlFor={inputId}
      className={cn('neon-checkbox', tone === 'neon' && 'is-neon', isChecked && 'is-checked', className)}
      style={{ '--nc-size': `${size}px` }}
    >
      <input id={inputId} type="checkbox" className="neon-checkbox__input" checked={isChecked} onChange={handleChange} {...props} />

      <span className="neon-checkbox__frame" aria-hidden="true">
        <span className="neon-checkbox__box">
          <svg viewBox="0 0 24 24" className="neon-checkbox__check">
            <path d="M3,12.5l7,7L21,5" />
          </svg>
          <span className="neon-checkbox__glow" />
          <span className="neon-checkbox__borders">
            <span />
            <span />
            <span />
            <span />
          </span>
        </span>

        {burst > 0 && isChecked && (
          <span className="neon-checkbox__effects" key={burst}>
            {PARTICLES.map(([x, y], i) => (
              <span key={i} className="neon-checkbox__particle" style={{ '--x': x, '--y': y }} />
            ))}
            {[0, 1, 2].map((i) => (
              <span key={`r${i}`} className="neon-checkbox__ring" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <span key={`s${i}`} className="neon-checkbox__spark" style={{ '--r': `${i * 90}deg` }} />
            ))}
          </span>
        )}
      </span>

      {label && <span className="neon-checkbox__label">{label}</span>}
    </label>
  );
};

export { NeonCheckbox };
