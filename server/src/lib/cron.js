// Zamanlanmış (cron) görevler: doğum günü kontrolü (her gün), haftalık
// özet (her Pazartesi), veritabanı yedeği ve yüklenen dosyaların temizliği
// (her gece).
// Saat, Türkiye saatine (Europe/Istanbul) göre ayarlanır.
const cron = require('node-cron');
const { checkBirthdaysToday } = require('./birthday');
const { sendWeeklySummaries } = require('./weeklySummary');
const { runUploadCleanup } = require('./uploads');
const { runBackup } = require('./backup');
const { sendEventReminders } = require('./eventReminders');

function startCronJobs(io) {
  // Her gün 09:00 (Europe/Istanbul) - doğum günü kontrolü.
  cron.schedule('0 9 * * *', () => checkBirthdaysToday(io), { timezone: 'Europe/Istanbul' });

  // Her Pazartesi 09:00 (Europe/Istanbul) - haftalık özet.
  cron.schedule('0 9 * * 1', () => sendWeeklySummaries(io), { timezone: 'Europe/Istanbul' });

  // Her 10 dakikada bir - yaklaşan kulüp etkinlikleri için katılımcılara hatırlatma.
  cron.schedule('*/10 * * * *', () => sendEventReminders(io), { timezone: 'Europe/Istanbul' });

  // Her gece 03:30 (Europe/Istanbul) - veritabanı yedeği (temizlikten önce).
  cron.schedule('30 3 * * *', runBackup, { timezone: 'Europe/Istanbul' });

  // Her gece 04:00 (Europe/Istanbul) - eski hikayeler ve hiçbir kayda bağlı olmayan dosyalar.
  cron.schedule('0 4 * * *', runUploadCleanup, { timezone: 'Europe/Istanbul' });

  console.log('[cron] Zamanlanmış görevler başlatıldı (doğum günü: günlük, haftalık özet: Pazartesi, etkinlik hatırlatması: 10 dk, yedek ve dosya temizliği: her gece).');
}

module.exports = { startCronJobs };
