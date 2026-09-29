import { useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'framer-motion';
import Reveal from './Reveal';

const STATS = [
  { value: 12000, suffix: '+', label: 'Doğrulanmış öğrenci' },
  { value: 40, suffix: '+', label: 'Üniversite kampüsü' },
  { value: 100, suffix: '%', label: 'E-posta doğrulama' },
  { value: 4.9, suffix: '★', label: 'Öğrenci puanı', decimals: 1 },
];

function Counter({ value, suffix, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('tr-TR')),
    });
    return () => controls.stop();
  }, [inView, value, decimals]);

  return (
    <span ref={ref} className="font-display text-3xl font-bold text-paper sm:text-4xl">
      {display}
      {suffix}
    </span>
  );
}

export default function TrustStats() {
  return (
    <section id="istatistikler" className="relative border-y border-line-soft bg-surface/40 py-10">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 sm:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="text-center">
            <Counter value={s.value} suffix={s.suffix} decimals={s.decimals} />
            <p className="mt-1 text-[12.5px] text-paper-muted">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
