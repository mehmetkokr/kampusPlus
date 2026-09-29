import { Mail, UserCircle, Compass } from 'lucide-react';
import Reveal from './Reveal';

const STEPS = [
  {
    n: '01',
    icon: Mail,
    title: 'Üniversite e-postanla kayıt ol',
    desc: '.edu.tr uzantılı adresin varsa hesabın anında doğrulanır. Yoksa öğrenci belgeni yükleyip ekibimizin onayını bekleyebilirsin.',
  },
  {
    n: '02',
    icon: UserCircle,
    title: 'Profilini oluştur',
    desc: 'Bölümün, sınıfın ve ilgi alanların — kendini gerçekten yansıtan bir profil hazırla. Her şey istediğin an düzenlenebilir.',
  },
  {
    n: '03',
    icon: Compass,
    title: 'Kampüsünü keşfet',
    desc: 'Yalnızca kendi üniversitenden, doğrulanmış öğrencileri gör. Sohbet et, eşleş, kulüplere ve etkinliklere göz at.',
  },
];

export default function HowItWorks() {
  return (
    <section id="nasil-calisir" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4">
        <Reveal className="mx-auto max-w-xl text-center">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-teal">Nasıl Çalışır</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-paper sm:text-4xl">
            Üç adımda kampüsüne katıl
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.12} className="relative text-center sm:text-left">
              {i < STEPS.length - 1 && (
                <span className="absolute right-[-1.5rem] top-7 hidden h-px w-12 bg-gradient-to-r from-line to-transparent sm:block" />
              )}
              <span className="font-display text-sm font-bold text-paper-faint">{step.n}</span>
              <div className="mx-auto mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-dim text-amber-soft sm:mx-0">
                <step.icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-paper">{step.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-paper-muted">{step.desc}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
