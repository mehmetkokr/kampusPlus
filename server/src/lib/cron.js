// Zamanlanmış (cron) görevler: doğum günü kontrolü (her gün), haftalık özet
// (her Pazartesi) ve ders arkadaşı gruplarının dönemlik temizliği (her ay).
// Saat, Türkiye saatine (Europe/Istanbul) göre ayarlanır.
const cron = require('node-cron');
const { checkBirthdaysToday } = require('./birthday');
const { sendWeeklySummaries } = require('./weeklySummary');
const { runSemesterCleanup } = require('./classmateGroups');

function startCronJobs(io) {
  // Her gün 09:00 (Europe/Istanbul) - doğum günü kontrolü.
  cron.schedule('0 9 * * *', () => checkBirthdaysToday(io), { timezone: 'Europe/Istanbul' });

  // Her Pazartesi 09:00 (Europe/Istanbul) - haftalık özet.
  cron.schedule('0 9 * * 1', () => sendWeeklySummaries(io), { timezone: 'Europe/Istanbul' });

  // Her ayın 1'i, 04:00 (Europe/Istanbul) - ders arkadaşı gruplarının dönemlik
  // temizliği. Ayda bir kontrol etmek yeterli: dönem geçişleri ay sınırına tam
  // denk gelmese de fonksiyon idempotenttir (zaten arşivlenmiş grubu tekrar
  // işaretlemek zararsızdır), bu yüzden kaba bir zamanlama sorun oluşturmaz.
  cron.schedule('0 4 1 * *', () => runSemesterCleanup(), { timezone: 'Europe/Istanbul' });

  console.log('[cron] Zamanlanmış görevler başlatıldı (doğum günü: günlük, haftalık özet: Pazartesi, dönemlik temizlik: aylık).');
}

module.exports = { startCronJobs };
