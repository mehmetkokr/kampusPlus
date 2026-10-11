// Hata takibi: sunucu ve tarayıcı hataları ErrorLog tablosuna yazılır ve
// yönetim panelindeki "Sistem" sayfasında görünür. Aynı hata tekrar gelince
// yeni satır açılmaz, sayacı artar. SENTRY_DSN tanımlıysa hatalar ayrıca
// Sentry'ye de gönderilir.
//
// Rotalar hataları çoğunlukla try/catch içinde console.error(err) ile yazdığı
// için console.error sarmalanır: argümanlardan biri Error ise kayda geçer.
const crypto = require('crypto');
const prisma = require('./prisma');

const MAX = { message: 500, stack: 4000, path: 300, userAgent: 300 };
const clip = (v, n) => (v == null ? null : String(v).slice(0, n));
const originalConsoleError = console.error.bind(console);

let sentry = null;
function initSentry() {
  if (!process.env.SENTRY_DSN || sentry) return;
  try {
    sentry = require('@sentry/node');
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: 0,
      sendDefaultPii: false,
    });
  } catch (err) {
    sentry = null;
    originalConsoleError('[hata-takibi] Sentry başlatılamadı:', err);
  }
}

// Sayılar ve kimlikler parmak izini bozmasın: "Kullanıcı 12 bulunamadı" ile
// "Kullanıcı 37 bulunamadı" aynı hata sayılır
function fingerprintOf(source, message, stack) {
  const firstFrame = (stack || '').split('\n').find((l) => l.trim().startsWith('at ')) || '';
  const norm = `${source}|${String(message).replace(/\d+/g, '#')}|${firstFrame.trim().replace(/:\d+:\d+\)?$/, '')}`;
  return crypto.createHash('sha1').update(norm).digest('hex');
}

async function recordError({ source = 'server', message, stack = null, path = null, userAgent = null, userId = null }) {
  try {
    if (!message) return;
    const data = {
      source,
      message: clip(message, MAX.message),
      stack: clip(stack, MAX.stack),
      path: clip(path, MAX.path),
      userAgent: clip(userAgent, MAX.userAgent),
      userId: Number.isInteger(userId) ? userId : null,
    };
    const fingerprint = fingerprintOf(source, data.message, data.stack);
    const update = { count: { increment: 1 }, lastSeen: new Date(), resolved: false, stack: data.stack, path: data.path, userAgent: data.userAgent };
    let row;
    let isNew = false;
    try {
      const existing = await prisma.errorLog.findUnique({ where: { fingerprint }, select: { id: true } });
      isNew = !existing;
      row = await prisma.errorLog.upsert({ where: { fingerprint }, create: { ...data, fingerprint }, update });
    } catch (err) {
      // Aynı hata aynı anda iki kez geldiyse ikinci oluşturma çakışır: sayacı artır
      if (err?.code !== 'P2002') throw err;
      isNew = false;
      row = await prisma.errorLog.update({ where: { fingerprint }, data: update });
    }
    // Yöneticilere haber: ilk kez görülen sunucu hatası ya da çok tekrarlayan hata
    if (source === 'server' && (isNew || row.count % 50 === 0)) {
      const { alertAdmins } = require('./alerts');
      alertAdmins(isNew ? 'error-new' : 'error-spike', {
        subject: isNew ? 'Sunucuda yeni bir hata görüldü' : `Bir hata ${row.count} kez tekrarlandı`,
        text: `${data.message}${data.path ? `
Yer: ${data.path}` : ''}`,
        path: '/admin/system',
        throttleMs: 30 * 60 * 1000,
      });
    }
  } catch (err) {
    // Kayıt yazılamazsa (ör. veritabanı kapalı) sonsuz döngüye girmeden yalnızca yazdır
    originalConsoleError('[hata-takibi] Hata kaydedilemedi:', err?.message || err);
  }
}

function captureServerError(err, context = {}) {
  if (!(err instanceof Error)) return;
  if (sentry) sentry.captureException(err, { extra: context });
  recordError({ source: 'server', message: err.message || err.name, stack: err.stack, path: context.path });
}

function installErrorCapture() {
  initSentry();
  console.error = (...args) => {
    originalConsoleError(...args);
    const err = args.find((a) => a instanceof Error);
    if (err) captureServerError(err);
  };
  process.on('unhandledRejection', (reason) => {
    originalConsoleError('[hata] Yakalanmamış Promise reddi:', reason);
    captureServerError(reason instanceof Error ? reason : new Error(String(reason)));
  });
}

// Express'in son hata yakalayıcısı: next(err) ile gelen ya da yakalanmamış rota hataları
function expressErrorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  // Yükleme hataları (çok büyük dosya, desteklenmeyen tür) kullanıcı hatasıdır
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Dosya çok büyük.' : 'Dosya yüklenemedi.';
    return res.status(400).json({ error: message });
  }
  const status = err.status || err.statusCode || 500;
  // 4xx (ör. bozuk JSON gövdesi) istemci hatasıdır; yalnızca 5xx kayda geçer
  if (status >= 500) {
    captureServerError(err, { path: `${req.method} ${req.originalUrl.split('?')[0]}` });
    originalConsoleError(err);
  }
  res.status(status).json({ error: status < 500 ? err.message : 'Sunucuda beklenmeyen bir hata oluştu.' });
}

// Son görülmesinin üzerinden 90 gün geçmiş kayıtlar silinir
async function pruneErrorLogs(now = Date.now()) {
  const cutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.errorLog.deleteMany({ where: { lastSeen: { lt: cutoff } } });
  return count;
}

module.exports = { recordError, captureServerError, installErrorCapture, expressErrorHandler, pruneErrorLogs, fingerprintOf };
