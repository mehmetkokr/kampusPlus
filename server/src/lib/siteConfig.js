// Sitenin yayındaki adresi ve ortam ayarları tek yerden okunur.
//
// Adres sırası: SITE_URL → CLIENT_URL → Railway'in verdiği alan adı
// (RAILWAY_PUBLIC_DOMAIN) → yerel geliştirme adresi. Şifre sıfırlama ve
// e-posta bağlantıları, sitemap, robots.txt ve sayfa üst bilgileri
// (canonical, og:url) bu adresi kullanır; böylece değişken unutulsa bile
// bağlantılar localhost'a gitmez.
const LOCAL_URL = 'http://localhost:5173';

const trimUrl = (url) => String(url).trim().replace(/\/+$/, '');

function isRailway(env = process.env) {
  return Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PUBLIC_DOMAIN);
}

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production' || isRailway(env);
}

// Açıkça verilmiş adres (yoksa null)
function configuredSiteUrl(env = process.env) {
  const explicit = env.SITE_URL || env.CLIENT_URL;
  if (explicit) return trimUrl(explicit);
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${trimUrl(env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\/\//, '')}`;
  return null;
}

function siteUrl(env = process.env) {
  return configuredSiteUrl(env) || LOCAL_URL;
}

// Railway gibi bir ters proxy arkasında gerçek istemci IP'si X-Forwarded-For'dan
// okunmalı; aksi halde herkes aynı IP'den geliyormuş gibi görünür ve giriş
// sınırı (15 dakikada 10 deneme) tüm kullanıcılar için birlikte dolar.
// TRUST_PROXY verilmişse o geçerli; verilmemişse Railway'de açık, yerelde kapalı.
function trustProxy(env = process.env) {
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') return env.TRUST_PROXY === 'true';
  return isRailway(env);
}

// İzin verilen tarayıcı kaynakları (CORS, socket.io). Yayında site ve API aynı
// adreste olduğundan bu liste yalnızca ayrı adresten açılan arayüz içindir.
function allowedOrigins(env = process.env) {
  const list = [siteUrl(env)];
  if (env.RAILWAY_PUBLIC_DOMAIN) list.push(`https://${trimUrl(env.RAILWAY_PUBLIC_DOMAIN).replace(/^https?:\/\//, '')}`);
  for (const extra of (env.EXTRA_ORIGINS || '').split(',')) if (extra.trim()) list.push(trimUrl(extra));
  return [...new Set(list)];
}

// Yayında eksik/yanlış ayarları açılışta açıkça yazar (sunucuyu durdurmaz)
function productionConfigWarnings(env = process.env) {
  if (!isProduction(env)) return [];
  const warnings = [];
  if (!configuredSiteUrl(env)) warnings.push('Site adresi yok: SITE_URL (ör. https://kampusplus.app) tanımlayın; e-posta bağlantıları localhost\'a gider.');
  if (!env.BREVO_API_KEY && !(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)) warnings.push('E-posta servisi tanımlı değil (BREVO_API_KEY ya da SMTP): doğrulama kodları gönderilemez, kimse kayıt olamaz.');
  if (isRailway(env) && !env.STORAGE_DIR) warnings.push('STORAGE_DIR yok: yüklenen fotoğraflar her güncellemede silinir. Volume bağlayıp STORAGE_DIR=/data yapın.');
  if (isRailway(env) && !/^file:\/data\//.test(env.DATABASE_URL || '')) warnings.push('DATABASE_URL kalıcı diskte değil: veritabanı her güncellemede sıfırlanabilir (ör. file:/data/kampus.db).');
  if ((env.JWT_SECRET || '').length < 32) warnings.push('JWT_SECRET kısa: en az 32 karakterlik rastgele bir değer kullanın.');
  return warnings;
}

module.exports = { productionConfigWarnings, siteUrl, configuredSiteUrl, trustProxy, allowedOrigins, isProduction, isRailway, LOCAL_URL };
