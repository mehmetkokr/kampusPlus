// Bir işlemin en az `ms` sürmesini sağlar: yükleme animasyonu çok hızlı
// cevaplarda bir anlık yanıp sönüp kaybolmasın diye kullanılır.
export function minDuration(ms) {
  const started = Date.now();
  return () => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms - (Date.now() - started))));
}
