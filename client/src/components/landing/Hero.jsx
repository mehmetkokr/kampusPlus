import { Suspense, lazy, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CheckCircle2, LogIn, ShieldCheck, Smartphone, Sparkles, UserPlus } from 'lucide-react';
import api from '../../api';
import CampusSky from '../CampusSky';
import PhoneMockup from './PhoneMockup';
import UniversityMarquee from './UniversityMarquee';
import { useI18n } from '../../i18n';
import { useDeferredWebGL } from '../../utils/webgl';

// three.js yalnızca WebGL destekleyen tarayıcıda, sayfa çizildikten sonra yüklenir
const HeroGradient = lazy(() => import('./HeroGradient'));

// Ortalanmış, sade hero: büyük serif başlık, kısa açıklama, gerçek bir güven
// satırı (sistemin tanıdığı üniversite sayısı) ve iki büyük düğme. Mağaza
// uygulamaları henüz olmadığı için sahte mağaza düğmesi yok; aynı biçimde
// "Ücretsiz katıl" / "Giriş yap" var ve altında dürüst bir "yakında" notu.
const ROTATING = ['ders arkadaşını', 'kulübünü', 'yeni arkadaşlarını', 'kahve arkadaşını'];
const EASE = [0.16, 1, 0.3, 1];

function RotatingWord() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % ROTATING.length), 2600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <span className="relative inline-grid align-bottom" aria-live="polite">
      {/* Genişlik en uzun kelimeye göre sabit: satır zıplamasın */}
      {ROTATING.map((w) => (
        <span key={w} className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden="true">
          {t(w)}
        </span>
      ))}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ROTATING[index]}
          className="landing-gradient-text col-start-1 row-start-1 whitespace-nowrap"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '0.35em' }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: '-0.35em' }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {t(ROTATING[index])}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function FloatingChip({ className, delay, icon: Icon, tone, title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={`pointer-events-none absolute z-20 hidden xl:block ${className}`}
    >
      <div className="landing-float landing-chip flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ animationDelay: `${delay}s` }}>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <p className="text-[0.75rem] font-semibold text-paper">{title}</p>
          {subtitle && <p className="text-[0.6875rem] text-paper-muted">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

export default function Hero() {
  const { t } = useI18n();
  const [uniCount, setUniCount] = useState(null);

  // Gerçek sayı: e-posta alan adını tanıdığımız üniversiteler
  useEffect(() => {
    api
      .get('/universities')
      .then((res) => setUniCount(Array.isArray(res.data) ? res.data.length : null))
      .catch(() => {});
  }, []);

  const webgl = useDeferredWebGL();

  const fade = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  });

  // Geniş ekranda iki sütun: solda başlık ve düğmeler (ilk ekranda görünür),
  // sağda canlı telefon. Telefonda tek sütun, düğmeler telefondan önce.
  return (
    <section className="landing-hero-bg relative isolate overflow-hidden pb-10 pt-24 sm:pb-16 sm:pt-28 lg:pt-28">
      {webgl && (
        <Suspense fallback={null}>
          <HeroGradient />
        </Suspense>
      )}
      <CampusSky variant="landing" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8 lg:px-8">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <motion.div
            {...fade(0)}
            className="landing-chip inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold text-paper"
          >
            <span className="relative flex h-2 w-2">
              <span className="landing-ping absolute inline-flex h-full w-full rounded-full bg-teal" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            {t('Yalnızca doğrulanmış üniversite öğrencileri')}
          </motion.div>

          <motion.h1 {...fade(0.06)} className="landing-h1 landing-h1-hero mt-6">
            {t('Kampüsünde')}
            <br />
            <RotatingWord />
            <br />
            {t('bul.')}
          </motion.h1>

          <motion.p {...fade(0.14)} className="mt-5 max-w-[32rem] text-[1.0625rem] leading-relaxed text-paper-muted sm:text-[1.125rem]">
            {t('Okul e-postanla doğrulanan, seni kendi kampüsündeki öğrencilerle buluşturan kapalı bir topluluk. Sahte hesap yok, reklam yok. Sadece gerçek öğrenciler.')}
          </motion.p>

          <motion.div {...fade(0.2)} className="mt-7 grid w-full max-w-[24rem] gap-3 sm:max-w-[30rem] sm:grid-cols-2">
            <Link to="/register" className="landing-btn-primary landing-btn-store group">
              <UserPlus size={22} strokeWidth={2} />
              <span className="label">
                <small>{t('Ücretsiz')}</small>
                <strong>{t('Hemen katıl')}</strong>
              </span>
              <ArrowRight size={18} className="end transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link to="/login" className="landing-btn-secondary landing-btn-store">
              <LogIn size={20} strokeWidth={2} />
              <span className="label">
                <small>{t('Hesabın var mı?')}</small>
                <strong>{t('Giriş yap')}</strong>
              </span>
            </Link>
          </motion.div>

          <motion.p {...fade(0.26)} className="mt-5 text-[0.9375rem] font-semibold text-paper">
            <CheckCircle2 size={18} className="mr-1.5 inline-block align-[-4px] text-teal" strokeWidth={2.4} />
            {uniCount
              ? t('{n} üniversitenin öğrenci e-postasıyla çalışır', { n: uniCount })
              : t('Türkiye üniversitelerinin öğrenci e-postalarıyla çalışır')}
          </motion.p>
          <motion.p {...fade(0.3)} className="mt-2 max-w-[24rem] text-[0.8125rem] leading-relaxed text-paper-faint">
            <Smartphone size={14} className="mr-1 inline-block align-[-2px]" />
            {t('iOS ve Android uygulamaları yakında · şimdilik tarayıcından kullan')}
          </motion.p>
        </div>

        {/* Canlı telefon. Yüzen kartlar yalnızca çok geniş ekranda, telefonun dışında */}
        <div className="relative w-full">
          <PhoneMockup />
          <FloatingChip className="-left-14 top-20" delay={0.6} icon={ShieldCheck} tone="bg-amber-dim text-amber" title={t('Doğrulandı')} subtitle="elif@itu.edu.tr" />
          <FloatingChip className="-right-14 top-56" delay={0.8} icon={Sparkles} tone="bg-teal-dim text-teal" title={t('Yeni eşleşme!')} subtitle={t('Sohbet başlat')} />
        </div>
      </div>

      <div className="relative mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <UniversityMarquee />
      </div>
    </section>
  );
}
