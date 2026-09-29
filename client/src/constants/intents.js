// "Ne arıyorsun?" seçenekleri — kullanıcı birden fazlasını seçebilir.
// Değerler backend'de virgülle ayrılmış tek bir string olarak saklanır (User.intent).
export const INTENT_OPTIONS = [
  { value: 'friendship', label: 'Arkadaşlık', chipClass: 'friendship' },
  { value: 'dating', label: 'Flört', chipClass: 'dating' },
  { value: 'study', label: 'Çalışma Arkadaşı', chipClass: 'study' },
  { value: 'event', label: 'Etkinlik Arkadaşı', chipClass: 'event' },
  { value: 'club', label: 'Kulüp Arkadaşı', chipClass: 'club' },
];

export const INTENT_LABEL = Object.fromEntries(INTENT_OPTIONS.map((o) => [o.value, o.label]));
export const INTENT_CHIP_CLASS = Object.fromEntries(INTENT_OPTIONS.map((o) => [o.value, o.chipClass]));

export function parseIntents(intentString) {
  return (intentString || 'friendship')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
