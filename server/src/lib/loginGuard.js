// Hesap bazlı giriş koruması: IP sınırı (auth.js loginLimiter) tek adresten
// gelen denemeleri durdurur; çok sayıda IP'den tek bir hesaba yapılan şifre
// tahminini ise bu katman yavaşlatır. Aynı e-postaya 15 dakikada
// ACCOUNT_LOGIN_LIMIT (varsayılan 8) hatalı deneme yapılınca o e-posta 15
// dakika denemeye kapanır. Kayıtlı olsun olmasın her adres için aynı işler;
// yanıttan hesabın var olup olmadığı anlaşılmaz. Başarılı giriş ya da şifre
// sıfırlama sayacı temizler. Bellekte tutulur (tek sunucu).
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // e-posta -> { count, first }

const limit = () => Number(process.env.ACCOUNT_LOGIN_LIMIT) || 8;
const key = (email) => String(email || '').trim().toLowerCase();

function prune(now) {
  if (failures.size < 5000) return;
  for (const [k, v] of failures) if (now - v.first > WINDOW_MS) failures.delete(k);
}

// Kilitliyse kalan saniye, değilse 0
function lockedFor(email, now = Date.now()) {
  const entry = failures.get(key(email));
  if (!entry) return 0;
  if (now - entry.first > WINDOW_MS) {
    failures.delete(key(email));
    return 0;
  }
  return entry.count >= limit() ? Math.ceil((entry.first + WINDOW_MS - now) / 1000) : 0;
}

function recordFailure(email, now = Date.now()) {
  prune(now);
  const k = key(email);
  const entry = failures.get(k);
  if (!entry || now - entry.first > WINDOW_MS) failures.set(k, { count: 1, first: now });
  else entry.count += 1;
}

function clearFailures(email) {
  failures.delete(key(email));
}

module.exports = { lockedFor, recordFailure, clearFailures, WINDOW_MS };
