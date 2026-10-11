// Yönetici uyarıları: önemli bir şey olunca panele bakmayı beklemeden
// yöneticilere e-posta ve (bildirimi açıksa) anlık bildirim gider.
//   - ilk kez görülen sunucu hatası ve hızla tekrarlayan hata
//   - başarısız veritabanı yedeği ya da dış depoya yükleme
//   - yeni şikâyet
// Aynı tür uyarı en fazla belirli aralıkla bir kez gider (gürültü olmasın).
// Alıcılar: ADMIN_ALERT_EMAILS (virgülle) tanımlıysa onlar, değilse tüm yöneticiler.
const prisma = require('./prisma');
const { escapeHtml } = require('./text');

const lastSent = new Map();

// Sunucu kayıtları için; console.error sarmalandığı için uyarı göndermeyi
// tetikleyip döngüye girmesin diye warn kullanılır
const log = (...a) => console.warn('[uyarı]', ...a);

async function recipients() {
  const fixed = (process.env.ADMIN_ALERT_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const admins = await prisma.user.findMany({ where: { isAdmin: true, isBanned: false }, select: { id: true, email: true } });
  return { emails: fixed.length ? fixed : admins.map((a) => a.email), adminIds: admins.map((a) => a.id) };
}

const panelUrl = (path) => `${(process.env.CLIENT_URL || '').replace(/\/+$/, '')}${path}`;

/**
 * @param {string} key - uyarı türü (aynı anahtar throttleMs içinde bir kez gider)
 * @param {{ subject: string, text: string, path: string, throttleMs?: number }} alert
 */
async function alertAdmins(key, { subject, text, path, throttleMs = 60 * 60 * 1000 }) {
  try {
    if (process.env.NODE_ENV === 'test' || process.env.ADMIN_ALERTS === 'off') return false;
    const now = Date.now();
    if (now - (lastSent.get(key) || 0) < throttleMs) return false;
    lastSent.set(key, now);

    const { sendMail } = require('./mailer');
    const { sendToUser } = require('./push');
    const { emails, adminIds } = await recipients();
    const url = panelUrl(path);
    const html = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p><p><a href="${escapeHtml(url)}">Yönetim panelinde aç</a></p><p style="color:#888;font-size:12px">kampüs· otomatik yönetici uyarısı</p>`;
    await Promise.all([
      ...emails.map((to) => sendMail({ to, subject: `[kampüs·] ${subject}`, text: `${text}\n\n${url}`, html }).catch((err) => log('e-posta gönderilemedi:', err.message))),
      ...adminIds.map((id) => sendToUser(id, { title: 'kampüs· yönetim', body: subject, url: path, tag: `alert-${key}` }).catch(() => 0)),
    ]);
    return true;
  } catch (err) {
    log('gönderilemedi:', err?.message || err);
    return false;
  }
}

// Test yardımcıları
const resetAlertThrottle = () => lastSent.clear();

module.exports = { alertAdmins, resetAlertThrottle };
