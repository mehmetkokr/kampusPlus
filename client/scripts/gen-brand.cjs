// Uygulama simgelerini ve paylaşım görselini public/favicon.svg'den üretir:
// apple-touch-icon.png (180), icon-192.png, icon-512.png,
// icon-maskable-512.png (güvenli alanlı) ve og-image.png (1200x630).
// Kullanım: node scripts/gen-brand.cjs   (E2E_CHANNEL=msedge ile kurulu Edge)
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const PUBLIC = path.join(__dirname, '..', 'public');
const svg = fs.readFileSync(path.join(PUBLIC, 'favicon.svg'), 'utf8');
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:Inter,system-ui,sans-serif}</style></head><body>${body}</body></html>`;

const icon = (size) => page(`<img src="${dataUrl}" width="${size}" height="${size}" style="display:block">`, size, size);

// Kare (köşesiz) sürüm: zemin kenara kadar dolu, "k+" scale oranında ortada.
// Maskeli simge (Android, güvenli alan %80) ve iOS (köşeleri kendisi yuvarlar,
// saydam köşeyi siyah gösterir) için
const square = (size, scale) => {
  const inner = svg
    .replace(/<rect width="64" height="64" rx="15" fill="url\(#h\)"\/>/, '')
    .replace('rx="15" ', '')
    .replace(/(<path d="M17[^>]*\/>\s*<path d="M50[^>]*\/>)/, `<g transform="translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})">$1</g>`);
  const url = `data:image/svg+xml;base64,${Buffer.from(inner).toString('base64')}`;
  return page(`<img src="${url}" width="${size}" height="${size}" style="display:block">`, size, size);
};
const maskable = (size) => square(size, 0.8);
const appleIcon = (size) => square(size, 0.92);

const og = page(
  `<div style="position:relative;width:1200px;height:630px;background:#08080a;color:#f5f1ea;padding:92px 88px;box-sizing:border-box">
    <div style="position:absolute;inset:0;background:radial-gradient(60% 70% at 92% 0%,rgba(46,155,255,.32),transparent 70%),radial-gradient(45% 60% at 70% 10%,rgba(79,70,229,.25),transparent 70%)"></div>
    <div style="position:relative;display:flex;align-items:center;gap:32px">
      <img src="${dataUrl}" width="104" height="104" style="display:block;filter:drop-shadow(0 18px 30px rgba(46,155,255,.35))">
      <span style="font-size:58px;font-weight:700;letter-spacing:-.035em">kampüs<span style="color:#2E9BFF">·</span></span>
    </div>
    <div style="position:relative;margin-top:70px;font-size:76px;font-weight:800;line-height:1.08;letter-spacing:-.04em">Kampüs hayatın,<br>tek bir uygulamada.</div>
    <div style="position:relative;margin-top:56px;font-size:25px;color:rgba(245,241,234,.62)">Yalnızca doğrulanmış üniversite öğrencileri · Ücretsiz</div>
  </div>`,
  1200,
  630
);

(async () => {
  const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || undefined });
  const jobs = [
    ['apple-touch-icon.png', appleIcon(180), 180, 180],
    ['icon-192.png', icon(192), 192, 192],
    ['icon-512.png', icon(512), 512, 512],
    ['icon-maskable-512.png', maskable(512), 512, 512],
    ['og-image.png', og, 1200, 630],
  ];
  for (const [file, html, w, h] of jobs) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(PUBLIC, file), omitBackground: file.startsWith('icon-') && !file.includes('maskable') });
    await p.close();
    console.log('yazıldı', file);
  }
  await browser.close();
})();
