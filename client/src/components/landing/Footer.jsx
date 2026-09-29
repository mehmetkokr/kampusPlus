import { Link } from 'react-router-dom';
import { AtSign, Globe, Mail } from 'lucide-react';

const COLUMNS = [
  {
    title: 'Şirket',
    links: [
      { label: 'Hakkımızda', href: '#' },
      { label: 'Kariyer', href: '#' },
      { label: 'Basın', href: '#' },
    ],
  },
  {
    title: 'Kurallar',
    links: [
      { label: 'Gizlilik Politikası', href: '#' },
      { label: 'Kullanım Şartları', href: '#' },
      { label: 'Topluluk Kuralları', href: '#' },
    ],
  },
  {
    title: 'Destek',
    links: [
      { label: 'Yardım Merkezi', href: '#' },
      { label: 'Şikayet Bildir', href: '#' },
      { label: 'İletişim', href: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-line-soft px-4 pb-10 pt-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Link to="/" className="font-display text-xl font-bold text-paper">
              kampüs<span className="text-amber">·</span>
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-paper-muted">
              Yalnızca doğrulanmış üniversite öğrencileri için kapalı bir kampüs topluluğu.
            </p>
            <div className="mt-5 flex gap-3">
              <a href="#" aria-label="Instagram" className="rounded-full border border-line p-2 text-paper-muted transition-colors hover:text-paper">
                <AtSign size={16} />
              </a>
              <a href="#" aria-label="Topluluk sitesi" className="rounded-full border border-line p-2 text-paper-muted transition-colors hover:text-paper">
                <Globe size={16} />
              </a>
              <a href="mailto:merhaba@kampus.app" aria-label="E-posta" className="rounded-full border border-line p-2 text-paper-muted transition-colors hover:text-paper">
                <Mail size={16} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-bold uppercase tracking-[0.1em] text-paper-faint">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-[13.5px] text-paper-muted transition-colors hover:text-paper">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-line-soft pt-6 text-[12px] text-paper-faint sm:flex-row">
          <p>© {new Date().getFullYear()} kampüs·. Tüm hakları saklıdır.</p>
          <p>Üniversite öğrencileri için, öğrenciler tarafından tasarlandı.</p>
        </div>
      </div>
    </footer>
  );
}
