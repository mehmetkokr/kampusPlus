// Gönderilen mesajı geri alma süresi. Gönderen yalnızca bu süre içinde
// kendi mesajını silebilir; kulüp yöneticileri moderasyon için süresiz siler.
// İstemcideki karşılığı: client/src/constants/messages.js
const UNSEND_WINDOW_MS = 60 * 1000;
// Saat farkı ve ağ gecikmesi için küçük bir pay
const UNSEND_GRACE_MS = 5 * 1000;

function canUnsend(createdAt, now = Date.now()) {
  return now - new Date(createdAt).getTime() <= UNSEND_WINDOW_MS + UNSEND_GRACE_MS;
}

module.exports = { UNSEND_WINDOW_MS, canUnsend };
