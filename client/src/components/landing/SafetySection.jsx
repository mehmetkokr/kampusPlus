import { motion } from 'framer-motion';
import { BadgeCheck, FileCheck2, ShieldCheck, UserX } from 'lucide-react';
import Reveal from './Reveal';
import GlassCard from './GlassCard';

const PILLARS = [
  {
    icon: ShieldCheck,
    title: 'Çift katmanlı doğrulama',
    desc: 'Üniversite e-postan otomatik kontrol edilir; e-postan okul domaininde değilse öğrenci belgeni manuel olarak inceleriz.',
  },
  {
    icon: UserX,
    title: 'Anında engelle ve şikayet et',
    desc: 'Rahatsız edici bir profil mi var? Tek dokunuşla engelle, şikayet et — ekibimiz 24 saat içinde inceler.',
  },
  {
    icon: FileCheck2,
    title: 'Verilerin yalnızca sana ait',
    desc: 'Profilin kampüsün dışından hiç kimseye görünmez. Bilgilerini asla üçüncü taraflarla paylaşmayız.',
  },
];

export default function SafetySection() {
  return (
    <section id="guvenlik" className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute left-1/2 top-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal/5 blur-[140px]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 lg:grid-cols-2">
        <Reveal>
          <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-teal">Güvenlik & Doğrulama</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-paper sm:text-4xl">
            Burada herkes gerçekten kim olduğunu söylüyor
          </h2>
          <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-paper-muted">
            kampüs· açık bir uygulama değil. Kapalı bir öğrenci topluluğu. Her hesabın arkasında
            doğrulanmış bir üniversite kimliği var.
          </p>

          <div className="mt-9 space-y-6">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.1} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-dim text-teal">
                  <p.icon size={18} strokeWidth={1.8} />
                </span>
                <div>
                  <h3 className="font-display text-[15px] font-bold text-paper">{p.title}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-paper-muted">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        {/* doğrulanmış öğrenci kimlik kartı görseli */}
        <Reveal delay={0.15} className="relative mx-auto w-full max-w-sm">
          <div className="relative">
            <motion.div
              initial={{ rotate: -6, x: -10 }}
              whileInView={{ rotate: -10, x: -22 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 rounded-[1.4rem] border border-line-soft bg-surface-2/70 shadow-xl"
            />
            <motion.div
              initial={{ rotate: 4, x: 10 }}
              whileInView={{ rotate: 7, x: 18 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              className="absolute inset-0 rounded-[1.4rem] border border-line-soft bg-surface-2/50 shadow-xl"
            />

            <GlassCard className="relative overflow-hidden rounded-[1.4rem] bg-surface/80 p-6">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber/15 blur-3xl" />
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold text-paper">
                  kampüs<span className="text-amber">·</span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-amber-dim px-2.5 py-1 text-[10px] font-bold text-amber-soft">
                  <BadgeCheck size={11} /> DOĞRULANMIŞ
                </span>
              </div>

              <div className="mt-7 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-soft to-teal/40 font-display text-xl font-bold text-ink">
                  AY
                </div>
                <div>
                  <p className="font-display text-[17px] font-bold text-paper">Ayşe Yılmaz</p>
                  <p className="text-[12.5px] text-paper-muted">Endüstri Mühendisliği · 3. Sınıf</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line-soft pt-4 text-[11px] text-paper-faint">
                <span>İstanbul Teknik Üniversitesi</span>
                <span className="font-mono tracking-wider">•••• 4471</span>
              </div>
            </GlassCard>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
