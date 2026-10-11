// Bağlantı dönünce ya da düğmeye basılınca sayfa yenilenir.
// Ayrı dosyadadır: güvenlik politikası (CSP) satır içi betiğe izin vermez.
document.getElementById('retry').addEventListener('click', () => location.reload());
window.addEventListener('online', () => location.reload());
