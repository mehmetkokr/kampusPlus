// Türkiye akademik takvimine göre "dönem anahtarı" hesaplar.
// Kesin tarihler üniversiteye göre değişse de kabaca:
//   Eylül - Ocak  -> Güz dönemi (finaller Ocak'ta olduğu için Ocak da güze dahil)
//   Şubat - Haziran -> Bahar dönemi
//   Temmuz - Ağustos -> Yaz (staj/yaz okulu dönemi)
// semesterKey formatı: "{yıl}-{güz|bahar|yaz}" - örn. "2025-guz", "2026-bahar".
// Yıl, güz döneminde o akademik yılın BAŞLADIĞI takvim yılıdır (örn. Ocak 2026
// hâlâ "2025-guz"e dahildir).

function getSemesterKeyForDate(date = new Date()) {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 9 && month <= 12) return `${year}-guz`;
  if (month === 1) return `${year - 1}-guz`;
  if (month >= 2 && month <= 6) return `${year}-bahar`;
  return `${year}-yaz`; // 7, 8
}

function getCurrentSemesterKey() {
  return getSemesterKeyForDate(new Date());
}

const SEMESTER_LABELS = { guz: 'Güz', bahar: 'Bahar', yaz: 'Yaz' };

function formatSemesterLabel(semesterKey) {
  const [year, term] = semesterKey.split('-');
  return `${year} ${SEMESTER_LABELS[term] || term}`;
}

// semesterKey'leri kronolojik sıraya koyabilmek için karşılaştırılabilir bir
// tamsayıya çevirir. Her yılda 3 dönem olduğu varsayılır (bahar/yaz/güz), bu
// yüzden iki değer arasındaki fark doğrudan "kaç dönem arayla" sorusuna cevap
// verir (ör. fark 3 ise tam 1 yıl sonra demektir).
const TERM_ORDER = { bahar: 0, yaz: 1, guz: 2 };
function semesterKeyToSortValue(semesterKey) {
  const [year, term] = semesterKey.split('-');
  return Number(year) * 3 + (TERM_ORDER[term] ?? 0);
}

module.exports = {
  getSemesterKeyForDate,
  getCurrentSemesterKey,
  formatSemesterLabel,
  semesterKeyToSortValue,
};
