// Ana sunucu dosyası
// Express (HTTP API) + Socket.io (gerçek zamanlı mesajlaşma) birlikte çalışır.

require('dotenv').config();
// Hata takibi en başta kurulur ki açılıştaki hatalar da kayda geçsin
const { installErrorCapture, expressErrorHandler } = require('./lib/errorLog');
installErrorCapture();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { PUBLIC_UPLOADS } = require('./lib/paths');
const { publicUploadGuard, publicStaticHeaders } = require('./lib/safeServe');
const { trustProxy, allowedOrigins, productionConfigWarnings, siteUrl, configuredSiteUrl } = require('./lib/siteConfig');
const { renderPage, robotsTxt, sitemapXml } = require('./lib/seo');

const authRoutes = require('./routes/auth');
const universityRoutes = require('./routes/universities');
const profileRoutes = require('./routes/profile');
const matchRoutes = require('./routes/matches');
const messageRoutes = require('./routes/messages');
const clubRoutes = require('./routes/clubs');
const socialRoutes = require('./routes/social');
const adminRoutes = require('./routes/admin');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const discoverRoutes = require('./routes/discover');
const filesRoutes = require('./routes/files');
const premiumRoutes = require('./routes/premium');
const announcementRoutes = require('./routes/announcements');
const pushRoutes = require('./routes/push');
const telemetryRoutes = require('./routes/telemetry');
const { setupSocket } = require('./socket');
const { startCronJobs } = require('./lib/cron');

const app = express();
const server = http.createServer(app);

// Sunucu bir ters proxy (Railway, nginx, Cloudflare) arkasındaysa rate
// limiter'ın gerçek istemci IP'sini görebilmesi için açılır. Proxy YOKSA
// açılmamalı: aksi halde istemciler X-Forwarded-For başlığını sahteleyerek
// sınırı aşabilir. Railway'de kendiliğinden açık (bkz. lib/siteConfig.js).
if (trustProxy()) {
  app.set('trust proxy', 1);
}

const ORIGINS = allowedOrigins();

const io = new Server(server, {
  cors: {
    origin: ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: ORIGINS }));
// Helmet, güvenlik açısından önemli HTTP başlıklarını (XSS koruması,
// clickjacking koruması, MIME sniffing engeli vb.) otomatik olarak ekler.
// crossOriginResourcePolicy 'cross-origin' yapılır çünkü /uploads ve
// /api/files altındaki dosyalar frontend'in farklı origin'inden (5173)
// <img>/<audio> etiketleriyle doğrudan yükleniyor.
// İçerik Güvenlik Politikası: betikler yalnızca sitenin kendi dosyalarından
// gelir (satır içi betik yok), yazı tipleri Google Fonts'tan gelir; gerçek
// zamanlı bağlantı (socket.io) aynı adrese ws/wss ile yapılır.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Satır içi betik yok (tema: public/theme-init.js); XSS olsa bile
        // sayfaya enjekte edilen <script> çalışmaz
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
        mediaSrc: ["'self'", 'blob:'],
        // Sentry yalnızca VITE_SENTRY_DSN ile derlenmişse kullanılır
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://*.ingest.sentry.io', 'https://*.ingest.de.sentry.io', 'https://*.ingest.us.sentry.io'],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(express.json());

// Genel API isteklerini sınırlar (kaba kuvvet / otomatik istismar araçlarına
// karşı temel bir savunma katmanı). Auth rotalarının kendi daha sıkı
// limitleri auth.js içinde ayrıca tanımlıdır.
// Not: Bu limiter'ın anahtarı mümkünse kullanıcı ID'sidir (JWT'den çıkarılır),
// böylece aynı kampüs WiFi'sini/NAT'ı paylaşan farklı kullanıcılar birbirinin
// limitini tüketmez. Token yoksa/geçersizse IP'ye düşülür (login öncesi trafik
// ve misafir istekler için). Bu, imzayı DOĞRULAMAZ - sadece kaba bir anahtar
// seçimi içindir; gerçek yetkilendirme hâlâ requireAuth middleware'inde yapılır.
function rateLimitKey(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(authHeader.split(' ')[1]);
      if (decoded && decoded.userId) return `user:${decoded.userId}`;
    } catch {
      // token çözümlenemedi, IP'ye düş
    }
  }
  return ipKeyGenerator(req.ip);
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600, // kullanıcı (veya IP) başına 15 dakikada 600 istek
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.' },
});
app.use('/api', apiLimiter);

