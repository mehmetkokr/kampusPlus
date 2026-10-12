// Uygulama simgelerini ve paylaşım görselini tek kaynaktan üretir:
//   public/favicon.svg, icon-192.png, icon-512.png, icon-maskable-512.png,
//   apple-touch-icon.png ve og-image.png (1200x630).
// Kullanım: node scripts/gen-icons.cjs
// (Playwright'ın tarayıcısı farklı bir yerdeyse CHROMIUM_PATH ile verilebilir.)
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const PUBLIC = path.join(__dirname, '..', 'public');

// Kalın küçük "k" (64x64 tuvalde) ve yanındaki nokta: "kampüs·" yazısındaki nokta
const K = 'M22 14h7.5v20.2L40.6 23h9.2L37.7 34.6 51 50h-9.4l-9.4-11.4-2.7 2.6V50H22z';
const GRADIENT = '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b9bff"/><stop offset="1" stop-color="#0052b8"/></linearGradient>';
const glyph = (transform = '') =>
  `<g transform="${transform}"><g transform="translate(-3 0)"><path d="${K}" fill="#fff"/></g><circle cx="52.5" cy="46" r="4.2" fill="#fff"/></g>`;

// Köşeleri yuvarlak simge (tarayıcı sekmesi, PWA)
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENT}</defs>
  <rect width="64" height="64" rx="15" fill="url(#g)"/>
  ${glyph()}
</svg>
`;

// Tam dolu kare: iOS ve Android köşeleri kendisi yuvarlar. Maskable sürümde
// harf, kırpılmayan güvenli alanın (ortadaki %80) içinde kalacak kadar küçülür.
const square = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${GRADIENT}</defs>
  <rect width="64" height="64" fill="url(#g)"/>
  ${glyph(`translate(${32 - 32 * scale} ${32 - 32 * scale}) scale(${scale})`)}
</svg>`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..800&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:1200px;height:630px}
  body{font-family:Inter,system-ui,sans-serif;color:#f5f1ea;overflow:hidden;
    background:radial-gradient(900px 520px at 88% 8%,rgba(10,132,255,.32),transparent 65%),
               radial-gradient(700px 500px at 0% 100%,rgba(48,209,88,.07),transparent 60%),#0b0b0d}
  .brand{position:absolute;left:88px;top:92px;display:flex;align-items:center;gap:32px}
  .brand svg{width:104px;height:104px;filter:drop-shadow(0 10px 24px rgba(10,132,255,.35))}
  .word{font-size:58px;font-weight:700;letter-spacing:-1.5px}
  .word span{color:#0a84ff}
  h1{position:absolute;left:88px;top:258px;margin:0;font-size:76px;line-height:1.12;font-weight:800;letter-spacing:-2px}
  p{position:absolute;left:88px;top:492px;margin:0;font-size:26px;color:#a1a1a6}
</style></head><body>
  <div class="brand">${rounded}<div class="word">kampüs<span>·</span></div></div>
  <h1>Kampüs hayatın,<br>tek bir uygulamada.</h1>
  <p>Yalnızca doğrulanmış üniversite öğrencileri · Ücretsiz</p>
</body></html>`;

async function main() {
  fs.writeFileSync(path.join(PUBLIC, 'favicon.svg'), rounded);
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();

  const shoot = async (svg, size, file, transparent) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(PUBLIC, file), omitBackground: transparent });
  };
  await shoot(rounded, 192, 'icon-192.png', true);
  await shoot(rounded, 512, 'icon-512.png', true);
  await shoot(square(0.72), 512, 'icon-maskable-512.png', false);
  await shoot(square(1), 180, 'apple-touch-icon.png', false);

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(PUBLIC, 'og-image.png') });

  await browser.close();
  console.log('Simgeler ve paylaşım görseli güncellendi.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
