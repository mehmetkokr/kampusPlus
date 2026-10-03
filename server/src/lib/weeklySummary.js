// Haftalık özet bildirimi: her Pazartesi çalışan cron görevi, kullanıcının son
// 7 gündeki aktivitesini (yeni takipçi, beğeni, eşleşme, mesaj) özetleyip
// uygulama içi bildirim + (aktivite varsa) e-posta gönderir. Amaç, bir süredir
// uygulamayı açmamış kullanıcıları "neler kaçırdın" mesajıyla geri çağırmak.
const prisma = require('./prisma');
const { createNotification } = require('./notifications');
const { sendMail } = require('./mailer');

async function sendWeeklySummaries(io) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      where: { isBanned: false, weeklySummaryEnabled: true },
      select: { id: true, email: true, fullName: true },
    });

    let sentCount = 0;

    for (const u of users) {
      const [newFollowers, newLikes, newComments, newMatches, newMessages] = await Promise.all([
        prisma.follow.count({ where: { followingId: u.id, createdAt: { gte: weekAgo } } }),
        prisma.postLike.count({ where: { post: { authorId: u.id }, createdAt: { gte: weekAgo } } }),
        prisma.comment.count({ where: { post: { authorId: u.id }, createdAt: { gte: weekAgo } } }),
        prisma.match.count({ where: { OR: [{ userAId: u.id }, { userBId: u.id }], createdAt: { gte: weekAgo } } }),
        prisma.message.count({
          where: {
            match: { OR: [{ userAId: u.id }, { userBId: u.id }] },
            senderId: { not: u.id },
            createdAt: { gte: weekAgo },
          },
        }),
      ]);

      const total = newFollowers + newLikes + newComments + newMatches + newMessages;
      const summaryText = `Bu hafta: ${newFollowers} yeni takipçi, ${newLikes + newComments} etkileşim, ${newMatches} eşleşme, ${newMessages} mesaj.`;

      await createNotification(io, { userId: u.id, type: 'weekly_summary', message: summaryText });
      await prisma.user.update({ where: { id: u.id }, data: { lastWeeklySummaryAt: new Date() } });
      sentCount += 1;

      // Hiç aktivite yoksa e-posta kutusunu doldurmamak için sadece bildirim
      // gönderilir; en az bir şey olduysa e-posta ile de hatırlatılır.
      if (total > 0) {
        sendMail({
          to: u.email,
          subject: 'kampüs·: Haftalık özetin',
          text: `Merhaba ${u.fullName},\n\n${summaryText}\n\nGeri dön, neler olduğunu gör!`,
          html: `<p>Merhaba ${u.fullName},</p><p>${summaryText}</p><p>Geri dön, neler olduğunu gör!</p>`,
        }).catch((err) => console.error('Haftalık özet e-postası gönderilemedi:', err));
      }
    }

    console.log(`[weeklySummary] ${sentCount} kullanıcıya haftalık özet gönderildi.`);
  } catch (err) {
    console.error('Haftalık özet gönderilemedi:', err);
  }
}

module.exports = { sendWeeklySummaries };
