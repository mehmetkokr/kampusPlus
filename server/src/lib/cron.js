// Zamanlanmış (cron) görevler: doğum günü kontrolü (her gün) ve haftalık
// özet (her Pazartesi).
// Saat, Türkiye saatine (Europe/Istanbul) göre ayarlanır.
const cron = require('node-cron');
const { checkBirthdaysToday } = require('./birthday');
const { sendWeeklySummaries } = require('./weeklySummary');

function startCronJobs(io) {
  // Her gün 09:00 (Europe/Istanbul) - doğum günü kontrolü.
  cron.schedule('0 9 * * *', () => checkBirthdaysToday(io), { timezone: 'Europe/Istanbul' });

  // Her Pazartesi 09:00 (Europe/Istanbul) - haftalık özet.
  cron.schedule('0 9 * * 1', () => sendWeeklySummaries(io), { timezone: 'Europe/Istanbul' });

  console.log('[cron] Zamanlanmış görevler başlatıldı (doğum günü: günlük, haftalık özet: Pazartesi).');
}

module.exports = { startCronJobs };
