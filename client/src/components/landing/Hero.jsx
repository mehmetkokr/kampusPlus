import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react';
import CampusBackdrop from './CampusBackdrop';
import PhoneMockup from './PhoneMockup';
import GlassCard from './GlassCard';
import UniversityMarquee from './UniversityMarquee';
import ScrollDownIndicator from './ScrollDownIndicator';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40">
      <CampusBackdrop />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-16 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        {/* metin */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface/60 px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-soft backdrop-blur"
          >
            <ShieldCheck size={14} />
            Yalnızca üniversite e-postanla doğrulanır
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
            className="mt-5 font-display text-[2.5rem] font-bold leading-[1.08] tracking-tight text-paper sm:text-6xl lg:text-[3.4rem]"
          >
            Kampüsünün dışına
            <br className="hidden sm:block" /> çık<span className="text-amber">madan</span>, gerçek
            insanlarla tanış.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16 }}
            className="mx-auto mt-5 max-w-lg text-[15.5px] leading-relaxed text-paper-muted lg:mx-0"
          >
            Ders ortağı bul, bir kulübe katıl, yeni arkadaşlar edin — istersen aşkı da. kampüs·,
            yalnızca okul e-postanla doğruladığın, kendi üniversitendeki öğrencilerle seni
            buluşturan kapalı bir topluluktur.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
          >
            <Link
              to="/register"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber px-6 py-3.5 text-[14.5px] font-bold text-ink transition-transform hover:scale-[1.02] hover:bg-amber-soft active:scale-[0.98] sm:w-auto"
            >
              Üniversite E-postanla Başla
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#nasil-calisir"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3.5 text-[14.5px] font-semibold text-paper transition-colors hover:bg-white/5 sm:w-auto"
            >
              Nasıl çalışır?
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-8 flex items-center justify-center gap-5 text-[12.5px] text-paper-faint lg:justify-start"
          >
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-teal" /> 12.000+ doğrulanmış öğrenci
            </span>
            <span className="flex items-center gap-1.5">
              <GraduationCap size={14} className="text-teal" /> 40+ kampüs
            </span>
          </motion.div>
        </div>

        {/* görsel: telefon mockup + yüzen cam kartlar */}
        <div className="relative mx-auto h-[460px] w-full max-w-sm sm:h-[560px]">
          <PhoneMockup className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />

          <motion.div
            initial={{ opacity: 0, x: -16, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="absolute left-0 top-6 z-20 sm:left-2"
          >
            <GlassCard className="flex items-center gap-2 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber/20 text-amber-soft">
                <ShieldCheck size={14} />
              </span>
              <div className="leading-tight">
                <p className="text-[11.5px] font-bold text-paper">Doğrulanmış</p>
                <p className="text-[10px] text-paper-faint">İTÜ · .edu.tr</p>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 16, y: -10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="absolute right-0 top-16 z-20 sm:right-1"
          >
            <GlassCard className="flex items-center gap-2 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal/20 text-teal">
                <Sparkles size={14} />
              </span>
              <p className="text-[11.5px] font-bold text-paper">Yeni eşleşme!</p>
            </GlassCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="absolute bottom-2 left-2 z-20 sm:bottom-6 sm:left-0"
          >
            <GlassCard className="flex items-center gap-2 px-3.5 py-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral/20 text-coral">
                <GraduationCap size={14} />
              </span>
              <div className="leading-tight">
                <p className="text-[11.5px] font-bold text-paper">Ders Ortağı Bul</p>
                <p className="text-[10px] text-paper-faint">Bölümüne göre eşleş</p>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* üniversite logo şeridi */}
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <UniversityMarquee />
      </div>

      <ScrollDownIndicator />
    </section>
  );
}
