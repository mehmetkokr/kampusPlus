// Arama motorları ve paylaşım önizlemeleri (WhatsApp, X, LinkedIn botları
// JavaScript çalıştırmaz) için sayfa üst bilgileri sunucuda yazılır:
//   - Herkese açık her sayfanın kendi başlığı, açıklaması, canonical adresi
//     ve og:/twitter: etiketleri
//   - Oturum gerektiren sayfalar "noindex" (X-Robots-Tag başlığıyla da)
//   - Bilinmeyen adresler gerçek 404 durum koduyla döner
//   - Adres, derlemedeki varsayılan yerine yayındaki gerçek adresle değişir
//   - JavaScript'siz tarayıcılar için kısa bir <noscript> özeti ve bağlantılar
// sitemap.xml ve robots.txt de aynı adresle burada üretilir.
// Sayfa listesi client/src/App.jsx ve client/src/components/PageMeta.jsx ile aynı tutulmalı.

const SITE_NAME = 'kampüs·';
const HOME_TITLE = 'kampüs· | Doğrulanmış Üniversite Topluluğu';
const DEFAULT_DESC =
  'kampüs·, yalnızca üniversite e-postanla doğruladığın, kendi okulundaki öğrencilerle seni buluşturan kapalı bir kampüs topluluğudur.';

const PUBLIC_PAGES = {
  '/': { title: HOME_TITLE, desc: DEFAULT_DESC, priority: '1.0', changefreq: 'weekly' },
  '/register': { title: 'Kayıt Ol', desc: 'Üniversite e-postanla ücretsiz kayıt ol, kampüsündeki öğrencilerle tanış.', priority: '0.8', changefreq: 'monthly' },
  '/login': { title: 'Giriş Yap', desc: 'kampüs· hesabına giriş yap.', priority: '0.5', changefreq: 'monthly' },
  '/forgot-password': { title: 'Şifremi Unuttum', desc: 'kampüs· şifreni sıfırla.', priority: '0.2', changefreq: 'yearly', noindex: true },
  '/gizlilik': { title: 'Gizlilik Politikası', desc: 'kampüs· kişisel verilerini nasıl işler? KVKK aydınlatma metni.', priority: '0.3', changefreq: 'yearly' },
  '/kullanim-sartlari': { title: 'Kullanım Şartları', desc: 'kampüs· kullanım şartları.', priority: '0.3', changefreq: 'yearly' },
  '/topluluk-kurallari': { title: 'Topluluk Kuralları', desc: 'kampüs· topluluğunu güvenli tutan kurallar.', priority: '0.3', changefreq: 'yearly' },
  '/mesafeli-satis-sozlesmesi': { title: 'Mesafeli Satış Sözleşmesi', desc: 'kampüs· Premium planları, ücretler, otomatik yenileme ve cayma hakkı bilgilendirmesi.', priority: '0.3', changefreq: 'yearly' },
};

// Oturum gerektiren uygulama sayfaları (React Router yolları)
const PRIVATE_ROUTES = [
  /^\/reset-password$/,
  /^\/settings$/,
  /^\/welcome$/,
  /^\/discover(\/swipe)?$/,
  /^\/feed$/,
  /^\/clubs(\/\d+)?$/,
  /^\/matches$/,
  /^\/chat\/\d+$/,
  /^\/profile$/,
  /^\/notifications$/,
  /^\/users\/\d+$/,
  /^\/admin(\/[a-z-]+)?$/,
];

const PRIVATE_TITLES = [
  ['/discover/swipe', 'Kart Modu'],
  ['/discover', 'Keşfet'],
  ['/feed', 'Akış'],
  ['/clubs', 'Kulüpler'],
  ['/matches', 'Sohbet'],
  ['/chat', 'Sohbet'],
  ['/profile', 'Profilim'],
  ['/settings', 'Ayarlar'],
  ['/notifications', 'Bildirimler'],
  ['/users', 'Profil'],
  ['/welcome', 'Hoş geldin'],
  ['/admin', 'Admin Paneli'],
  ['/reset-password', 'Yeni Şifre Belirle'],
];

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// "/profile/" → "/profile"; kök "/" kalır
function normalizePath(pathname) {
  const clean = pathname.replace(/\/{2,}/g, '/');
  return clean.length > 1 ? clean.replace(/\/+$/, '') : clean;
}

