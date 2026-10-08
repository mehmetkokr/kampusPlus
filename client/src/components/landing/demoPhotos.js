// Tanıtım sayfasındaki örnek profillerin fotoğrafları. Hepsi Unsplash
// lisansıyla (ticari kullanım dahil ücretsiz) paylaşılmış portrelerdir;
// isimler ve profil bilgileri uydurmadır, fotoğraftaki kişilerle ilgisi yoktur.
// Görseller Unsplash'in kendi CDN'inden istenen boyutta gelir.
export const DEMO_PHOTOS = {
  // Gündelik ortamda (kafe, kampüs, sokak) çekilmiş doğal fotoğraflar
  can: 'photo-1583692331507-fc0bd348695d', // Duman Photography
  elif: 'photo-1642232173026-241dcd495511', // Rendy Novantino
  deniz: 'photo-1790475191234-a03652e4c975', // Olek Buzunov
  mert: 'photo-1664871475935-39a9b861514f', // Mohammad Mardani
  zeynep: 'photo-1760551937527-2bc6cfe45180', // amin naderloei
  emre: 'photo-1674453822926-2832b17660ad', // The Mahendra Singh Lodhi
  selin: 'photo-1507914464562-6ff4ac29692f', // Brooke Cagle
  baris: 'photo-1621960883434-e910537c8052', // Assad Tanoli
  kerem: 'photo-1665587168369-13b83852d487', // OMAR JAMIL
  ece: 'photo-1604681630513-69474a4e253f', // AYKUT AKTAŞ
  ayse: 'photo-1676792737727-a1fad26dc696', // Hananeh Reisi
  // Akış ve profil galerisindeki manzaralar
  campus: 'photo-1699155759495-855eaf21cfde', // note thanun
  coffee: 'photo-1782532618064-f534ae203557', // Irwan
  chess: 'photo-1674208732345-3feee91806ac', // Elliot Zhang
  hike: 'photo-1726091983472-a7da2540c492', // Noah Master
};

// Ekrandaki boyutun iki katı (retina) istenir; yüzler kırpmada ortada kalır
export function demoPhoto(key, w, h = w) {
  const id = DEMO_PHOTOS[key];
  if (!id) return null;
  return `https://images.unsplash.com/${id}?w=${Math.round(w * 2)}&h=${Math.round(h * 2)}&fit=crop&crop=faces&auto=format&q=70`;
}
