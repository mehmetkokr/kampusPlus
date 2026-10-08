// Ana sunucu dosyası
// Express (HTTP API) + Socket.io (gerçek zamanlı mesajlaşma) birlikte çalışır.

require('dotenv').config();
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
const { setupSocket } = require('./socket');
const { startCronJobs } = require('./lib/cron');

const app = express();
const server = http.createServer(app);

// Eğer sunucu bir ters proxy (nginx, Cloudflare, Render/Railway vb.) arkasında
// çalışıyorsa, rate limiter'ın gerçek istemci IP'sini görebilmesi için bu
// açılmalıdır. Proxy YOKSA bunu açmayın: aksi halde istemciler
// X-Forwarded-For header'ını sahteleyerek rate limit'i by-pass edebilir.
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

app.use(cors({ origin: CLIENT_URL }));
// Helmet, güvenlik açısından önemli HTTP başlıklarını (XSS koruması,
// clickjacking koruması, MIME sniffing engeli vb.) otomatik olarak ekler.
// crossOriginResourcePolicy 'cross-origin' yapılır çünkü /uploads ve
// /api/files altındaki dosyalar frontend'in farklı origin'inden (5173)
// <img>/<audio> etiketleriyle doğrudan yükleniyor.
// İçerik Güvenlik Politikası: sitenin açılış betiği satır içi (tema ve
// yükleniyor ekranı), yazı tipleri Google Fonts'tan gelir; gerçek zamanlı
// bağlantı (socket.io) aynı adrese ws/wss ile yapılır.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Apple / Google giriş pencereleri sonucu açan sayfaya iletebilsin
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Apple / Google ile giriş betikleri ve pencereleri
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://appleid.cdn-apple.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https://accounts.google.com', 'https://appleid.apple.com'],
        frameSrc: ["'self'", 'https://accounts.google.com', 'https://appleid.apple.com'],
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
app.use('/uploads', express.static(PUBLIC_UPLOADS));

// Sağlık kontrolü - sunucu çalışıyor mu test etmek için
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Sunucu çalışıyor' });
});

app.use('/api/auth/oauth', require('./routes/oauth'));
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

// Yayın ortamında web sitesini (client/dist) de bu sunucu verir: tek adres,
// tek servis. /api, /uploads ve /socket.io dışındaki her istek index.html'e
// düşer (React Router sayfaları).
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '7d', setHeaders: noCacheHtml }));
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

function noCacheHtml(res, filePath) {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
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
  });
});
