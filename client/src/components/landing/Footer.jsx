import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
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
    ],
  },
  {
    title: 'Destek',
    links: [
      { label: 'SSS', href: '#sss' },
      { label: 'Şikayet Bildir', to: '/topluluk-kurallari' },
      { label: 'İletişim', href: 'mailto:' + SITE.contactEmail },
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
              {t("kampüs")}<span className="text-amber">·</span>
            </Link>
            <p className="mt-3 max-w-xs text-[0.8125rem] leading-relaxed text-paper-muted">
              {t("Yalnızca doğrulanmış üniversite öğrencileri için kapalı bir kampüs topluluğu.")}
            </p>
            <div className="mt-5 flex gap-3">
              <a href={`mailto:${SITE.contactEmail}`} aria-label={t("E-posta")} className="rounded-full border border-line p-2 text-paper-muted transition-colors hover:text-paper">
                <Mail size={16} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-paper-faint">{t(col.title)}</h4>
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
          <p>© {new Date().getFullYear()} {t("kampüs·. Tüm hakları saklıdır.")}</p>
          <p>{t("Üniversite öğrencileri için, öğrenciler tarafından tasarlandı.")}</p>
        </div>
      </div>
    </footer>
  );
}
