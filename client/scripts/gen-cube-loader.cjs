// İzometrik "kayan küp" yükleme animasyonu için CSS üretir.
// 2x2 izometrik ızgarada 3 küp; her adımda boş karenin arkasındaki küp
// boşluğa kayar (küçük bir zıplamayla). 12 adımda herkes başladığı yere döner.
const fs = require('fs');
const path = require('path');
const out = process.argv[2];

const TICKS = 12;
const MOVE = 0.62; // adımın ne kadarı hareketle geçer
const HOP = 9; // zıplama yüksekliği (px)
// Halka sırası (komşu kareler): (0,0) -> (1,0) -> (1,1) -> (0,1)
const RING = [
  { x: 0, y: 0, z: 1 },
  { x: 24, y: 14, z: 2 },
  { x: 0, y: 28, z: 3 },
  { x: -24, y: 14, z: 2 },
];

// Simülasyon
let pos = [0, 1, 2]; // küp -> halka indisi
let empty = 3;
const frames = [[], [], []]; // her küp için [yüzde, halkaStart, halkaEnd] hareketleri
for (let t = 0; t < TICKS; t++) {
  const from = (empty + 3) % 4;
  const cube = pos.indexOf(from);
  frames[cube].push({ t, from, to: empty });
  pos[cube] = empty;
  empty = from;
}
if (pos.join() !== '0,1,2') throw new Error('Döngü kapanmadı: ' + pos.join());

const pct = (v) => `${+(v * 100).toFixed(3)}%`;
const tr = (p, lift = 0) => `transform: translate(${p.x}px, ${p.y - lift}px);`;

function keyframes(name, cubeIdx, withHop) {
  const start = [0, 1, 2][cubeIdx];
  let cur = start;
  const lines = [`  0%, 100% { ${tr(RING[start])} z-index: ${RING[start].z}; }`];
  for (const m of frames[cubeIdx]) {
    const a = RING[m.from];
    const b = RING[m.to];
    const z = Math.max(a.z, b.z);
    const t0 = m.t / TICKS;
    const t1 = (m.t + MOVE) / TICKS;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Hareketten hemen önce katmanı sabitle (z-index ara karede yarı yolda değişmesin)
    if (m.t > 0) lines.push(`  ${pct(t0 - 0.0005)} { ${tr(a)} z-index: ${a.z}; }`);
    lines.push(`  ${pct(t0)} { ${tr(a)} z-index: ${z}; }`);
    if (withHop) lines.push(`  ${pct((t0 + t1) / 2)} { ${tr(mid, HOP)} z-index: ${z}; }`);
    lines.push(`  ${pct(t1)} { ${tr(b)} z-index: ${b.z}; }`);
    cur = m.to;
  }
  if (cur !== start) throw new Error('küp başa dönmedi');
  return `@keyframes ${name} {\n${lines.join('\n')}\n}`;
}

const css = `/* ==========================================================================
   İzometrik kayan küp yükleme animasyonu (üretilmiş dosya)
   Kaynak: client/scripts/gen-cube-loader.cjs (node scripts/gen-cube-loader.cjs src/styles). 2x2 ızgarada 3 küp sırayla boşluğa kayar;
   altlarındaki yansıma gölgeleri onları izler. Hareket azaltma açıksa durur.
   ========================================================================== */

.cube-loader {
  --cl-top: #ffffff;
  --cl-left: #a7a7a7;
  --cl-right: #d4d4d4;
  --cl-edge: rgba(0, 0, 0, 0.18);
  --cl-shadow: rgba(255, 255, 255, 0.13);
  --cl-bg: #100f0d;
  --cl-text: rgba(243, 236, 225, 0.6);
  display: grid;
  place-items: center;
  gap: 28px;
  color: var(--cl-text);
}

.cube-loader.is-fullscreen,
.cube-loader.is-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  align-content: center;
  background: var(--cl-bg);
}

.cube-loader.is-overlay {
  background: rgba(16, 15, 13, 0.9);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: cl-fade 0.25s ease both;
}

.cl-stage {
  position: relative;
  width: 96px;
  height: 150px;
  transform: scale(1.5);
  transform-origin: center 40%;
}

.cl-cube,
.cl-shadow {
  position: absolute;
  left: 24px;
  top: 0;
  width: 48px;
  height: 56px;
  animation-duration: 3.2s;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}

.cl-cube svg,
.cl-shadow svg { display: block; width: 48px; height: 56px; overflow: visible; }
.cl-cube .t { fill: var(--cl-top); }
.cl-cube .l { fill: var(--cl-left); }
.cl-cube .r { fill: var(--cl-right); }
.cl-cube polygon { stroke: var(--cl-edge); stroke-width: 0.6; stroke-linejoin: round; }

/* Yansıma: küpün tabanının biraz altında, düzleştirilmiş koyu eşkenar dörtgen */
.cl-shadow { top: 64px; z-index: 0 !important; }
.cl-shadow polygon { fill: var(--cl-shadow); }

.cl-a { animation-name: cl-a; }
.cl-b { animation-name: cl-b; }
.cl-c { animation-name: cl-c; }
.cl-shadow.cl-a { animation-name: cl-sa; }
.cl-shadow.cl-b { animation-name: cl-sb; }
.cl-shadow.cl-c { animation-name: cl-sc; }

.cl-label {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cl-label::after {
  content: '';
  display: inline-block;
  width: 1.2em;
  text-align: left;
  animation: cl-dots 1.6s steps(4) infinite;
}

${keyframes('cl-a', 0, true)}
${keyframes('cl-b', 1, true)}
${keyframes('cl-c', 2, true)}
${keyframes('cl-sa', 0, false)}
${keyframes('cl-sb', 1, false)}
${keyframes('cl-sc', 2, false)}

@keyframes cl-dots {
  0% { content: ''; }
  25% { content: '.'; }
  50% { content: '..'; }
  75% { content: '...'; }
}

@keyframes cl-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .cl-cube, .cl-shadow, .cl-label::after, .cube-loader.is-overlay { animation: none !important; }
  .cl-a { transform: translate(0px, 0px); z-index: 1; }
  .cl-b { transform: translate(24px, 14px); z-index: 2; }
  .cl-c { transform: translate(0px, 28px); z-index: 3; }
}

/* Açık tema: koyu zemin yerine açık zemin, küplere ince kenar */
[data-theme='light'] .cube-loader {
  --cl-edge: rgba(60, 40, 20, 0.35);
  --cl-left: #b9b2a7;
  --cl-right: #ddd7cd;
  --cl-shadow: rgba(60, 40, 20, 0.14);
  --cl-bg: #f5f0e8;
  --cl-text: rgba(34, 28, 22, 0.6);
}

[data-theme='light'] .cube-loader.is-overlay { background: rgba(245, 240, 232, 0.92); }
`;

fs.writeFileSync(path.join(out, 'cube-loader.css'), css);
console.log('yazıldı:', path.join(out, 'cube-loader.css'), '— hareketler:', frames.map((f) => f.length).join('/'));
