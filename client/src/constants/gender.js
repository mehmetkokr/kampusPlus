// Cinsiyet seçenekleri (Kart Modu eşleştirmesi; profilde görünmez).
// Kural: server/src/lib/gender.js
export const GENDER_OPTIONS = [
  { value: 'female', label: 'Kadın' },
  { value: 'male', label: 'Erkek' },
  { value: 'unspecified', label: 'Belirtmek istemiyorum' },
];

export const GENDER_HINT = 'Kart Modu’nda kadınlara erkekler, erkeklere kadınlar gösterilir. Belirtmezsen herkesle karışık eşleşirsin. Profilinde görünmez.';
