import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Bell,
  BatteryFull,
  Compass,
  GraduationCap,
  Heart,
  LayoutGrid,
  MessageCircle,
  Signal,
  User,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n';

// Uygulamanın gerçek arayüzünü (Kart Modu + cam dock) yansıtan telefon görseli.
export default function PhoneMockup({ className = '' }) {
  const { t } = useI18n();
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: -3 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className={`relative mx-auto w-[272px] select-none sm:w-[300px] ${className}`}
    >
      <div className="landing-float-slow">
        {/* telefon çerçevesi */}
        <div className="relative rounded-[3rem] bg-gradient-to-b from-[#3a4152] via-[#1b202b] to-[#0e1117] p-[3px] shadow-[0_50px_100px_-25px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="rounded-[2.85rem] bg-black p-[9px]">
            <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-[#1b202b]" />
            <span className="absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-[#1b202b]" />
            <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#1b202b]" />

            {/* ekran */}
            <div className="relative h-[560px] w-full overflow-hidden rounded-[2.3rem] bg-ink">
              {/* ekran içi ortam ışığı */}
              <div className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-[#5f7fa6]/25 blur-3xl" />
              <div className="absolute -right-20 top-40 h-56 w-56 rounded-full bg-[#7d7390]/20 blur-3xl" />

              <div className="absolute left-1/2 top-2.5 z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

              {/* durum çubuğu */}
              <div className="relative z-20 flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-paper">
                <span>9:41</span>
                <div className="flex items-center gap-1 opacity-90">
                  <Signal size={12} />
                  <Wifi size={12} />
                  <BatteryFull size={14} />
                </div>
              </div>

              {/* cam başlık */}
              <div className="relative z-20 mx-3 mt-4 flex items-center gap-2.5 rounded-[1.1rem] border border-line bg-surface/75 px-3 py-2.5 backdrop-blur-xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-[#d0653a] to-[#b04d24] text-[#fffaf5]">
                  <Compass size={16} strokeWidth={2.4} />
                </span>
                <div className="leading-tight">
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#a9bfd8]">{t("İstanbul Teknik Üni.")}</p>
                  <p className="text-[14px] font-bold text-paper">{t("Kart Modu")}</p>
                </div>
                <span className="relative ml-auto flex h-7 w-7 items-center justify-center rounded-[0.55rem] border border-line bg-surface-2">
                  <Bell size={12} className="text-paper" />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral ring-2 ring-ink" />
                </span>
              </div>

              {/* kart yığını */}
              <div className="relative z-20 mx-4 mt-4 h-[330px]">
                <div className="absolute inset-x-5 top-3 h-full rounded-[1.5rem] border border-line-soft bg-surface-2/60" />
                <div className="absolute inset-x-2.5 top-1.5 h-full rounded-[1.5rem] border border-line-soft bg-surface-2/80" />
                <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-2xl">
                  <div className="relative h-[228px] w-full bg-[linear-gradient(160deg,var(--color-surface-3)_0%,var(--color-surface-2)_45%,var(--color-surface-3)_100%)]">
                    <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_25%,rgba(138, 166, 200,0.45),transparent_60%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_80%,rgba(217, 135, 106,0.35),transparent_60%)]" />
                    <div className="absolute left-1/2 top-[42%] flex h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#a9bfd8] to-[#5f7fa6] text-[28px] font-bold text-[#0d0f14] ring-4 ring-surface">
                      {t("EY")}
                    </div>
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-surface/80 px-2.5 py-1 text-[9.5px] font-semibold text-teal backdrop-blur">
                      <BadgeCheck size={11} /> {t("Doğrulanmış")}
                    </div>
                    <div className="absolute right-3 top-3 rounded-lg border-2 border-teal/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-teal opacity-90 [transform:rotate(12deg)]">
                      {t("BEĞEN")}
                    </div>
                  </div>
                  <div className="px-4 pb-3 pt-3">
                    <p className="text-[15px] font-bold text-paper">{t("Elif, 21")}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-paper-muted">
                      <GraduationCap size={11} /> {t("Bilgisayar Müh. · 3. Sınıf")}
                    </p>
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[9px] font-semibold text-teal">{t("Arkadaşlık")}</span>
                      <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[9px] font-semibold text-amber-soft">{t("Çalışma")}</span>
                      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[9px] text-paper">{t("Kahve")}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* beğen / geç */}
              <div className="relative z-20 mt-4 flex items-center justify-center gap-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-coral/50 bg-coral/10 text-coral">
                  <X size={18} strokeWidth={2.6} />
                </span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e0835a] to-[#b04d24] text-[#fffaf5] shadow-[0_10px_24px_-8px_rgba(199, 91, 48,0.9)]">
                  <Heart size={19} fill="currentColor" />
                </span>
              </div>

              {/* cam dock */}
              <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center">
                <div className="flex items-center gap-0.5 rounded-[1.2rem] border border-line bg-surface/80 p-1 shadow-lg backdrop-blur-xl">
                  <span className="flex items-center gap-1 rounded-[0.9rem] bg-gradient-to-br from-[#eaa07e] to-[#d0653a] px-2.5 py-1.5 text-[9.5px] font-extrabold text-[#0d0f14]">
                    <Compass size={13} strokeWidth={2.4} /> {t("Keşfet")}
                  </span>
                  {[LayoutGrid, Users, MessageCircle, User].map((Icon, i) => (
                    <span key={i} className="p-1.5 text-paper-muted">
                      <Icon size={14} />
                    </span>
                  ))}
                </div>
              </div>

              {/* ekran cam yansıması */}
              <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
