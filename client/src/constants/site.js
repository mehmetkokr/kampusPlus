// Sitenin yayındaki adresi ve iletişim bilgileri tek yerden yönetilir.
// Alan adını aldığında derleme ortamına (client/.env ya da Railway > Variables)
// VITE_SITE_URL ve VITE_CONTACT_EMAIL yaz. index.html, robots.txt ve
// sitemap.xml içindeki adres derlemede otomatik güncellenir (vite.config.js).
//
// Yayında sunucu sayfadaki canonical adresi gerçek adresle yazar
// (server/src/lib/seo.js); arayüz de aynı adresi kullanır ki canonical ve
// og:url sayfa açıldıktan sonra başka bir alan adına dönmesin.
function initialSiteUrl() {
  try {
    const href = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
    if (href) return new URL(href, window.location.href).origin;
  } catch {
    // tarayıcı dışı ortam (testler)
  }
  return import.meta.env.VITE_SITE_URL || 'https://kampusplus.com.tr';
}

export const SITE = {
  name: 'kampüs·',
  url: initialSiteUrl(),
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'destek@kampusplus.com.tr',
};
