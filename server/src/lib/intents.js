// "Ne arıyorsun?" seçeneklerinin geçerli değerleri. İstemcideki karşılığı:
// client/src/constants/intents.js (etiketler ve renkler orada).
const ALLOWED_INTENTS = [
  'friendship',
  'coffee',
  'study',
  'event',
  'club',
  'sports',
  'project',
  'language',
  'travel',
  'roommate',
  'dating',
  'relationship',
];

// Flört modu: bu iki seçenek kişinin kendi açtığı bir mod gibi çalışır.
// Yalnızca kendisi de bunlardan birini seçmiş öğrencilere görünür; arkadaşlık
// ya da ders arkadaşı arayanlar flört arayanların bu tercihini görmez.
const DATING_INTENTS = ['dating', 'relationship'];

function parseIntents(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function wantsDating(intentValue) {
  return parseIntents(intentValue).some((i) => DATING_INTENTS.includes(i));
}

// Başkasına gösterilecek intent metni: izleyici flört modunda değilse flört
// seçenekleri çıkarılır. Geriye bir şey kalmazsa null döner.
function visibleIntentFor(ownerIntent, viewerIntent) {
  const own = parseIntents(ownerIntent);
  const shown = wantsDating(viewerIntent) ? own : own.filter((i) => !DATING_INTENTS.includes(i));
  return shown.length ? shown.join(',') : null;
}

module.exports = { ALLOWED_INTENTS, DATING_INTENTS, parseIntents, wantsDating, visibleIntentFor };
