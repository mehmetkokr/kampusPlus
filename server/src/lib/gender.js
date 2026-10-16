// Cinsiyet ve Kart Modu eşleştirme kuralı.
// Kadınlara erkekler, erkeklere kadınlar gösterilir. Cinsiyetini belirtmek
// istemeyenler (ve henüz seçmemiş eski hesaplar) herkesin destesinde karışık
// görünür, kendileri de herkesi görür. Cinsiyet profilde gösterilmez.
const GENDERS = ['female', 'male', 'unspecified'];

const OPPOSITE = { female: 'male', male: 'female' };

// İzleyicinin destesine girebilecek adaylar için Prisma koşulu (null = sınır yok)
function deckGenderWhere(viewerGender) {
  const want = OPPOSITE[viewerGender];
  if (!want) return null;
  return { OR: [{ gender: want }, { gender: 'unspecified' }, { gender: null }] };
}

module.exports = { GENDERS, deckGenderWhere };
