// Sunucudaki server/src/lib/text.js ile aynı kural: kullanıcı alandan çıkınca
// yazdığı ad/bölüm Türkçe büyük/küçük harf kurallarıyla düzeltilir
// ("MEHMET ali" -> "Mehmet Ali"). Sunucu da kayıtta aynı düzeltmeyi uygular.
const LOWER_WORDS = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de']);

export function toTitleCaseTR(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;
  return cleaned
    .split(' ')
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('tr-TR');
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR'));
    })
    .join(' ');
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

// Kayıt formundaki tarih seçicisi için: bugünden `years` yıl önceki gün (YYYY-MM-DD)
export function yearsAgoISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}
