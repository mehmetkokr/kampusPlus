// Uygulama simgelerini ve paylaşım görselini kırmızı kurdele "K+" logosundan üretir:
// apple-touch-icon.png (180), icon-192.png, icon-512.png,
// icon-maskable-512.png (güvenli alanlı) ve og-image.png (1200x630).
// Uygulama koyu moda göre tasarlandığı için koyu tonlar kullanılır.
// Kullanım: node scripts/gen-brand.cjs   (E2E_CHANNEL=msedge ile kurulu Edge)
const path = require('path');
const { chromium } = require('@playwright/test');

const PUBLIC = path.join(__dirname, '..', 'public');
const BG = '#0b0b0b';

// Logonun çizimi (BrandMark.jsx ile aynı), koyu mod renkleri
const mark = `
  <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
  <path fill="#c10f1a" d="M13 9h11v46H13z"/>
  <path fill="#a80c16" d="M21 41 37 9h11L25 50z"/>
  <path fill="#f0222f" d="M21 26h11l18 29H39z"/>
  <path fill="url(#f)" d="M24 26h8l5 8-13 6z"/>
  <path d="M55 8.5v11M49.5 14h11" stroke="#f0222f" stroke-width="4" stroke-linecap="square" fill="none"/>`;

// scale: logonun kenara oranı (1 = kenara kadar). bg verilirse kare zemin dolu.
const markSvg = (scale, bg) => {
  const box = 52.5 / scale;
  const x = 37.75 - box / 2;
  const y = 30.75 - box / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${box} ${box}">${bg ? `<rect x="${x}" y="${y}" width="${box}" height="${box}" fill="${bg}"/>` : ''}${mark}</svg>`;
};
const dataUrl = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent;font-family:Inter,system-ui,sans-serif}</style></head><body>${body}</body></html>`;
const img = (svg, size) => page(`<img src="${dataUrl(svg)}" width="${size}" height="${size}" style="display:block">`, size, size);

// Saydam simge (tarayıcı/PWA "any"), maskeli simge (Android güvenli alan %80
// içinde kalsın diye küçük) ve iOS simgesi (saydam köşeyi siyah gösterdiği için zeminli)
const icon = (size) => img(markSvg(0.9), size);
const maskable = (size) => img(markSvg(0.62, BG), size);
const appleIcon = (size) => img(markSvg(0.74, BG), size);

const og = page(
  `<div style="position:relative;width:1200px;height:630px;background:${BG};color:#f5f1ea;padding:92px 88px;box-sizing:border-box">
    <div style="position:absolute;inset:0;background:radial-gradient(55% 70% at 90% 0%,rgba(240,34,47,.26),transparent 70%),radial-gradient(45% 60% at 68% 12%,rgba(168,12,22,.22),transparent 70%)"></div>
    <div style="position:relative;display:flex;align-items:center;gap:28px">
      <img src="${dataUrl(markSvg(1))}" width="104" height="104" style="display:block;filter:drop-shadow(0 18px 30px rgba(240,34,47,.35))">
      <span style="font-size:58px;font-weight:700;letter-spacing:-.035em">kampüs<span style="color:#f0222f">+</span></span>
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
    ['apple-touch-icon.png', appleIcon(180), 180, 180, false],
    ['icon-192.png', icon(192), 192, 192, true],
    ['icon-512.png', icon(512), 512, 512, true],
    ['icon-maskable-512.png', maskable(512), 512, 512, false],
    ['og-image.png', og, 1200, 630, false],
  ];
  for (const [file, html, w, h, transparent] of jobs) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.screenshot({ path: path.join(PUBLIC, file), omitBackground: transparent });
    await p.close();
    console.log('yazıldı', file);
  }
  await browser.close();
})();