function classify(pathname) {
  const path = normalizePath(pathname);
  if (PUBLIC_PAGES[path]) return { kind: 'public', path, page: PUBLIC_PAGES[path] };
  if (PRIVATE_ROUTES.some((re) => re.test(path))) {
    const match = PRIVATE_TITLES.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
    return { kind: 'private', path, title: match ? match[1] : SITE_NAME };
  }
  return { kind: 'notFound', path };
}

// Derlenmiş index.html'deki site adresi (canonical etiketinden)
function builtSiteUrl(html) {
  const m = html.match(/<link rel="canonical" href="([^"]+)"/);
  if (!m) return null;
  try {
    return new URL(m[1]).origin;
  } catch {
    return null;
  }
}

function replaceTag(html, regex, replacement) {
  return regex.test(html) ? html.replace(regex, replacement) : html;
}

// html: derlenmiş index.html; siteUrl: yayındaki adres (null ise derlemedeki kalır)
function renderPage(html, pathname, siteUrl) {
  const info = classify(pathname);
  const base = siteUrl || builtSiteUrl(html) || '';
  const built = builtSiteUrl(html);
  let out = built && base && built !== base ? html.split(built).join(base) : html;

  let title;
  let desc = DEFAULT_DESC;
  let robots = 'noindex, nofollow';
  let canonicalPath = '/';
  let status = 200;

  if (info.kind === 'public') {
    title = info.page.title === HOME_TITLE ? HOME_TITLE : `${info.page.title} · ${SITE_NAME}`;
    desc = info.page.desc;
    robots = info.page.noindex ? 'noindex, follow' : 'index, follow';
    canonicalPath = info.path;
  } else if (info.kind === 'private') {
    title = `${info.title} · ${SITE_NAME}`;
  } else {
    title = `Sayfa bulunamadı · ${SITE_NAME}`;
    status = 404;
  }

  const t = escapeHtml(title);
  const d = escapeHtml(desc);
  const canonical = escapeHtml(base + canonicalPath);
  out = replaceTag(out, /<title>[^<]*<\/title>/, `<title>${t}</title>`);
  out = replaceTag(out, /<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${d}" />`);
  out = replaceTag(out, /<meta name="robots" content="[^"]*" \/>/, `<meta name="robots" content="${robots}" />`);
  out = replaceTag(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${canonical}" />`);
  out = replaceTag(out, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`);
  out = replaceTag(out, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${d}" />`);
  out = replaceTag(out, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(base + (info.kind === 'public' ? info.path : '/'))}" />`);
  out = replaceTag(out, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`);
  out = replaceTag(out, /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${d}" />`);

  // JavaScript çalıştırmayan tarayıcı ve botlar için özet (React açılınca görünmez)
  const links = Object.entries(PUBLIC_PAGES)
    .filter(([, p]) => !p.noindex)
    .map(([path, p]) => `<a href="${escapeHtml(path)}">${escapeHtml(p.title === HOME_TITLE ? 'Ana sayfa' : p.title)}</a>`)
    .join(' · ');
  const noscript = `<noscript><main style="max-width:640px;margin:40px auto;padding:0 16px;font-family:system-ui,sans-serif"><h1>${t}</h1><p>${d}</p><p>Bu site JavaScript ile çalışır. Lütfen tarayıcında JavaScript'i aç.</p><nav>${links}</nav></main></noscript>`;
  out = out.replace('</body>', `${noscript}\n  </body>`);

  return { html: out, status, robots, kind: info.kind };
}

function sitemapXml(siteUrl, lastmod) {
  const urls = Object.entries(PUBLIC_PAGES)
    .filter(([, p]) => !p.noindex)
    .map(
      ([path, p]) =>
        `  <url><loc>${escapeHtml(siteUrl + path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function robotsTxt(siteUrl) {
  const disallow = ['/admin', '/discover', '/feed', '/clubs', '/matches', '/chat', '/profile', '/settings', '/notifications', '/users', '/welcome', '/reset-password', '/api/', '/uploads/'];
  return [
    '# kampüs· — arama motoru kuralları',
    '# Herkese açık sayfalar taranır; oturum gerektiren uygulama ve yönetim',
    '# ekranları, API ve kullanıcı dosyaları taranmaz.',
    'User-agent: *',
    'Allow: /',
    ...disallow.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

module.exports = { renderPage, sitemapXml, robotsTxt, classify, PUBLIC_PAGES, DEFAULT_DESC };
