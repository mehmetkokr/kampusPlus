import { BadgeCheck, Heart, Layers, ShieldOff } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';

// "Neden kampüs·?" — benzer kampüs uygulamalarından ayrıldığı noktalar.
// Yalnızca gerçekten uygulamada olan özellikler yazılır.
const POINTS = [
  {
    icon: BadgeCheck,
    tone: 'text-teal bg-teal-dim',
    title: 'Yeşil tik bir insan onayıdır',
    desc: 'Onaylı öğrenci rozeti, e-Devlet öğrenci belgen ekibimiz tarafından tek tek incelendikten sonra verilir. Otomatik değil.',
  },
  {
    icon: Heart,
    tone: 'text-[color:var(--coral)] bg-[color:var(--coral)]/10',
    title: 'Flört yalnızca isteyene',
    desc: 'Flört ve uzun süreli ilişki tercihlerini yalnızca aynı şeyi seçenler görür. Arkadaş ya da ders arkadaşı arayan kimse rahatsız olmaz.',
  },
  {
    icon: Layers,
    tone: 'text-amber bg-amber-dim',
    title: 'Kart Modu senin seçimin',
    desc: 'Sadece kulüpler ve akış mı istiyorsun? Kart Modu\'nu tek dokunuşla kapat; kimsenin destesinde görünmezsin.',
  },
  {
    icon: ShieldOff,
    tone: 'text-[color:var(--sky)] bg-[color:var(--sky)]/10',
    title: 'Reklam yok, verin satılmaz',
    desc: 'Tanışma, sohbet, kulüpler ve etkinlikler ücretsiz. Bilgilerini reklam için kimseyle paylaşmayız.',
  },
];

export default function WhySection() {
  const { t } = useI18n();
  return (
    <section id="neden" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-xl text-center">
          <p className="landing-eyebrow">{t('Neden kampüs·?')}</p>
          <h2 className="landing-h2 mt-3">{t('Neden kampüs·?')}</h2>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted">
            {t('Diğer sosyal uygulamalardan ayrıldığımız noktalar.')}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08} className="landing-card flex gap-4 p-6">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${p.tone}`}>
                <p.icon size={20} strokeWidth={2} />
              </span>
              <div>
                <h3 className="text-[1.0625rem] font-bold tracking-[-0.01em] text-paper">{t(p.title)}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-paper-muted">{t(p.desc)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
