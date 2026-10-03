import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, BadgeCheck, CheckCircle2, Heart, LogIn, ShieldCheck, Smartphone, Sparkles, UserPlus } from 'lucide-react';
import api from '../../api';
import CampusSky from '../CampusSky';
import PhoneMockup from './PhoneMockup';
import UniversityMarquee from './UniversityMarquee';
import { useI18n } from '../../i18n';

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
      className={`pointer-events-none absolute z-20 hidden lg:block ${className}`}
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

  const fade = (delay) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  });

  return (
    <section className="landing-hero-bg relative isolate overflow-hidden pb-12 pt-28 sm:pb-20 sm:pt-36">
      <CampusSky variant="landing" />
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 text-center">
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

        <motion.h1 {...fade(0.06)} className="landing-h1 mt-7">
          {t('Kampüsünde')}
          <br />
          <RotatingWord />
          <br />
          {t('bul.')}
        </motion.h1>

        <motion.p {...fade(0.14)} className="mt-6 max-w-[32rem] text-[1.125rem] leading-relaxed text-paper-muted">
          {t('Okul e-postanla doğrulanan, seni kendi kampüsündeki öğrencilerle buluşturan kapalı bir topluluk. Sahte hesap yok, reklam yok. Sadece gerçek öğrenciler.')}
        </motion.p>

        <motion.p {...fade(0.2)} className="mt-6 text-[0.9375rem] font-semibold text-paper">
          <CheckCircle2 size={19} className="mr-1.5 inline-block align-[-4px] text-teal" strokeWidth={2.4} />
          {uniCount
            ? t('{n} üniversitenin öğrenci e-postasıyla çalışır', { n: uniCount })
            : t('Türkiye üniversitelerinin öğrenci e-postalarıyla çalışır')}
        </motion.p>

        <motion.div {...fade(0.26)} className="mt-8 grid w-full max-w-[24rem] gap-3">
          <Link to="/register" className="landing-btn-primary landing-btn-store group">
            <UserPlus size={24} strokeWidth={2} />
            <span className="label">
              <small>{t('Ücretsiz')}</small>
              <strong>{t('Hemen katıl')}</strong>
            </span>
            <ArrowRight size={18} className="end transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link to="/login" className="landing-btn-secondary landing-btn-store">
            <LogIn size={22} strokeWidth={2} />
            <span className="label">
              <small>{t('Hesabın var mı?')}</small>
              <strong>{t('Giriş yap')}</strong>
            </span>
          </Link>
        </motion.div>

        <motion.p {...fade(0.32)} className="mt-4 max-w-[22rem] text-[0.8125rem] leading-relaxed text-paper-faint">
          <Smartphone size={14} className="mr-1 inline-block align-[-2px]" />
          {t('iOS ve Android uygulamaları yakında · şimdilik tarayıcından kullan')}
        </motion.p>
      </div>

      {/* Uygulama önizlemesi: dokunulabilen telefon. Yüzen kartlar yalnızca geniş
          ekranda ve telefonun dışında durur, ekranı kapatmaz. */}
      <div className="relative mx-auto mt-14 w-full max-w-[60rem] px-4">
        <div className="landing-halo pointer-events-none absolute left-1/2 top-[45%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <PhoneMockup />

        <FloatingChip className="left-[4%] top-16" delay={0.6} icon={ShieldCheck} tone="bg-amber-dim text-amber" title={t('Doğrulandı')} subtitle="elif@itu.edu.tr" />
        <FloatingChip className="right-[4%] top-36" delay={0.8} icon={Sparkles} tone="bg-teal-dim text-teal" title={t('Yeni eşleşme!')} subtitle={t('Sohbet başlat')} />
        <FloatingChip className="bottom-40 left-[2%]" delay={1} icon={Heart} tone="bg-[#c0533f]/12 text-[#c0533f]" title={t('Ortak: Kahve +1')} subtitle={t('Kart Modu')} />
        <FloatingChip className="bottom-24 right-[2%]" delay={1.2} icon={BadgeCheck} tone="bg-[#5f7fa6]/12 text-[#5f7fa6]" title={t('Satranç Kulübü')} subtitle={t('Perşembe 18:00')} />
      </div>

      <div className="relative mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <UniversityMarquee />
      </div>
    </section>
  );
}
