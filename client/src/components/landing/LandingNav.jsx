import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Menu, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import ThemeToggle from '../ThemeToggle';

const LINKS = [
  { href: '#nasil-calisir', label: 'Nasıl Çalışır' },
  { href: '#ozellikler', label: 'Özellikler' },
  { href: '#kulupler', label: 'Kulüpler' },
  { href: '#guvenlik', label: 'Güvenlik' },
  { href: '#sss', label: 'SSS' },
];

// Dil düğmesi: tek dokunuşla TR ⇄ EN. Seçim tarayıcıda hatırlanır ve kayıt
// olunduğunda hesabın dil tercihi olarak da kullanılır.
function LangSwitch() {
  const { lang, setLang } = useI18n();
  const next = lang === 'en' ? 'tr' : 'en';
  return (
    <button
      type="button"
      onClick={() => setLang(next)}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold text-paper-muted transition-colors hover:bg-black/5 hover:text-paper"
      aria-label={next === 'en' ? 'Switch to English' : "Türkçe'ye geç"}
      lang={next}
    >
      <Globe size={15} aria-hidden="true" />
      {next.toUpperCase()}
    </button>
  );
}

export default function LandingNav() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-2' : 'py-4'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4">
        <div
          className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 backdrop-blur-xl transition-all duration-300 sm:px-5 ${
            scrolled
              ? 'border-line-soft bg-surface/80 shadow-[0_10px_40px_-20px_rgba(40,28,15,0.35)]'
              : 'border-transparent bg-transparent'
          }`}
        >
          <Link to="/" className="inline-flex min-h-11 items-center text-xl font-bold tracking-[-0.03em] text-paper">
            {t("kampüs")}<span className="text-amber">·</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="inline-flex min-h-11 items-center rounded-full px-3.5 text-[0.8438rem] font-medium text-paper-muted transition-colors hover:bg-black/5 hover:text-paper"
              >
                {t(l.label)}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle className="landing-theme-toggle" />
            <LangSwitch />
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.8438rem] font-semibold text-paper-muted transition-colors hover:text-paper"
            >
              {t("Giriş Yap")}
            </Link>
            <Link
              to="/register"
              className="landing-btn-primary landing-btn-sm"
            >
              {t("Ücretsiz katıl")}
            </Link>
          </div>

          <div className="flex items-center md:hidden">
          <ThemeToggle className="landing-theme-toggle" />
            <LangSwitch />
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-paper"
            aria-label={t("Menüyü aç/kapat")}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden md:hidden"
            >
              <div className="mt-2 flex flex-col gap-1 rounded-2xl border border-line-soft bg-surface/90 p-3 backdrop-blur-xl">
                {LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-paper-muted hover:bg-black/5 hover:text-paper"
                  >
                    {t(l.label)}
                  </a>
                ))}
                <div className="mt-1 flex gap-2 border-t border-line-soft pt-3">
                  <Link
                    to="/login"
                    className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-line text-center text-sm font-semibold text-paper"
                  >
                    {t("Giriş Yap")}
                  </Link>
                  <Link
                    to="/register"
                    className="landing-btn-primary landing-btn-sm flex-1"
                  >
                    {t("Ücretsiz katıl")}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
