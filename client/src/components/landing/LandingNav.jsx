import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#ozellikler', label: 'Özellikler' },
  { href: '#guvenlik', label: 'Güvenlik' },
  { href: '#nasil-calisir', label: 'Nasıl Çalışır' },
  { href: '#sss', label: 'SSS' },
];

export default function LandingNav() {
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
              ? 'border-line-soft bg-surface/75 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.6)]'
              : 'border-transparent bg-surface/25'
          }`}
        >
          <Link to="/" className="font-display text-xl font-bold tracking-tight text-paper">
            kampüs<span className="text-amber">·</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-paper-muted transition-colors hover:bg-white/5 hover:text-paper"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-full px-4 py-2 text-[13.5px] font-semibold text-paper-muted transition-colors hover:text-paper"
            >
              Giriş Yap
            </Link>
            <Link
              to="/register"
              className="rounded-full bg-amber px-4 py-2 text-[13.5px] font-bold text-ink transition-transform hover:scale-[1.03] hover:bg-amber-soft active:scale-[0.98]"
            >
              Hesap Oluştur
            </Link>
          </div>

          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-paper md:hidden"
            aria-label="Menüyü aç/kapat"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
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
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-paper-muted hover:bg-white/5 hover:text-paper"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="mt-1 flex gap-2 border-t border-line-soft pt-3">
                  <Link
                    to="/login"
                    className="flex-1 rounded-full border border-line py-2.5 text-center text-sm font-semibold text-paper"
                  >
                    Giriş Yap
                  </Link>
                  <Link
                    to="/register"
                    className="flex-1 rounded-full bg-amber py-2.5 text-center text-sm font-bold text-ink"
                  >
                    Hesap Oluştur
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
