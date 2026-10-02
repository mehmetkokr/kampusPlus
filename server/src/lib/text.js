// Kullanıcının serbestçe yazdığı ad/bölüm gibi alanları tutarlı hale getirir.
// Türkçe büyük/küçük harf kuralları (i/İ, ı/I) için 'tr-TR' yereli kullanılır:
// "yönetim bilişim sistemleri" -> "Yönetim Bilişim Sistemleri",
// "MEHMET ali" -> "Mehmet Ali". Bağlaçlar (ve, ile, veya) cümle içinde küçük kalır.
const LOWER_WORDS = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de']);

function toTitleCaseTR(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (!cleaned) return cleaned;

  return cleaned
    .split(' ')
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('tr-TR');
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      // Tire veya kesme işaretiyle birleşik kelimeler: "ali-rıza", "o'neil"
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR'));
    })
    .join(' ');
}

// E-posta adresleri büyük/küçük harfe duyarsız karşılaştırılır.
function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

module.exports = { toTitleCaseTR, normalizeEmail };
