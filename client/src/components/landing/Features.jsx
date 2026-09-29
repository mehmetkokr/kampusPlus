import { BadgeCheck, BookOpen, CalendarHeart, Lock, MessagesSquare, Sparkles } from 'lucide-react';
import Reveal from './Reveal';
import GlassCard from './GlassCard';

const FEATURES = [
  {
    icon: BadgeCheck,
    color: 'amber',
    title: 'Doğrulanmış Profiller',
    desc: 'Her üye, üniversite e-postası veya öğrenci belgesiyle doğrulanır. Sahte hesap ve botlara yer yok.',
  },
  {
    icon: Sparkles,
    color: 'teal',
    title: 'Akıllı Eşleşme',
    desc: 'Bölüm, sınıf ve ortak ilgi alanlarına göre seni gerçekten anlayacak insanları öne çıkarır.',
  },
  {
    icon: MessagesSquare,
    color: 'amber',
    title: 'Gerçek Zamanlı Sohbet',
    desc: 'Eşleştiğin anda sohbet başlar. Mesajların yalnızca senin ve karşındakinin görebileceği şekilde şifrelenir.',
  },
  {
    icon: CalendarHeart,
    color: 'coral',
    title: 'Kulüp & Etkinlik Akışı',
    desc: 'Kampüsündeki kulüp buluşmalarını, etkinlikleri ve sosyal organizasyonları kaçırma.',
  },
  {
    icon: BookOpen,
    color: 'teal',
    title: 'Ders Ortağı Bul',
    desc: 'Aynı dersi alan, aynı sınavdan kaygı duyan insanlarla bir araya gel. Beraber çalışmak daha kolay.',
  },
  {
    icon: Lock,
    color: 'amber',
    title: 'Gizlilik Kontrolleri',
    desc: 'Profilini yalnızca kendi üniversiten görür. İstediğin an engelle, şikayet et ya da hesabını gizle.',
  },
];

const COLOR_MAP = {
  amber: 'bg-amber-dim text-amber-soft',
  teal: 'bg-teal-dim text-teal',
  coral: 'bg-coral-dim text-coral',
};

export default function Features() {
  return (
    <section id="ozellikler" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4">
        <Reveal className="mx-auto max-w-xl text-center">
          <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-amber-soft">Özellikler</span>
          <h2 className="mt-3 font-display text-3xl font-bold text-paper sm:text-4xl">
            Kampüs hayatı için tasarlandı
          </h2>
          <p className="mt-3 text-[14.5px] text-paper-muted">
            Sadece tanışmak için değil — kampüsünde gerçekten bir yer edinmen için.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
              <GlassCard className="group h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${COLOR_MAP[f.color]}`}>
                  <f.icon size={20} strokeWidth={1.8} />
                </div>
                <h3 className="mt-4 font-display text-[16px] font-bold text-paper">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-paper-muted">{f.desc}</p>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
