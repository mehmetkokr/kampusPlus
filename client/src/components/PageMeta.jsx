import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import { SITE } from '../constants/site';

// Her sayfaya kendi başlığını ve açıklamasını verir; arama motorlarına yalnızca
// herkese açık sayfaları (tanıtım, kayıt, yasal sayfalar) gösterir. Oturum
// gerektiren uygulama sayfaları ve 404 "noindex" olarak işaretlenir.
const DEFAULT_DESC =
  'kampüs·, yalnızca üniversite e-postanla doğruladığın, kendi okulundaki öğrencilerle seni buluşturan kapalı bir kampüs topluluğudur.';

const PUBLIC = {
  '/': { title: 'kampüs· — Doğrulanmış Üniversite Topluluğu', desc: DEFAULT_DESC, full: true },
  '/register': { title: 'Kayıt Ol', desc: 'Üniversite e-postanla ücretsiz kayıt ol, kampüsündeki öğrencilerle tanış.' },
  '/login': { title: 'Giriş Yap', desc: 'kampüs· hesabına giriş yap.' },
  '/forgot-password': { title: 'Şifremi Unuttum', desc: 'kampüs· şifreni sıfırla.' },
  '/gizlilik': { title: 'Gizlilik Politikası', desc: 'kampüs· kişisel verilerini nasıl işler? KVKK aydınlatma metni.' },
  '/kullanim-sartlari': { title: 'Kullanım Şartları', desc: 'kampüs· kullanım şartları.' },
  '/topluluk-kurallari': { title: 'Topluluk Kuralları', desc: 'kampüs· topluluğunu güvenli tutan kurallar.' },
};

const PRIVATE = [
  ['/discover/swipe', 'Kart Modu'],
  ['/discover', 'Keşfet'],
  ['/feed', 'Akış'],
  ['/clubs', 'Kulüpler'],
  ['/matches', 'Sohbet'],
  ['/chat', 'Sohbet'],
  ['/profile', 'Profilim'],
  ['/settings', 'Ayarlar'],
  ['/notifications', 'Bildirimler'],
  ['/users', 'Profil'],
  ['/welcome', 'Hoş geldin'],
  ['/admin', 'Admin Paneli'],
  ['/reset-password', 'Yeni Şifre Belirle'],
];

function setMeta(selector, attr, key, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function PageMeta() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    const pub = PUBLIC[pathname];
    const priv = !pub && PRIVATE.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'));
    const name = pub ? t(pub.title) : priv ? t(priv[1]) : t('Sayfa bulunamadı');
    const title = pub?.full ? name : `${name} · ${SITE.name}`;
    const desc = pub ? t(pub.desc) : t(DEFAULT_DESC);

    document.title = title;
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[name="robots"]', 'name', 'robots', pub ? 'index, follow' : 'noindex, nofollow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:url"]', 'property', 'og:url', SITE.url + pathname);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = SITE.url + (pub ? pathname : '/');
  }, [pathname, t]);

  return null;
}
