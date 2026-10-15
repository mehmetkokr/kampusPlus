// Güvenlik ve yayın sertleştirmesinin birim testleri (veritabanı gerekmez):
// görsel meta veri temizleme, SEO sayfa üst bilgileri, site ayarları,
// e-posta kaçışı ve güvenli dosya başlıkları.
const test = require('node:test');
const assert = require('node:assert/strict');

const { stripMetadata, readOrientation } = require('../src/lib/stripMetadata');
const { renderPage, sitemapXml, robotsTxt } = require('../src/lib/seo');
const siteConfig = require('../src/lib/siteConfig');
const { escapeHtml } = require('../src/lib/text');
const { dispositionName } = require('../src/lib/safeServe');

const seg = (marker, body) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};

// Yön bilgisi 6 olan, üretici adı ve GPS etiketi taşıyan EXIF
function exifWithSecrets() {
  const tiff = Buffer.alloc(8 + 2 + 3 * 12 + 4 + 16);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(3, 8);
  const entry = (i, tag, type, count, value) => {
    const o = 10 + i * 12;
    tiff.writeUInt16LE(tag, o);
    tiff.writeUInt16LE(type, o + 2);
    tiff.writeUInt32LE(count, o + 4);
    tiff.writeUInt32LE(value, o + 8);
  };
  const strAt = 10 + 3 * 12 + 4;
  entry(0, 0x010f, 2, 12, strAt); // Make → "SecretPhone"
  entry(1, 0x0112, 3, 1, 6); // Orientation
  entry(2, 0x8825, 4, 1, 0); // GPS IFD işaretçisi
  tiff.write('SecretPhone\0', strAt, 'latin1');
  return Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
}

test('JPEG: EXIF, XMP ve yorum silinir, yön bilgisi ve görüntü verisi korunur', () => {
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x04, 0x01, 0x02, 0xaa, 0xbb, 0xff, 0x00, 0xcc, 0xff, 0xd9]);
  const jpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    seg(0xe1, exifWithSecrets()),
    seg(0xe1, Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>SecretXMP</x:xmpmeta>', 'latin1')),
    seg(0xfe, Buffer.from('SecretComment', 'latin1')),
    seg(0xdb, Buffer.alloc(65, 1)),
    scan,
  ]);
  const out = stripMetadata(jpeg, 'jpg');
  const text = out.toString('latin1');
  assert.ok(!text.includes('Secret'), 'gizli bilgi kalmamalı');
  assert.deepEqual([...out.subarray(0, 2)], [0xff, 0xd8]);
  assert.ok(out.subarray(-scan.length).equals(scan), 'görüntü verisi aynen kalmalı');
  assert.equal(out[3], 0xe0, 'JFIF ilk parça olarak kalmalı');
  const exifStart = out.indexOf(Buffer.from('Exif\0\0', 'latin1'));
  assert.ok(exifStart > 0, 'yön bilgisi için küçük EXIF yazılmalı');
  assert.equal(readOrientation(out.subarray(exifStart)), 6);
});

test('PNG: metin, EXIF ve zaman parçaları silinir', () => {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)]);
  };
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.alloc(13, 1)),
    chunk('tEXt', Buffer.from('Location\0SecretPlace', 'latin1')),
    chunk('eXIf', exifWithSecrets().subarray(6)),
    chunk('IDAT', Buffer.from('pixels')),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  const out = stripMetadata(png, 'png');
  const text = out.toString('latin1');
  assert.ok(!text.includes('Secret'));
  assert.ok(text.includes('IHDR') && text.includes('IDAT') && text.includes('IEND'));
});

test('WebP: EXIF ve XMP silinir, VP8X bayrakları ve RIFF boyu güncellenir', () => {
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'latin1');
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const vp8x = Buffer.alloc(10);
  vp8x[0] = 0x08 | 0x04 | 0x10;
  const body = Buffer.concat([chunk('VP8X', vp8x), chunk('VP8L', Buffer.from('pixels!')), chunk('EXIF', exifWithSecrets()), chunk('XMP ', Buffer.from('SecretXMP'))]);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.writeUInt32LE(body.length + 4, 4);
  head.write('WEBP', 8, 'latin1');
  const out = stripMetadata(Buffer.concat([head, body]), 'webp');
  assert.ok(!out.toString('latin1').includes('Secret'));
  assert.equal(out.readUInt32LE(4), out.length - 8);
  assert.equal(out[20] & (0x08 | 0x04), 0, 'EXIF/XMP bayrakları kapanmalı');
  assert.equal(out[20] & 0x10, 0x10, 'diğer bayraklar korunmalı');
});

test('bozuk görsel null döner', () => {
  assert.equal(stripMetadata(Buffer.from('not an image'), 'jpg'), null);
  assert.equal(stripMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]), 'jpg'), null);
});

