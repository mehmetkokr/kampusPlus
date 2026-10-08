import { useEffect, useState } from 'react';

// Gönderilen mesaj bu süre içinde geri alınabilir.
// Sunucudaki karşılığı: server/src/lib/unsend.js
export const UNSEND_WINDOW_MS = 60 * 1000;

// Kalan geri alma süresi (sn); süre dolduysa 0
export function unsendSecondsLeft(createdAt, now) {
  const left = UNSEND_WINDOW_MS - (now - new Date(createdAt).getTime());
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

// Geri alınabilir kendi mesajın varken saniyede bir güncellenen "şimdi".
// Hiç yoksa sayaç durur, gereksiz yeniden çizim olmaz.
export function useUnsendClock(messages, myUserId) {
  const [now, setNow] = useState(() => Date.now());
  const active = messages.some((m) => m.senderId === myUserId && unsendSecondsLeft(m.createdAt, now) > 0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  // Yeni mesaj gelince sayaç beklemeden başlasın
  useEffect(() => {
    setNow(Date.now());
  }, [messages.length]);
  return now;
}
