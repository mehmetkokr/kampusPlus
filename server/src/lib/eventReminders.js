// Kulüp etkinliği hatırlatması: "Katılıyorum" diyen herkese etkinlik
// başlamadan yaklaşık 1–1,5 saat önce bir kez bildirim (ve uygulama kapalıysa
// anlık bildirim) gider. Her 10 dakikada bir çalışır.
const prisma = require('./prisma');
const { createNotification } = require('./notifications');

const WINDOW_MS = 90 * 60 * 1000;

async function sendEventReminders(io, now = new Date()) {
  try {
    const events = await prisma.event.findMany({
      where: { reminderSentAt: null, startsAt: { gt: now, lte: new Date(now.getTime() + WINDOW_MS) } },
      select: { id: true, title: true, location: true, startsAt: true, clubId: true, club: { select: { name: true } }, rsvps: { select: { userId: true } } },
    });
    let sent = 0;
    for (const e of events) {
      // Önce işaretle: aynı anda iki kez çalışırsa çift bildirim gitmesin
      const { count } = await prisma.event.updateMany({ where: { id: e.id, reminderSentAt: null }, data: { reminderSentAt: now } });
      if (!count) continue;
      const message = JSON.stringify({ club: e.club.name, title: e.title, startsAt: e.startsAt, location: e.location });
      await Promise.all(
        e.rsvps.map((r) =>
          createNotification(io, { userId: r.userId, type: 'event_reminder', targetType: 'club', targetId: e.clubId, message })
        )
      );
      sent += e.rsvps.length;
    }
    if (sent) console.log(`[hatırlatma] ${events.length} etkinlik için ${sent} hatırlatma gönderildi.`);
    return sent;
  } catch (err) {
    console.error('[hatırlatma] Etkinlik hatırlatmaları gönderilemedi:', err);
    return 0;
  }
}

module.exports = { sendEventReminders };
