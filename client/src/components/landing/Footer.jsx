import { Link } from 'react-router-dom';
import { GithubLogo, Mail } from '../icons';
import { useI18n } from '../../i18n';
import { SITE } from '../../constants/site';

// İç bağlantılar: her bağlantı gerçek bir sayfaya ya da sayfa bölümüne gider.
// "to" uygulama içi sayfa, "href" aynı sayfadaki bölüm ya da e-posta.
const COLUMNS = [
  {
    title: 'Ürün',
    links: [
      { label: 'Özellikler', href: '#ozellikler' },
      { label: 'Nasıl Çalışır', href: '#nasil-calisir' },
      { label: 'Güvenlik', href: '#guvenlik' },
      { label: 'Ücretsiz katıl', to: '/register' },
    ],
  },
  {
    title: 'Kurallar',
    links: [
      { label: 'Gizlilik Politikası', to: '/gizlilik' },
      { label: 'Kullanım Şartları', to: '/kullanim-sartlari' },
      { label: 'Topluluk Kuralları', to: '/topluluk-kurallari' },
      { label: 'Mesafeli Satış Sözleşmesi', to: '/mesafeli-satis-sozlesmesi' },
    ],
  },
  {
    title: 'Destek',
    links: [
      { label: 'SSS', href: '#sss' },
      { label: 'Şikayet Bildir', to: '/topluluk-kurallari' },
      { label: 'İletişim', href: '#iletisim' },
    ],
  },
];

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="relative border-t border-line-soft px-4 pb-10 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Link to="/" className="font-display text-xl font-bold text-paper">
              {t("kampüs")}<span className="text-brand">+</span>
            </Link>
            <p className="mt-3 max-w-xs text-[0.8125rem] leading-relaxed text-paper-muted">
              {t("Yalnızca doğrulanmış üniversite öğrencileri için kapalı bir kampüs topluluğu.")}
            </p>
            {/* Bize ulaş: e-posta adresi ve GitHub açıkça yazılı (yalnızca simge değil) */}
            <ul id="iletisim" className="mt-6 space-y-2.5 scroll-mt-24" aria-label={t('Bize ulaş')}>
              <li>
                <a href={`mailto:${SITE.contactEmail}`} className="landing-contact-link">
                  <span className="landing-contact-icon" aria-hidden="true">
                    <Mail size={16} />
                  </span>
                  {SITE.contactEmail}
                </a>
              </li>
              <li>
                <a href={SITE.github} target="_blank" rel="noopener noreferrer" className="landing-contact-link">
                  <span className="landing-contact-icon" aria-hidden="true">
                    <GithubLogo size={16} />
                  </span>
                  {SITE.github.replace(/^https?:\/\//, '')}
                </a>
              </li>
            </ul>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-paper-faint">{t(col.title)}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.to ? (
                      <Link to={l.to} className="text-[0.8438rem] text-paper-muted transition-colors hover:text-paper">
                        {t(l.label)}
                      </Link>
                    ) : (
                      <a href={l.href} className="text-[0.8438rem] text-paper-muted transition-colors hover:text-paper">
                        {t(l.label)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-line-soft pt-6 text-[0.75rem] text-paper-faint sm:flex-row">
          <p>© {new Date().getFullYear()} {t("kampüs+. Tüm hakları saklıdır.")}</p>
          <p>{t("Üniversite öğrencileri için, öğrenciler tarafından tasarlandı.")}</p>
        </div>
      </div>
    </footer>
  );
}
