import { motion } from 'framer-motion';
import { BadgeCheck, Bell, Compass, MessageCircle, User, Signal, Wifi, BatteryFull, GraduationCap } from 'lucide-react';

export default function PhoneMockup({ className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28, rotate: -2 }}
      animate={{ opacity: 1, y: 0, rotate: -4 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      className={`relative mx-auto w-[270px] sm:w-[300px] select-none ${className}`}
      style={{ perspective: 1200 }}
    >
      {/* gövde altı parıltı */}
      <div className="absolute -inset-6 rounded-[3.5rem] bg-amber/15 blur-3xl" />

      {/* telefon çerçevesi */}
      <div className="relative rounded-[3rem] border border-white/10 bg-gradient-to-b from-[#262c3a] to-[#11141c] p-[3px] shadow-[0_40px_90px_-20px_rgba(0,0,0,0.7)]">
        <div className="rounded-[2.85rem] border border-black/40 bg-black p-2">
          {/* yan tuşlar */}
          <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-[#11141c]" />
          <span className="absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-[#11141c]" />
          <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#11141c]" />

          {/* ekran */}
          <div className="relative h-[560px] w-full overflow-hidden rounded-[2.3rem] bg-ink">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-2.5 z-30 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

            {/* durum çubuğu */}
            <div className="relative z-20 flex items-center justify-between px-7 pt-3 text-[11px] font-semibold text-paper">
              <span>9:41</span>
              <div className="flex items-center gap-1 opacity-90">
                <Signal size={12} />
                <Wifi size={12} />
                <BatteryFull size={14} />
              </div>
            </div>

            {/* uygulama üst çubuğu */}
            <div className="relative z-20 mt-3 flex items-center justify-between px-5">
              <span className="font-display text-[15px] font-bold text-paper">
                kampüs<span className="text-amber">·</span>
              </span>
              <div className="relative rounded-full bg-surface-2 p-1.5">
                <Bell size={13} className="text-paper-muted" />
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-coral" />
              </div>
            </div>

            {/* keşfet kartı */}
            <div className="relative z-20 mx-4 mt-4 overflow-hidden rounded-[1.6rem] border border-white/8 bg-surface shadow-lg">
              <div className="relative h-[300px] w-full bg-[linear-gradient(155deg,#3a3120_0%,#1c212c_45%,#16313a_100%)]">
                <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_30%_20%,rgba(232,163,61,0.35),transparent_60%)]" />
                <div className="absolute left-1/2 top-[38%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-soft to-amber/40 ring-4 ring-white/10" />
                <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 font-display text-3xl font-bold text-ink/80">
                  EY
                </span>

                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-bold text-amber-soft backdrop-blur">
                  <BadgeCheck size={11} /> Doğrulanmış
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-10">
                  <p className="font-display text-[16px] font-bold text-paper">Elif, 21</p>
                  <p className="flex items-center gap-1 text-[11px] text-paper-muted">
                    <GraduationCap size={11} /> Bilgisayar Müh. · İTÜ
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] text-paper">Satranç Kulübü</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9.5px] text-paper">Kahve</span>
                  </div>
                </div>
              </div>
            </div>

            {/* alt gezinme */}
            <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center">
              <div className="flex items-center gap-1 rounded-full border border-white/8 bg-surface-2/90 px-2 py-2 shadow-lg backdrop-blur">
                <span className="flex items-center gap-1 rounded-full bg-amber px-3 py-1.5 text-[10px] font-bold text-ink">
                  <Compass size={13} /> Keşfet
                </span>
                <span className="p-1.5 text-paper-faint">
                  <MessageCircle size={15} />
                </span>
                <span className="p-1.5 text-paper-faint">
                  <User size={15} />
                </span>
              </div>
            </div>

            {/* ekran cam yansıması */}
            <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/8 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
