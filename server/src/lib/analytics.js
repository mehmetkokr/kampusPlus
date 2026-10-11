// Kullanım analitiği: kendi veritabanımızda, dışarıya veri göndermeden.
// Tutulanlar: olay adı, (sayfa görüntülemede) sayfa yolu, varsa kullanıcı ya
// da giriş yapmamış ziyaretçi için tarayıcıda üretilen rastgele anonim kimlik.
// IP, cihaz veya konum bilgisi tutulmaz. Olaylar 180 gün saklanır.
const prisma = require('./prisma');

// Tarayıcıdan gönderilebilecek olaylar (geri kalanı yalnızca sunucuda üretilir)
const CLIENT_EVENTS = new Set(['page_view', 'paywall_view', 'checkout_click', 'pwa_installed']);

// Sunucuda üretilen olaylar:
//   code_sent        kayıt için e-posta kodu istendi
//   signup           hesap oluşturuldu (okul e-postası doğrulandı)
//   onboarding_done  doğum tarihi, bölüm ve sınıf tamamlandı
//   push_enabled     anlık bildirimler açıldı
const RETENTION_DAYS = 180;

// Sayfa yolunu sadeleştir: sorgu ve sayısal kimlikler atılır, böylece
// /chat/12 ile /chat/40 aynı sayfa sayılır ve yolda kişisel veri kalmaz
function normalizePath(p) {
  if (typeof p !== 'string' || !p.startsWith('/')) return null;
  return (
    p
      .split(/[?#]/)[0]
      .split('/')
      .map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f-]{16,}$/i.test(seg) ? ':id' : seg))
      .join('/')
      .slice(0, 120) || '/'
  );
}

const ANON_RE = /^[a-z0-9-]{8,64}$/i;

async function track(name, { userId = null, anonId = null, path = null, props = null } = {}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name,
        userId: Number.isInteger(userId) ? userId : null,
        anonId: anonId && ANON_RE.test(anonId) ? anonId : null,
        path: normalizePath(path),
        props: props ? JSON.stringify(props).slice(0, 500) : null,
      },
    });
  } catch (err) {
    // Analitik hiçbir zaman asıl işlemi bozmamalı
    console.warn('[analitik] Olay yazılamadı:', err?.message || err);
  }
}

async function pruneAnalytics(now = Date.now()) {
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

module.exports = { CLIENT_EVENTS, track, normalizePath, pruneAnalytics };
