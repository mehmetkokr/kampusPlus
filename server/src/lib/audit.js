// Yönetici işlem kaydı. Yönetim panelinden geçen her başarılı değişiklik
// (ve yedek indirme) otomatik kaydedilir: kim, ne zaman, hangi kayda, ne yaptı.
// Yeni bir yönetici ucu eklendiğinde de ayrıca bir şey yapmak gerekmez.
const prisma = require('./prisma');

// Okunur işlem adları ("YÖNTEM /yol" → açıklama)
const LABELS = {
  'PATCH /users/:id': 'Kullanıcıyı güncelledi',
  'DELETE /users/:id': 'Kullanıcıyı sildi',
  'POST /users/:id/notify': 'Kullanıcıya bildirim gönderdi',
  'POST /universities': 'Üniversite ekledi',
  'PATCH /universities/:id': 'Üniversiteyi güncelledi',
  'DELETE /universities/:id': 'Üniversiteyi sildi',
  'DELETE /posts/:id': 'Gönderiyi sildi',
  'PATCH /reports/:id': 'Şikâyetin durumunu değiştirdi',
  'POST /reports/:id/action': 'Şikâyet için işlem yaptı',
  'DELETE /clubs/:id': 'Kulübü kapattı',
  'DELETE /events/:id': 'Etkinliği sildi',
  'POST /admins': 'Yönetici ekledi',
  'POST /campaigns': 'Kampanya gönderdi',
  'POST /campaigns/:id/stop-banner': 'Duyuru bandını durdurdu',
  'DELETE /campaigns/:id': 'Kampanyayı sildi',
  'POST /backups': 'Veritabanı yedeği aldı',
  'GET /backups/:name': 'Veritabanı yedeğini indirdi',
  'PATCH /errors/:id': 'Hata kaydını güncelledi',
  'DELETE /errors': 'Çözülen hata kayıtlarını sildi',
  'POST /banned-words': 'Yasaklı kelime ekledi',
  'DELETE /banned-words/:id': 'Yasaklı kelimeyi kaldırdı',
  'POST /2fa/setup': 'İki adımlı doğrulama kurulumunu başlattı',
  'POST /2fa/enable': 'İki adımlı doğrulamayı açtı',
  'POST /2fa/disable': 'İki adımlı doğrulamayı kapattı',
};

// Kayda geçmeyecek (salt okuma niteliğinde) POST uçları
const SKIP = new Set(['POST /campaigns/preview']);
// Kayda alınan GET uçları (hassas veri dışarı çıkıyor)
const LOGGED_GETS = new Set(['GET /backups/:name', 'GET /users/export.csv']);

const SECRET_KEY = /pass|code|secret|token|otp/i;

function cleanDetails(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SECRET_KEY.test(k)) continue;
    out[k] = typeof v === 'string' && v.length > 200 ? `${v.slice(0, 200)}…` : v;
  }
  const json = JSON.stringify(out);
  return json === '{}' ? null : json.slice(0, 2000);
}

const nameCache = new Map();
async function adminName(id) {
  if (nameCache.has(id)) return nameCache.get(id);
  const u = await prisma.user.findUnique({ where: { id }, select: { fullName: true, email: true } });
  const name = u ? `${u.fullName} (${u.email})` : `#${id}`;
  nameCache.set(id, name);
  return name;
}

function auditMiddleware(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 400 || !req.route) return;
    const key = `${req.method} ${req.route.path}`;
    if (SKIP.has(key)) return;
    if (req.method === 'GET' && !LOGGED_GETS.has(key)) return;
    const segs = req.route.path.split('/').filter(Boolean);
    const idParam = req.params.id ? Number(req.params.id) : null;
    (async () => {
      await prisma.adminAuditLog.create({
        data: {
          adminId: req.userId,
          adminName: await adminName(req.userId),
          action: LABELS[key] || key,
          targetType: segs[0] || null,
          targetId: Number.isInteger(idParam) ? idParam : null,
          details: cleanDetails({ ...(req.params.name ? { file: req.params.name } : {}), ...(req.body || {}) }),
        },
      });
    })().catch((err) => console.warn('[denetim] İşlem kaydı yazılamadı:', err?.message || err));
  });
  next();
}

module.exports = { auditMiddleware };
