// Grup D — Anonim İtiraf Kutusu moderasyon yardımcıları.
// İçerik anonim olduğu ve hassas olabileceği için (güçlü moderasyon gerektirir)
// bu dosya kasıtlı olarak tek bir sorumluluğa sahip: bir itiraf yeterince
// şikayet aldığında insan incelemesini beklemeden görünürlükten kaldırmak.
// Bu "silme" değildir - içerik veritabanında kalır (admin panelinde
// incelenebilir, gerekirse geri açılabilir), sadece diğer öğrencilere
// gösterilmeyi durdurur.
const prisma = require('./prisma');

// Küçük/kapalı bir kampüs topluluğunda tek bir kötü niyetli şikayetin içeriği
// gizlememesi için 1'den yüksek, ama gerçek bir sorunun uzun süre görünür
// kalmaması için de düşük tutulan bir eşik.
const AUTO_HIDE_REPORT_THRESHOLD = 3;

async function registerConfessionReport(confessionId) {
  const confession = await prisma.confession.findUnique({ where: { id: confessionId } });
  if (!confession) return;

  const reportCount = confession.reportCount + 1;
  const data = { reportCount };
  if (confession.status === 'visible' && reportCount >= AUTO_HIDE_REPORT_THRESHOLD) {
    data.status = 'hidden_auto';
  }

  await prisma.confession.update({ where: { id: confessionId }, data });
}

module.exports = { registerConfessionReport, AUTO_HIDE_REPORT_THRESHOLD };
