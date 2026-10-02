// Sitenin yayındaki adresi ve iletişim bilgileri tek yerden yönetilir.
// Alan adını aldığında client/.env dosyasına VITE_SITE_URL ve
// VITE_CONTACT_EMAIL yaz; ayrıca public/robots.txt ve public/sitemap.xml
// içindeki adresi de güncelle (statik dosyalar ortam değişkeni okuyamaz).
export const SITE = {
  name: 'kampüs·',
  url: import.meta.env.VITE_SITE_URL || 'https://kampusplus.app',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'destek@kampusplus.app',
};
