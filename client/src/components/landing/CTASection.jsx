import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';

// Sayfa sonu çağrısı: açık sayfada koyu, sakin bir kart (uygulamanın kendi rengi)
export default function CTASection() {
  const { t } = useI18n();
  return (
    <section className="relative px-4 py-20 sm:px-6">
      <Reveal className="landing-dark relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-surface px-6 py-20 text-center shadow-[0_40px_90px_-45px_rgba(22,18,14,0.8)] sm:px-10 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(10,132,255,0.18)_0%,transparent_70%)]"
          aria-hidden="true"
        />
        <h2 className="landing-h2 relative mx-auto max-w-2xl">
          {t("Kampüsünde seni bekleyen")} <span className="landing-gradient-text">{t("biri var.")}</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted">
          {t("Okul e-postanla kaydol, doğrulamanı tamamla ve keşfetmeye başla. Ücretsiz.")}
        </p>
        <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register" className="landing-btn-primary group w-full sm:w-auto">
            {t("Ücretsiz katıl")}
            <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link to="/login" className="landing-btn-secondary w-full sm:w-auto">
            {t("Zaten hesabım var")}
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
