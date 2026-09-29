// Doğum günü bildirimi: her gün çalışan cron görevi, doğum günü bugün olan
// kullanıcılara uygulama içi bildirim + e-posta gönderir.
// Not: Doğum tarihi sayısı büyük olmadığı sürece (kampüs ölçeğinde bir uygulama
// için) tüm birthDate'i dolu kullanıcıları çekip JS tarafında ay/gün
// karşılaştırması yapmak SQLite'ta tarihten ay/gün çıkarmakla uğraşmaktan
// daha basit ve taşınabilir.
const prisma = require('./prisma');
const { createNotification } = require('./notifications');
const { sendMail } = require('./mailer');

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

async function checkBirthdaysToday(io) {
  try {
    const istanbulNow = new Date(Date.now() + TR_OFFSET_MS);
    const month = istanbulNow.getUTCMonth() + 1;
    const day = istanbulNow.getUTCDate();
    const year = istanbulNow.getUTCFullYear();

    const candidates = await prisma.user.findMany({
      where: { birthDate: { not: null }, isBanned: false },
      select: { id: true, email: true, fullName: true, birthDate: true, lastBirthdayNotifiedYear: true },
    });

    const todaysBirthdays = candidates.filter((u) => {
      const b = new Date(u.birthDate);
      return b.getUTCMonth() + 1 === month && b.getUTCDate() === day && u.lastBirthdayNotifiedYear !== year;
    });

    for (const u of todaysBirthdays) {
      await prisma.user.update({ where: { id: u.id }, data: { lastBirthdayNotifiedYear: year } });
      await createNotification(io, { userId: u.id, type: 'birthday' });

      sendMail({
        to: u.email,
        subject: 'İyi ki doğdun! 🎉',
        text: `Merhaba ${u.fullName},\n\nkampüs+ ailesi olarak doğum günün kutlu olsun! Uygulamayı aç, kampüsteki arkadaşların seni tebrik etsin.\n\nkampüste gece 🌙`,
        html: `<p>Merhaba ${u.fullName},</p><p><strong>kampüs+</strong> ailesi olarak doğum günün kutlu olsun! 🎉</p><p>Uygulamayı aç, kampüsteki arkadaşların seni tebrik etsin.</p>`,
      }).catch((err) => console.error('Doğum günü e-postası gönderilemedi:', err));
    }

    if (todaysBirthdays.length > 0) {
      console.log(`[birthday] ${todaysBirthdays.length} kullanıcıya doğum günü bildirimi gönderildi.`);
    }
  } catch (err) {
    console.error('Doğum günü kontrolü başarısız:', err);
  }
}

module.exports = { checkBirthdaysToday };
