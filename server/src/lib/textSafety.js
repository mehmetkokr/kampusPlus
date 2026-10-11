// Kullanıcı metinleri için ortak kurallar: tür ve uzunluk kontrolü, yasaklı
// kelime filtresi. Sohbet (birebir ve kulüp), gönderi, yorum, biyografi,
// kulüp ve etkinlik metinleri buradan geçer.
//
// Yasaklı kelimeler silinmez, ilk harfi kalacak şekilde yıldızlanır ("s*****").
// Varsayılan liste bilinçli olarak kısa ve yalnızca açık hakaret/küfürlerden
// oluşur; yöneticiler panelden (Ayarlar > Yasaklı kelimeler) ekleme yapabilir.
const prisma = require('./prisma');

// Sunucudaki üst sınırlar (arayüzdeki sınırlarla aynı)
const LIMITS = {
  message: 2000, // birebir ve kulüp sohbeti
  bio: 300,
  post: 280,
  comment: 280,
  reportDescription: 1000,
  eventTitle: 100,
  eventDescription: 1000,
  eventLocation: 120,
};

// Kök biçimler: kelimenin başında geçerse eşleşir (ekleriyle birlikte yakalar).
// Kısa ve masum kelimelerle karışabilecek kökler (ör. "am") listede yok.
const DEFAULT_ROOTS = [
  'siktir', 'sikeyim', 'sikerim', 'sikik', 'sikiş', 'yarrak', 'yarak', 'orospu', 'oruspu', 'kahpe',
  'pezevenk', 'gavat', 'ibne', 'puşt', 'amcık', 'amına', 'amk', 'aq', 'mk', 'oç', 'göt', 'götveren',
  'şerefsiz', 'piç', 'kaltak', 'sürtük', 'yavşak',
];
// Tam kelime olarak eşleşmesi gerekenler (kök olarak çok fazla masum kelimeyi yakalardı)
const EXACT_ONLY = new Set(['aq', 'mk', 'oç', 'göt', 'amk', 'piç']);
const EXACT_SUFFIXES = ['', 'ler', 'lar', 'in', 'ın', 'un', 'ün', 'e', 'a', 'i', 'ı', 'u', 'ü', 'ini', 'ını', 'leri', 'ları', 'lik', 'lık'];

// Harf benzeri rakam ve simgeler ("s1kt1r", "@pt@l")
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
function normalizeWord(w) {
  return w
    .toLocaleLowerCase('tr-TR')
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(.)\1{2,}/g, '$1$1'); // "siiiiktir" → "siiktir"
}
const collapse = (w) => w.replace(/(.)\1+/g, '$1');

let extraWords = [];
let extraLoadedAt = 0;
const CACHE_MS = 60 * 1000;

async function loadExtraWords() {
  if (Date.now() - extraLoadedAt < CACHE_MS) return extraWords;
  try {
    const rows = await prisma.bannedWord.findMany({ select: { word: true } });
    extraWords = rows.map((r) => normalizeWord(r.word));
  } catch {
    // tablo henüz yoksa ya da veritabanı meşgulse varsayılan liste yeter
  }
  extraLoadedAt = Date.now();
  return extraWords;
}

function invalidateBannedWords() {
  extraLoadedAt = 0;
}

function isBanned(word, extras) {
  const n = normalizeWord(word);
  const c = collapse(n);
  for (const root of DEFAULT_ROOTS) {
    if (EXACT_ONLY.has(root)) {
      // Yalnızca yaygın çekim ekleriyle: "piçler" yakalanır, "götürmek" yakalanmaz
      if (EXACT_SUFFIXES.some((suf) => n === root + suf || c === root + suf)) return true;
    } else if (n.startsWith(root) || c.startsWith(collapse(root))) {
      return true;
    }
  }
  return extras.some((x) => n === x || c === collapse(x) || (x.length >= 5 && n.startsWith(x)));
}

// Metindeki yasaklı kelimeleri yıldızlar
async function maskBannedWords(text) {
  if (!text) return text;
  const extras = await loadExtraWords();
  // Unicode harf ve rakam dizileri (ayrıca @ ve $ leet harfleri) kelime sayılır
  return text.replace(/[\p{L}\p{N}@$]+/gu, (w) => (isBanned(w, extras) ? w[0] + '*'.repeat(w.length - 1) : w));
}

/**
 * Kullanıcıdan gelen metni doğrular ve temizler.
 * @returns {Promise<{ value: string|null } | { error: string }>}
 */
async function cleanUserText(raw, { max, required = false, label = 'Metin', filter = true } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    return required ? { error: `${label} boş olamaz.` } : { value: null };
  }
  if (typeof raw !== 'string') return { error: `${label} geçersiz.` };
  const trimmed = raw.trim();
  if (!trimmed) return required ? { error: `${label} boş olamaz.` } : { value: null };
  if (max && trimmed.length > max) return { error: `${label} en fazla ${max} karakter olabilir.` };
  return { value: filter ? await maskBannedWords(trimmed) : trimmed };
}

module.exports = { LIMITS, DEFAULT_ROOTS, cleanUserText, maskBannedWords, invalidateBannedWords, normalizeWord };
