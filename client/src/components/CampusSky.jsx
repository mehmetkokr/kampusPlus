import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// "Kampüs gökyüzü": tanıtım, giriş/kayıt ve uygulama sayfalarının ortak,
// renk moduna göre değişen canlı arka planı.
//
// - Koyu mod → kampüste gece: ağır ağır kayan kiremit/adaçayı/alacakaranlık
//   ışıkları, yanıp sönen yıldızlar (kampüsteki öğrenciler) ve aralarında
//   beliren ince bağlantı çizgileri (tanışan insanlar). Ara sıra bir kayan yıldız.
// - Açık mod → kampüste sabah: gün doğumu tonlarında yumuşak ışıklar, havada
//   süzülen sıcak ışık zerreleri ve pencereden süzülen güneş huzmesi.
//
// Tamamen CSS animasyonu (ana iş parçacığını yormaz), yalnızca transform ve
// opacity canlandırılır. "Hareketi azalt" açıksa sahne durağan kalır.
// variant: 'app' (sakin, içerik okunurken dikkat dağıtmaz) | 'auth' | 'landing'
const SCENE = {
  app: { stars: 26, links: 6, seed: 11 },
  auth: { stars: 44, links: 12, seed: 23 },
  landing: { stars: 52, links: 14, seed: 37 },
};

// Her açılışta aynı yerleşim (sayfa geçişlerinde yıldızlar zıplamasın)
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildScene({ stars: count, links: linkCount, seed }, aspect) {
  const rand = seeded(seed);
  const stars = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 100,
    size: 1 + rand() * 1.8,
    twinkle: 3 + rand() * 5,
    float: 18 + rand() * 22,
    delay: -rand() * 30,
  }));

  // Yakın yıldız çiftleri arasında takımyıldız çizgileri. Mesafe gerçek en-boy
  // oranıyla ölçülür; dikey telefonda çizgiler boyuna uzamaz.
  const pairs = [];
  for (let a = 0; a < stars.length; a++) {
    for (let b = a + 1; b < stars.length; b++) {
      const dx = stars[a].x - stars[b].x;
      const dy = (stars[a].y - stars[b].y) * aspect;
      const d = Math.hypot(dx, dy);
      if (d > 7 && d < 26) pairs.push({ a: stars[a], b: stars[b], d });
    }
  }
  pairs.sort((p, q) => p.d - q.d);
  const used = new Map();
  const links = [];
  for (const p of pairs) {
    if (links.length >= linkCount) break;
    if ((used.get(p.a.id) || 0) >= 2 || (used.get(p.b.id) || 0) >= 2) continue;
    used.set(p.a.id, (used.get(p.a.id) || 0) + 1);
    used.set(p.b.id, (used.get(p.b.id) || 0) + 1);
    links.push({ ...p, delay: -(links.length * 2.3) % 14 });
  }
  const nodes = new Set(links.flatMap((l) => [l.a.id, l.b.id]));
  return { stars: stars.map((s) => ({ ...s, node: nodes.has(s.id) })), links };
}

export default function CampusSky({ variant = 'app', className = '' }) {
  const ref = useRef(null);
  // Alanın yükseklik/genişlik oranı (ilk çizimde ölçülür)
  const [aspect, setAspect] = useState(() =>
    typeof window === 'undefined' ? 0.6 : Math.round((window.innerHeight / window.innerWidth) * 10) / 10
  );
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r?.width) setAspect(Math.round((r.height / r.width) * 10) / 10);
  }, []);
  const scene = useMemo(() => buildScene(SCENE[variant] || SCENE.app, aspect), [variant, aspect]);

  // Fareyle çok hafif derinlik (yalnızca tanıtım ve giriş ekranında, fareli
  // cihazlarda ve hareket azaltılmamışsa)
  useEffect(() => {
    const el = ref.current;
    if (!el || variant === 'app') return undefined;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!fine.matches || reduce.matches) return undefined;

    let frame = 0;
    function onMove(e) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.setProperty('--px', (e.clientX / window.innerWidth - 0.5).toFixed(3));
        el.style.setProperty('--py', (e.clientY / window.innerHeight - 0.5).toFixed(3));
      });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [variant]);

  return (
    <div ref={ref} className={`campus-sky campus-sky--${variant} ${className}`.trim()} aria-hidden="true">
      <div className="sky-depth sky-depth-far">
        <span className="sky-glow sky-glow-1" />
        <span className="sky-glow sky-glow-2" />
        <span className="sky-glow sky-glow-3" />
        <span className="sky-glow sky-glow-4" />
        <span className="sky-ray" />
      </div>

      <div className="sky-depth sky-depth-near">
        <svg className="sky-links" viewBox="0 0 100 100" preserveAspectRatio="none">
          {scene.links.map((l, i) => (
            <line
              key={i}
              x1={l.a.x}
              y1={l.a.y}
              x2={l.b.x}
              y2={l.b.y}
              vectorEffect="non-scaling-stroke"
              style={{ animationDelay: `${l.delay}s` }}
            />
          ))}
        </svg>
        {scene.stars.map((s) => (
          <span
            key={s.id}
            className={`sky-star${s.node ? ' is-node' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              '--s': s.size.toFixed(2),
              '--tw': `${s.twinkle.toFixed(1)}s`,
              '--fl': `${s.float.toFixed(1)}s`,
              '--dl': `${s.delay.toFixed(1)}s`,
            }}
          >
            <i />
          </span>
        ))}
        <span className="sky-meteor" />
      </div>

      <div className="sky-grain" />
      <div className="sky-vignette" />
    </div>
  );
}
