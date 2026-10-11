// Sitenin yayındaki adresi ve iletişim bilgileri tek yerden yönetilir.
// Alan adını aldığında derleme ortamına (client/.env ya da Railway > Variables)
// VITE_SITE_URL ve VITE_CONTACT_EMAIL yaz. index.html, robots.txt ve
// sitemap.xml içindeki adres derlemede otomatik güncellenir (vite.config.js).
export const SITE = {
  name: 'kampüs·',
  url: import.meta.env.VITE_SITE_URL || 'https://kampusplus.app',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'destek@kampusplus.app',
};
