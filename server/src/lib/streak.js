// Art arda giriş (streak) mantığı.
// "Gün" Europe/Istanbul saatine göre hesaplanır (Türkiye sabit UTC+3 kullanır,
// yaz saati uygulaması yok - bu yüzden basit bir sabit ofset yeterli).
const prisma = require('./prisma');
const { createNotification } = require('./notifications');

const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Streak'in "kutlandığı" eşikler - bu günlerde ayrıca bir bildirim atılır.
const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

// Verilen anı Türkiye saatine göre "YYYY-MM-DD" gün anahtarına çevirir.
function istanbulDateKey(date = new Date()) {
  const istanbul = new Date(date.getTime() + TR_OFFSET_MS);
  return istanbul.toISOString().slice(0, 10);
}

// İki gün anahtarı arasındaki gün farkı (b - a).
function daysBetweenKeys(keyA, keyB) {
  const a = new Date(`${keyA}T00:00:00Z`).getTime();
  const b = new Date(`${keyB}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/**
 * Kullanıcının bugünkü girişini/etkinliğini kaydeder ve streak'i günceller.
 * Aynı gün içinde birden fazla çağrılsa da sonuç idempotenttir.
 * requireAuth middleware'inden isteği bekletmeden ("fire and forget") çağrılır,
 * bu yüzden hata fırlatmaz - sadece loglar.
 *
 * @param {import('socket.io').Server | null} io
 * @param {number} userId
 */
async function touchStreak(io, userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, currentStreak: true, longestStreak: true, lastStreakDate: true },
    });
    if (!user) return;

    const todayKey = istanbulDateKey();
    const lastKey = user.lastStreakDate ? istanbulDateKey(user.lastStreakDate) : null;

    if (lastKey === todayKey) return; // bugün zaten sayıldı, hiçbir şey yapma

    const gap = lastKey ? daysBetweenKeys(lastKey, todayKey) : null;
    // Dün giriş yapılmışsa seri devam eder; aksi halde (ilk giriş ya da en az
    // bir gün atlanmışsa) seri 1'den yeniden başlar.
    const newStreak = gap === 1 ? user.currentStreak + 1 : 1;
    const newLongest = Math.max(user.longestStreak, newStreak);

    await prisma.user.update({
      where: { id: userId },
      data: { currentStreak: newStreak, longestStreak: newLongest, lastStreakDate: new Date() },
    });

    if (MILESTONES.includes(newStreak)) {
      await createNotification(io, {
        userId,
        type: 'streak_milestone',
        message: String(newStreak),
      });
    }
  } catch (err) {
    console.error('Streak güncellenemedi:', err);
  }
}

module.exports = { touchStreak, istanbulDateKey, MILESTONES };
