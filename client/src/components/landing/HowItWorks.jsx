import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Mail, UserCircle } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';

const STEPS = [
  {
    icon: Mail,
    title: 'Okul e-postanla kaydol',
    desc: 'Kayıt kodu yalnızca okulunun .edu.tr e-postasına gelir; kodu girdiğin an hesabın doğrulanır.',
  },
  {
    icon: UserCircle,
    title: 'Profilini oluştur',
    desc: 'Bölümün, sınıfın ve ne aradığın: arkadaşlık, çalışma arkadaşı, etkinlik ya da daha fazlası.',
  },
  {
    icon: Compass,
    title: 'Kampüsünü keşfet',
    desc: 'Doğrulanmış öğrencilerle eşleş, sohbet et, kulüplere katıl, etkinlikleri kaçırma.',
  },
];

export default function HowItWorks() {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();

  return (
    <section id="nasil-calisir" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="landing-eyebrow">{t("Nasıl çalışır")}</p>
          <h2 className="landing-h2 mt-3">{t("Bir dakikada kampüsündesin.")}</h2>
        </Reveal>

        <div className="relative mt-16">
          {/* adımları birbirine bağlayan, ekrana girince çizilen çizgi */}
          <div className="absolute left-[1.75rem] top-7 h-[calc(100%-3.5rem)] w-px bg-line sm:left-[16.66%] sm:right-[16.66%] sm:top-7 sm:h-px sm:w-auto" aria-hidden="true">
            <motion.div
              className="landing-progress h-full w-full origin-top sm:origin-left"
              initial={reduceMotion ? false : { scaleY: 0, scaleX: 0 }}
              whileInView={{ scaleY: 1, scaleX: 1 }}
              viewport={{ once: true, margin: '-120px' }}
              transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
            />
          </div>

          <ol className="relative grid gap-10 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((step, i) => (
              <Reveal as="li" key={step.title} delay={0.2 + i * 0.25} className="flex gap-5 sm:flex-col sm:items-center sm:text-center">
                <div className="landing-step-icon relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
                  <step.icon size={22} strokeWidth={1.9} />
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-[0.6875rem] font-bold text-ink">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h3 className="text-[1.125rem] font-semibold tracking-[-0.01em] text-paper sm:mt-5">{t(step.title)}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper-muted">{t(step.desc)}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
