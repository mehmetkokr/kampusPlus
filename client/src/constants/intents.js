// "Ne arıyorsun?" seçenekleri — kullanıcı birden fazlasını seçebilir.
// Değerler backend'de virgülle ayrılmış tek bir string olarak saklanır (User.intent).
// Yeni değer eklerken server/src/lib/intents.js'teki listeye de ekle.
// chipClass yalnızca renk tonunu belirler (index.css .intent-chip.*).
export const INTENT_OPTIONS = [
  { value: 'friendship', label: 'Arkadaşlık', chipClass: 'friendship' },
  { value: 'coffee', label: 'Bir Kahve', chipClass: 'study' },
  { value: 'study', label: 'Çalışma Arkadaşı', chipClass: 'study' },
  { value: 'event', label: 'Etkinlik Arkadaşı', chipClass: 'event' },
  { value: 'club', label: 'Kulüp Arkadaşı', chipClass: 'club' },
  { value: 'sports', label: 'Spor Arkadaşı', chipClass: 'friendship' },
  { value: 'project', label: 'Proje Ortağı', chipClass: 'event' },
  { value: 'language', label: 'Dil Pratiği', chipClass: 'club' },
  { value: 'travel', label: 'Gezi Arkadaşı', chipClass: 'event' },
  { value: 'roommate', label: 'Ev Arkadaşı', chipClass: 'club' },
  { value: 'dating', label: 'Flört', chipClass: 'dating' },
  { value: 'relationship', label: 'Uzun Süreli İlişki', chipClass: 'dating' },
];

export const INTENT_LABEL = Object.fromEntries(INTENT_OPTIONS.map((o) => [o.value, o.label]));
export const INTENT_CHIP_CLASS = Object.fromEntries(INTENT_OPTIONS.map((o) => [o.value, o.chipClass]));

export function parseIntents(intentString) {
  // Boş/gizli (ör. flört tercihi izleyiciye gösterilmeyen) değerde hiçbir şey gösterilmez
  return (intentString || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
