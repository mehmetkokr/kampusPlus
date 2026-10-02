// Profildeki ilgi alanı ve hobi seçenekleri. Kullanıcı yazmak yerine bu
// listeden seçer; değerler eskisi gibi virgülle ayrılmış tek bir metin olarak
// saklanır (User.interests / User.hobbies), böylece eski kayıtlar da çalışır.
export const INTEREST_OPTIONS = [
  'Teknoloji', 'Yazılım', 'Yapay Zekâ', 'Girişimcilik', 'Bilim', 'Astronomi',
  'Tarih', 'Felsefe', 'Psikoloji', 'Edebiyat', 'Sinema', 'Dizi',
  'Müzik', 'Sanat', 'Tasarım', 'Moda', 'Fotoğrafçılık', 'Oyun',
  'Anime', 'Spor', 'Futbol', 'Basketbol', 'Voleybol', 'Fitness',
  'Doğa', 'Seyahat', 'Yemek', 'Kahve', 'Hayvanlar', 'Gönüllülük',
  'Ekonomi', 'Siyaset', 'Dil Öğrenme', 'Çevre',
];

export const HOBBY_OPTIONS = [
  'Kitap Okumak', 'Yürüyüş', 'Koşu', 'Bisiklet', 'Yüzme', 'Kamp',
  'Dağcılık', 'Satranç', 'Kutu Oyunları', 'Video Oyunları', 'Gitar', 'Piyano',
  'Şarkı Söylemek', 'Dans', 'Resim', 'Çizim', 'Fotoğraf Çekmek', 'Video Çekmek',
  'Yemek Yapmak', 'Tatlı Yapmak', 'Kahve Demlemek', 'Bahçecilik', 'El İşi', 'Örgü',
  'Yoga', 'Meditasyon', 'Fitness', 'Futbol Oynamak', 'Basketbol Oynamak', 'Masa Tenisi',
  'Konser', 'Tiyatro', 'Sinema', 'Podcast', 'Blog Yazmak', 'Kodlama',
  'Gezmek', 'Dil Öğrenmek',
];

export const MAX_TAGS = 10;

export function parseTags(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