const HTML = `<!doctype html><html><head><title>kampüs+ | Doğrulanmış Üniversite Topluluğu</title>
<meta
  name="description"
  content="eski"
/>
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://kampusplus.com.tr/" />
<meta property="og:title" content="x" />
<meta property="og:url" content="https://kampusplus.com.tr/" />
<meta property="og:image" content="https://kampusplus.com.tr/og-image.png" />
</head><body><div id="root"></div></body></html>`;

test('SEO: herkese açık sayfa kendi başlığı ve canonical adresiyle, gerçek alan adıyla', () => {
  const page = renderPage(HTML, '/register/', 'https://ornek.up.railway.app');
  assert.equal(page.status, 200);
  assert.match(page.html, /<title>Kayıt Ol · kampüs\+<\/title>/);
  assert.match(page.html, /<link rel="canonical" href="https:\/\/ornek\.up\.railway\.app\/register" \/>/);
  assert.match(page.html, /og:image" content="https:\/\/ornek\.up\.railway\.app\/og-image\.png"/);
  assert.match(page.html, /<meta name="description" content="Üniversite e-postanla/);
  assert.match(page.html, /<meta name="robots" content="index, follow" \/>/);
  assert.ok(!page.html.includes('kampusplus.com.tr/'), 'derlemedeki adres kalmamalı');
  assert.match(page.html, /<noscript>/);
});

test('SEO: özel sayfa noindex, bilinmeyen adres 404', () => {
  const priv = renderPage(HTML, '/chat/12', null);
  assert.equal(priv.status, 200);
  assert.equal(priv.robots, 'noindex, nofollow');
  assert.match(priv.html, /<link rel="canonical" href="https:\/\/kampusplus\.com\.tr\/" \/>/);
  const missing = renderPage(HTML, '/boyle-bir-sayfa', null);
  assert.equal(missing.status, 404);
  assert.match(missing.html, /Sayfa bulunamadı/);
  assert.equal(renderPage(HTML, '/chat/abc', null).status, 404);
});

test('SEO: sitemap yalnızca dizinlenecek sayfaları, robots sitemap adresini içerir', () => {
  const xml = sitemapXml('https://ornek.com', '2026-10-11');
  assert.match(xml, /<loc>https:\/\/ornek\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/ornek\.com\/gizlilik<\/loc>/);
  assert.ok(!xml.includes('forgot-password') && !xml.includes('/profile'));
  const robots = robotsTxt('https://ornek.com');
  assert.match(robots, /Sitemap: https:\/\/ornek\.com\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin/);
});

test('site ayarları: adres, proxy ve izinli kaynaklar', () => {
  assert.equal(siteConfig.siteUrl({}), 'http://localhost:5173');
  assert.equal(siteConfig.siteUrl({ RAILWAY_PUBLIC_DOMAIN: 'a.up.railway.app' }), 'https://a.up.railway.app');
  assert.equal(siteConfig.siteUrl({ CLIENT_URL: 'https://x.com/', RAILWAY_PUBLIC_DOMAIN: 'a.up.railway.app' }), 'https://x.com');
  assert.equal(siteConfig.siteUrl({ SITE_URL: 'https://site.com', CLIENT_URL: 'https://x.com' }), 'https://site.com');
  assert.equal(siteConfig.trustProxy({}), false);
  assert.equal(siteConfig.trustProxy({ RAILWAY_ENVIRONMENT_NAME: 'production' }), true);
  assert.equal(siteConfig.trustProxy({ RAILWAY_ENVIRONMENT_NAME: 'production', TRUST_PROXY: 'false' }), false);
  assert.deepEqual(siteConfig.allowedOrigins({ CLIENT_URL: 'https://x.com', RAILWAY_PUBLIC_DOMAIN: 'a.up.railway.app' }), ['https://x.com', 'https://a.up.railway.app']);
  assert.deepEqual(siteConfig.productionConfigWarnings({}), []);
  assert.ok(siteConfig.productionConfigWarnings({ RAILWAY_ENVIRONMENT_NAME: 'p' }).some((w) => w.includes('SMTP')));
});

test('e-posta kaçışı ve indirme adı', () => {
  assert.equal(escapeHtml('<a href="x">Ali\'nin</a> & co'), '&lt;a href=&quot;x&quot;&gt;Ali&#39;nin&lt;/a&gt; &amp; co');
  assert.equal(escapeHtml(null), '');
  const name = dispositionName('rapor"\r\nSet-Cookie: x.pdf');
  assert.ok(!/[\r\n]/.test(name));
  assert.ok(name.startsWith('filename="rapor_'));
  assert.match(dispositionName('ödev.docx'), /filename\*=UTF-8''%C3%B6dev\.docx/);
});
