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
// Karşılaştırma Türkçe karaktersiz biçimle de yapılır ("serefsiz", "yavsak");
// yalnızca "ı" korunur, yoksa "sıkmak/sıkıldım" gibi masum kelimeler karışırdı.
const DEFAULT_ROOTS = [
  'siktir', 'sikeyim', 'sikerim', 'sikik', 'sikiş', 'yarrak', 'yarak', 'dalyarak', 'orospu', 'oruspu', 'orosbu', 'orspu',
  'kahpe', 'kahbe', 'pezevenk', 'pezeveng', 'gavat', 'ibne', 'puşt', 'amcık', 'amcığ', 'amına', 'amina', 'amk', 'amq',
  'aq', 'mk', 'oç', 'göt', 'götveren', 'götoş', 'şerefsiz', 'piç', 'kaltak', 'sürtük', 'yavşak', 'taşak', 'daşşak',
  'kevaşe', 'sakso',
];
// Tam kelime olarak eşleşmesi gerekenler (kök olarak çok fazla masum kelimeyi yakalardı)
const EXACT_ONLY = new Set(['aq', 'mk', 'oç', 'göt', 'amk', 'amq', 'piç', 'puşt']);
// Türkçe karaktersiz biçimi masum bir kelimeye denk gelenler: yalnızca yazıldığı gibi
// eşleşir ("göt" → "got" İngilizce, "oç" → "oc")
const NO_FOLD = new Set(['göt', 'oç']);
const EXACT_SUFFIXES = ['', 'ler', 'lar', 'in', 'ın', 'un', 'ün', 'e', 'a', 'i', 'ı', 'u', 'ü', 'ini', 'ını', 'leri', 'ları', 'lik', 'lık'];

// "sik-" fiilinin çekimleri: kökü tek başına aramak "sikke", "sikayet"
// (şikayet), "sikildim" (sıkıldım) gibi kelimeleri de yıldızlardı. Bu yüzden
// yalnızca küfür anlamındaki çekim ekleriyle eşleşir: sikmek, sikmeye,
// sikmege, siktir, siktim, siktiğim, sikeyim, sikerim, sikeceğim, sikim, sikiş, sikik...
// Kök "i" ile aranır: "ı" ile yazılan "sıkmak / sıkıldım" masumdur.
const SIK_FORMS = /^si+k+(?:m[ae](?:k|ye|ge|yi|m|z|di|si|li)|t[iı]r|t[iı](?:m|n|k|ğ|g)|ti$|[iı]y[iı]m|ey[iı]m|er[iı]m|er$|ece[kğgm]|[iı]ş|[iı]k$|[iı]k[iı]|[iı]m$|[iı]mi|[iı]mle)/;

// Harf benzeri rakam ve simgeler ("s1kt1r", "@pt@l")
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
function normalizeWord(w) {
  return w
    .toLocaleLowerCase('tr-TR')
    .replace(/[013457@$]/g, (c) => LEET[c])
    .replace(/(.)\1{2,}/g, '$1$1'); // "siiiiktir" → "siiktir"
}
const collapse = (w) => w.replace(/(.)\1+/g, '$1');
// Türkçe karaktersiz biçim ("ı" hariç)
const fold = (w) => w.replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/[âàá]/g, 'a').replace(/[îí]/g, 'i').replace(/[ûú]/g, 'u');

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
  const f = fold(n);
  const fc = collapse(f);
  if (SIK_FORMS.test(f) || SIK_FORMS.test(fc)) return true;
  for (const root of DEFAULT_ROOTS) {
    const forms = NO_FOLD.has(root) ? [[n, c, root]] : [[n, c, root], [f, fc, fold(root)]];
    for (const [w, wc, r] of forms) {
      if (EXACT_ONLY.has(root)) {
        // Yalnızca yaygın çekim ekleriyle: "piçler" yakalanır, "götürmek" yakalanmaz
        if (EXACT_SUFFIXES.some((suf) => w === r + suf || wc === r + suf)) return true;
      } else if (w.startsWith(r) || wc.startsWith(collapse(r))) {
        return true;
      }
    }
  }
  return extras.some((x) => n === x || c === collapse(x) || f === fold(x) || (x.length >= 5 && (n.startsWith(x) || f.startsWith(fold(x)))));
}

// Harflerin arasına nokta, boşluk, tire vb. konarak bölünmüş yazım ("s.i.k.t.i.r",
// "o r o s p u"): tek harflerden oluşan en az 3 parçalık diziler birleştirilip denetlenir
const SPLIT_RUN = /(?<![\p{L}\p{N}])(?:[\p{L}\p{N}@$][\s._\-*,'"|/\\]+){2,}[\p{L}\p{N}@$](?![\p{L}\p{N}])/gu;

// Metindeki yasaklı kelimeleri yıldızlar
async function maskBannedWords(text) {
  if (!text) return text;
  const extras = await loadExtraWords();
  const masked = text.replace(SPLIT_RUN, (run) => {
    const joined = run.replace(/[^\p{L}\p{N}@$]/gu, '');
    return isBanned(joined, extras) ? run.replace(/[\p{L}\p{N}@$]/gu, (ch, i) => (i === 0 ? ch : '*')) : run;
  });
  // Unicode harf ve rakam dizileri (ayrıca @ ve $ leet harfleri) kelime sayılır
  return masked.replace(/[\p{L}\p{N}@$]+/gu, (w) => (isBanned(w, extras) ? w[0] + '*'.repeat(w.length - 1) : w));
}

// Ad soyad ve benzeri görünen isimler: küfür ya da cinsel içerik varsa reddedilir
// (yıldızlanmaz; isim herkese görünür ve sonradan değiştirilemez)
const NAME_BLOCKLIST = /(seks|sex|porn|porno|escort|eskort|fahişe|fahise|sikiş|sikis|nude|onlyfans|xxx|azgın|azgin|ateşli|atesli)/;
async function checkDisplayName(name) {
  if (typeof name !== 'string' || !name.trim()) return { error: 'İsim gerekli.' };
  const extras = await loadExtraWords();
  const words = name.match(/[\p{L}\p{N}@$]+/gu) || [];
  const flat = fold(normalizeWord(name.replace(/[^\p{L}\p{N}@$]/gu, '')));
  if (words.some((w) => isBanned(w, extras)) || isBanned(name.replace(/[^\p{L}\p{N}@$]/gu, ''), extras) || NAME_BLOCKLIST.test(flat)) {
    return { error: 'Bu isim kullanılamaz. Lütfen gerçek adını ve soyadını yaz.' };
  }
  if (/\d/.test(name) || /https?:|www\.|@/.test(name)) return { error: 'İsimde rakam, bağlantı ya da @ kullanılamaz.' };
  return { value: name };
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

module.exports = { LIMITS, DEFAULT_ROOTS, cleanUserText, maskBannedWords, checkDisplayName, invalidateBannedWords, normalizeWord };
