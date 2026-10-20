import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, LogIn, MessageCircle, ShieldCheck, UserPlus, Users } from '../icons';
import BrandMark from '../BrandMark';
import CampusSky from '../CampusSky';
import ThemeToggle from '../ThemeToggle';
import HeroGradient from './HeroGradient';
import { LangSwitch } from './LandingNav';
import { RotatingWord } from './Hero';
import { whenSplashLeaves } from '../../lib/splash';
import { useI18n } from '../../i18n';

// Telefonda ilk ekran: web sitesi gibi uzun bir tanıtım yerine uygulama
// açılışı gibi tek ekran. Açılış animasyonu (index.html #boot-splash) kalkarken
// logo ortadan yukarı yerleşir, ardından başlık, kısa özellikler ve düğmeler
// sırayla belirir. Tanıtım bölümleri bu ekranın altında durur ("Uygulamayı
// tanı" ile oraya inilir); arama motorları da o metinleri görmeye devam eder.
const EASE = [0.16, 1, 0.3, 1];

const FEATURES = [
  { icon: ShieldCheck, label: 'Doğrulanmış öğrenciler' },
  { icon: Users, label: 'Kendi kampüsün' },
  { icon: MessageCircle, label: 'Kulüpler ve sohbet' },
];

export default function MobileWelcome({ tourId }) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => whenSplashLeaves(() => setReady(true)), []);

  // Hareket azaltma açıksa her şey baştan yerinde
  const show = ready || reduceMotion;
  const item = (delay, y = 18) => ({
    initial: reduceMotion ? false : { opacity: 0, y },
    animate: show ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.7, delay, ease: EASE },
  });

  function openTour() {
    document.getElementById(tourId)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  return (
    <section className="landing-hero-bg mobile-welcome relative isolate flex flex-col overflow-hidden px-6">
      <HeroGradient />
      <CampusSky variant="landing" />

      <div className="mobile-welcome-top flex items-center justify-end">
        <ThemeToggle className="landing-theme-toggle" />
        <LangSwitch />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 1.35 }}
          animate={show ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.9, ease: EASE }}
          className="mobile-welcome-mark"
        >
          <BrandMark size={76} />
        </motion.div>

        <motion.p {...item(0.15, 10)} className="mt-3 text-[1.5rem] font-bold tracking-[-0.03em] text-paper">
          {t('kampüs')}
          <span className="text-brand">+</span>
        </motion.p>

        <motion.h1 {...item(0.3)} className="landing-h1 mobile-welcome-title mt-6">
          {t('Kampüsünde')}
          <br />
          <RotatingWord />
          <br />
          {t('bul.')}
        </motion.h1>

        <motion.ul {...item(0.45)} className="mobile-welcome-features mt-6 flex flex-wrap justify-center gap-2">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="landing-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold text-paper"
            >
              <Icon size={15} className="text-teal" aria-hidden="true" />
              {t(label)}
            </li>
          ))}
        </motion.ul>
      </div>

      <motion.div {...item(0.6, 24)} className="mobile-welcome-actions mt-6 grid w-full gap-2.5">
        <Link to="/register" className="landing-btn-primary landing-btn-store group">
          <UserPlus size={22} strokeWidth={2} />
          <span className="label">
            <small>{t('Ücretsiz')}</small>
            <strong>{t('Hemen katıl')}</strong>
          </span>
          <ArrowRight size={18} className="end" />
        </Link>
        <Link to="/login" className="landing-btn-secondary landing-btn-store">
          <LogIn size={20} strokeWidth={2} />
          <span className="label">
            <small>{t('Hesabın var mı?')}</small>
            <strong>{t('Giriş yap')}</strong>
          </span>
        </Link>
        <button
          type="button"
          onClick={openTour}
          className="-mb-1 inline-flex min-h-11 items-center justify-center gap-1 text-[0.875rem] font-semibold text-paper-muted"
        >
          {t('Uygulamayı tanı')}
          <ChevronDown size={16} className="mobile-welcome-bounce" aria-hidden="true" />
        </button>
      </motion.div>
    </section>
  );
}