// Yüklenen dosyalara (profil fotoğrafı, öğrenci belgesi) erişim
// Yalnızca görseller, sayfa olarak çalışamayacak başlıklarla (bkz. lib/safeServe.js)
app.use('/uploads', publicUploadGuard, express.static(PUBLIC_UPLOADS, { index: false, dotfiles: 'deny', setHeaders: publicStaticHeaders }));

// Sağlık kontrolü - sunucu çalışıyor mu test etmek için
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sunucu çalışıyor' });
});

app.use('/api/auth', authRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api', socialRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Rotalarda yakalanmayan hatalar kayda geçer, kullanıcıya sade bir mesaj döner
app.use('/api', expressErrorHandler);

// Yayın ortamında web sitesini (client/dist) de bu sunucu verir: tek adres,
// tek servis. /api, /uploads ve /socket.io dışındaki her istek index.html'e
// düşer (React Router sayfaları).
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const CLIENT_INDEX = path.join(CLIENT_DIST, 'index.html');

// Arama motorları için adresi yayındaki gerçek adresten üretilen dosyalar
// (derlemedeki statik kopyalardan önce gelir)
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(robotsTxt(siteUrl()));
});
app.get('/sitemap.xml', (req, res) => {
  const lastmod = fs.existsSync(CLIENT_INDEX) ? fs.statSync(CLIENT_INDEX).mtime.toISOString().slice(0, 10) : null;
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(sitemapXml(siteUrl(), lastmod));
});

if (fs.existsSync(CLIENT_INDEX)) {
  const indexHtml = fs.readFileSync(CLIENT_INDEX, 'utf8');
  app.get('/index.html', (req, res) => res.redirect(301, '/'));
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '7d', setHeaders: noCacheHtml }));
  // Her sayfa kendi başlığı, açıklaması ve canonical adresiyle; bilinmeyen
  // adresler 404 koduyla (sayfayı yine React'in "bulunamadı" ekranı çizer)
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => {
    // Eksik dosya (ör. eski sürümden kalan /assets/...js) sayfa değil, düz 404
    if (/\.[a-z0-9]{1,8}$/i.test(req.path)) return res.status(404).type('text/plain').send('Bulunamadı');
    const page = renderPage(indexHtml, req.path, configuredSiteUrl());
    res.status(page.status);
    res.setHeader('Cache-Control', 'no-cache');
    if (page.robots.startsWith('noindex')) res.setHeader('X-Robots-Tag', page.robots);
    res.type('html').send(page.html);
  });
}

// HTML, service worker ve manifest her açılışta yeniden doğrulanır ki yeni
// sürüm hemen gelsin (adı içerikle değişen /assets dosyaları uzun süre önbellekte kalır)
function noCacheHtml(res, filePath) {
  if (/\.html$|[\\/]sw\.js$|\.webmanifest$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
}

app.set('io', io);
const { checkMailer } = require('./lib/mailer');
const { bootstrapAccounts } = require('./lib/bootstrap');

setupSocket(io);
startCronJobs(io);

// Giriş anahtarı yoksa hiçbir kullanıcı giriş yapamaz; açıkça belirt ve dur
if (!process.env.JWT_SECRET) {
  console.error('[hata] JWT_SECRET tanımlı değil. Railway > Variables ekranına uzun rastgele bir değer ekleyin.');
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
bootstrapAccounts().finally(() => {
  server.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
    checkMailer();
    for (const warning of productionConfigWarnings()) console.warn(`[ayar] ${warning}`);
  });
});
