import { Quote } from 'lucide-react';
import Reveal from './Reveal';
import GlassCard from './GlassCard';

const QUOTES = [
  {
    name: 'Mert K.',
    meta: 'Bilgisayar Müh. · ODTÜ',
    text: 'Final haftası aynı dersi alan birini bulup beraber çalıştık. Olmasa muhtemelen dersten kalacaktım.',
  },
  {
    name: 'Zeynep A.',
    meta: 'Psikoloji · Boğaziçi Üniversitesi',
    text: 'Herkesin gerçekten kendi okulumdan ve doğrulanmış olması içimi rahatlattı. Diğer uygulamalarda hiç böyle hissetmemiştim.',
  },
  {
    name: 'Emre D.',
    meta: 'İşletme · İTÜ',
    text: 'Fotoğrafçılık kulübüne buradan katıldım, şimdi her hafta kampüste birlikte çekim yapıyoruz.',
  },
];

export default function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-xl text-center">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-coral">Öğrencilerden</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-paper sm:text-4xl">
            Kampüsler dolusu hikaye
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 0.1}>
              <GlassCard className="h-full p-6">
                <Quote size={20} className="text-amber-soft" strokeWidth={1.5} />
                <p className="mt-4 text-[14px] leading-relaxed text-paper">&ldquo;{q.text}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3 border-t border-line-soft pt-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 font-display text-[12px] font-bold text-paper-muted">
                    {q.name.split(' ')[0][0]}
                    {q.name.split(' ')[1]?.[0]}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-paper">{q.name}</p>
                    <p className="text-[11.5px] text-paper-faint">{q.meta}</p>
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
