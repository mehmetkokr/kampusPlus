// Tanıtım sayfasındaki örnek profillerin fotoğrafları. Hepsi Unsplash
// lisansıyla (ticari kullanım dahil ücretsiz) paylaşılmış portrelerdir;
// isimler ve profil bilgileri uydurmadır, fotoğraftaki kişilerle ilgisi yoktur.
// Görseller Unsplash'in kendi CDN'inden istenen boyutta gelir.
export const DEMO_PHOTOS = {
  can: 'photo-1600603406200-5b2a104684ac', // Vicky Hladynets
  elif: 'photo-1723189038268-3ef8fd518ad9', // Tim Bernhard
  deniz: 'photo-1612203304476-2ed23c55b5b9', // HamZa NOUASRIA
  mert: 'photo-1628619487925-e9b8fc4c6b08', // Akshar Dave
  zeynep: 'photo-1594756154841-ac5d160dbf46', // Megan Bucknall
  emre: 'photo-1619011940610-eda7c2ab3477', // Mike van den Bos
  selin: 'photo-1662850886700-4ec19bd30d11', // Nolan Manning
  baris: 'photo-1761126280438-1d7bd360ad34', // Nadeem Choudhary
  kerem: 'photo-1763849049538-5ec4a2729c5d', // Marina Nazina
  ece: 'photo-1578933301026-3e5e901126dc', // Philipp Lansing
  ayse: 'photo-1607569708758-0270aa4651bd', // Meg Wagener
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
