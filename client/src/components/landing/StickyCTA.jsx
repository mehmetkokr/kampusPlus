import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n';

// Telefonda sabit alt çağrı: üstteki "Ücretsiz katıl" düğmesi ekrandan çıkınca
// alttan kayarak gelir; sayfanın sonundaki kayıt bölümüne gelince gizlenir
// (aynı çağrı iki kez görünmesin). Masaüstünde gösterilmez.
export default function StickyCTA() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      const pastHero = window.scrollY > window.innerHeight * 0.8;
      const nearEnd = window.innerHeight + window.scrollY > document.body.scrollHeight - 520;
      setShow(pastHero && !nearEnd);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`landing-sticky-cta md:hidden ${show ? 'is-visible' : ''}`} aria-hidden={!show}>
      <div className="landing-sticky-inner">
        <span className="landing-sticky-text">
          <strong>{t('Kampüsün seni bekliyor')}</strong>
          <span>{t('Okul e-postanla 1 dakikada katıl')}</span>
        </span>
        <Link to="/register" className="landing-btn-primary landing-btn-sm" tabIndex={show ? 0 : -1}>
          {t('Ücretsiz katıl')} <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
