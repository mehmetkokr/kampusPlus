// Fotoğraf düzenleyicinin renk ayarları tek bir 3×4 renk matrisine çevrilir.
// Aynı matris hem önizlemede (SVG feColorMatrix) hem dışa aktarmada (piksel
// döngüsü) kullanılır; böylece ekranda görülenle kaydedilen birebir aynıdır.

export const ADJUSTMENTS = [
  { key: 'light', label: 'Işık' },
  { key: 'contrast', label: 'Kontrast' },
  { key: 'saturation', label: 'Doygunluk' },
  { key: 'warmth', label: 'Sıcaklık' },
];

export const NO_ADJUST = { light: 0, contrast: 0, saturation: 0, warmth: 0 };

export const PRESETS = [
  { key: 'none', label: 'Orijinal', values: {} },
  { key: 'vivid', label: 'Canlı', values: { saturation: 32, contrast: 10 } },
  { key: 'warm', label: 'Sıcak', values: { warmth: 40, light: 4, saturation: 8 } },
  { key: 'cool', label: 'Soğuk', values: { warmth: -38, contrast: 6 } },
  { key: 'dramatic', label: 'Dramatik', values: { contrast: 38, saturation: -18, light: -6 } },
  { key: 'mono', label: 'Mono', values: { contrast: 12 }, mono: true },
  { key: 'silver', label: 'Gümüş', values: { contrast: -12, light: 8 }, mono: true },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Ön ayar + kullanıcının sürgüleri → son değerler (-100…100)
export function combine(presetKey, adjust) {
  const preset = PRESETS.find((p) => p.key === presetKey) || PRESETS[0];
  const out = { mono: !!preset.mono };
  for (const { key } of ADJUSTMENTS) {
    out[key] = clamp((preset.values[key] || 0) + (adjust[key] || 0), -100, 100);
  }
  return out;
}

// Satırlar: R, G, B. Sütunlar: r, g, b katsayıları ve 0…1 aralığında sabit.
export function buildMatrix({ light = 0, contrast = 0, saturation = 0, warmth = 0, mono = false }) {
  const s = mono ? 0 : 1 + saturation / 100;
  const lr = 0.2126;
  const lg = 0.7152;
  const lb = 0.0722;
  let m = [
    [lr * (1 - s) + s, lg * (1 - s), lb * (1 - s), 0],
    [lr * (1 - s), lg * (1 - s) + s, lb * (1 - s), 0],
    [lr * (1 - s), lg * (1 - s), lb * (1 - s) + s, 0],
  ];
  const c = Math.max(0.3, 1 + (contrast / 100) * 0.7);
  m = m.map((row) => [row[0] * c, row[1] * c, row[2] * c, row[3] * c + 0.5 * (1 - c)]);
  const b = (light / 100) * 0.3;
  const w = mono ? 0 : (warmth / 100) * 0.12;
  m[0][3] += b + w;
  m[1][3] += b;
  m[2][3] += b - w;
  return m;
}

export function isIdentity(m) {
  const id = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
  ];
  return m.every((row, i) => row.every((v, j) => Math.abs(v - id[i][j]) < 1e-6));
}

// feColorMatrix "values" (4×5, alfa değişmez)
export function toSvgValues(m) {
  return [...m.map((r) => [r[0], r[1], r[2], 0, r[3]]).flat(), 0, 0, 0, 1, 0].map((v) => +v.toFixed(5)).join(' ');
}

// Tuvaldeki pikselleri yerinde dönüştürür
export function applyMatrix(imageData, m) {
  const d = imageData.data;
  const [r0, r1, r2] = m;
  const o0 = r0[3] * 255;
  const o1 = r1[3] * 255;
  const o2 = r2[3] * 255;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Uint8ClampedArray değeri 0…255'e kendisi sıkıştırır
    d[i] = r0[0] * r + r0[1] * g + r0[2] * b + o0;
    d[i + 1] = r1[0] * r + r1[1] * g + r1[2] * b + o1;
    d[i + 2] = r2[0] * r + r2[1] * g + r2[2] * b + o2;
  }
  return imageData;
}
