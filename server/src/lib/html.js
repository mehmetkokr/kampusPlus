// E-posta HTML'ine kullanıcıdan gelen metin (ad, adres) yazılırken kaçış:
// adında HTML olan biri e-postaya bağlantı ya da görüntü sokamasın.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => MAP[ch]);

module.exports = { escapeHtml };
