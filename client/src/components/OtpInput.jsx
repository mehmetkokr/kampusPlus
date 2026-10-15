import React, { useMemo } from 'react';
import { Check } from './icons';
import '../styles/otp.css';

// Doğrulama kodu kutuları ve sonuç animasyonu.
// status: 'idle' | 'verifying' | 'success' | 'error'
//  - verifying: kutular soldan sağa dalgalanır
//  - success: kutular ortada birleşir, yerine onay işareti gelir, çevreye
//    küçük kareler saçılır
//  - error: kutular kısa bir sallanma yapar
// Rakam girişi, yapıştırma ve klavye işlemleri çağıran bileşende kalır
// (inputProps ile her kutuya verilir).
const PARTICLES = 18;

export default function OtpInput({ length, value, status = 'idle', inputProps, onPaste, label }) {
  // Saçılan parçacıkların yönü ve uzaklığı bir kez hesaplanır
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => {
        const angle = (i / PARTICLES) * Math.PI * 2 + (i % 3) * 0.35;
        const dist = 70 + ((i * 37) % 60);
        return {
          x: `${Math.round(Math.cos(angle) * dist)}px`,
          y: `${Math.round(Math.sin(angle) * dist * 0.7)}px`,
          r: `${(i * 47) % 180}deg`,
          s: 0.55 + ((i * 13) % 5) / 10,
          d: `${(i % 6) * 25}ms`,
        };
      }),
    []
  );
  const mid = (length - 1) / 2;

  return (
    <div className={`otp is-${status}`}>
      <div className="code-inputs otp-row" onPaste={onPaste} role="group" aria-label={label}>
        {value.map((d, i) => (
          <input
            key={i}
            value={d}
            style={{ '--i': i, '--dx': mid - i }}
            disabled={status === 'verifying' || status === 'success'}
            {...inputProps(i)}
          />
        ))}
      </div>
      {status === 'success' && (
        <div className="otp-success" aria-hidden="true">
          {particles.map((p, i) => (
            <span key={i} className="otp-particle" style={{ '--x': p.x, '--y': p.y, '--r': p.r, '--s': p.s, '--d': p.d }} />
          ))}
          <span className="otp-check">
            <Check size={28} weight="fill" />
          </span>
        </div>
      )}
    </div>
  );
}
