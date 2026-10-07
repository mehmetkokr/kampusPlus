import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Check, Crown, EyeOff, Heart, Loader2, Lock, Mail, ShieldCheck, UserX, X } from 'lucide-react';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';
import { Bot, Camera, Guitar } from 'lucide-react';

const EASE = [0.16, 1, 0.3, 1];

// Ekrandayken belirli aralıkla ilerleyen sayaç; ekran dışında ve "reduced
// motion" açıkken durur (demolar o zaman ilk karede sabit kalır).
function useTicker(ref, interval, length) {
  const inView = useInView(ref, { amount: 0.35 });
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return undefined;
    const id = setInterval(() => setTick((t) => (t + 1) % length), interval);
    return () => clearInterval(id);
  }, [inView, reduceMotion, interval, length]);

  return tick;
}

function Tile({ className = '', eyebrow, title, desc, children, tone = 'amber', delay = 0 }) {
  return (
    <Reveal delay={delay} className={`landing-tile tone-${tone} ${className}`}>
      <div className="relative z-10 p-6 sm:p-7">
        <p className="landing-tile-eyebrow">{eyebrow}</p>
        <h3 className="mt-2 text-[1.3125rem] font-semibold leading-snug tracking-[-0.02em] text-paper">{title}</h3>
        {desc && <p className="mt-2 max-w-sm text-[0.9375rem] leading-relaxed text-paper-muted">{desc}</p>}
      </div>
      <div className="relative z-10 flex-1">{children}</div>
    </Reveal>
  );
}

/* ---------------- Kart Modu demosu ---------------- */

const PROFILES = [
  { initials: 'EY', name: 'Elif, 21', dept: 'Bilgisayar Müh.', grad: 'from-[#b9d6f7] to-[#b9d6f7]', tag: 'Arkadaşlık' },
  { initials: 'KA', name: 'Kerem, 22', dept: 'Mimarlık', grad: 'from-[#9ec9f5] to-[#9ec9f5]', tag: 'Çalışma' },
  { initials: 'ZD', name: 'Zeynep, 20', dept: 'Psikoloji', grad: 'from-[var(--amber-soft)] to-[var(--amber-soft)]', tag: 'Etkinlik' },
  { initials: 'MT', name: 'Mert, 23', dept: 'Endüstri Müh.', grad: 'from-[#a7e3b5] to-[#a7e3b5]', tag: 'Kulüp' },
];

function SwipeDemo() {
  const { t: tx } = useI18n();
  const ref = useRef(null);
  const tick = useTicker(ref, 2400, PROFILES.length * 100);
  const index = tick % PROFILES.length;
  const matched = tick > 0 && tick % 3 === 0;

  return (
    <div ref={ref} className="relative mx-auto flex h-[360px] w-full max-w-[270px] items-start justify-center pt-2">
      {[2, 1].map((offset) => {
        const p = PROFILES[(index + offset) % PROFILES.length];
        return (
          <div
            key={`back-${offset}`}
            className="absolute inset-x-0 top-2 mx-auto h-[300px] rounded-[1.4rem] border border-line-soft bg-surface-2"
            style={{ transform: `translateY(${offset * 10}px) scale(${1 - offset * 0.05})`, opacity: 1 - offset * 0.3 }}
            aria-hidden="true"
          >
            <span className="sr-only">{p.name}</span>
          </div>
        );
      })}

      <AnimatePresence initial={false}>
        <motion.div
          key={tick}
          className="absolute inset-x-0 top-2 mx-auto h-[300px] overflow-hidden rounded-[1.4rem] border border-line bg-surface shadow-2xl"
          initial={{ scale: 0.95, y: 10, opacity: 0.6 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ x: 260, rotate: 16, opacity: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <div className="relative h-[200px] bg-[linear-gradient(160deg,var(--color-surface-3)_0%,var(--color-surface-2)_55%,var(--color-surface-3)_100%)]">
            <div className={`absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br ${PROFILES[index].grad} text-2xl font-bold text-[#1d1d1f] ring-4 ring-surface`}>
              {PROFILES[index].initials}
            </div>
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-surface/80 px-2.5 py-1 text-[0.625rem] font-semibold text-teal backdrop-blur">
              <BadgeCheck size={11} /> {tx("Doğrulanmış")}
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="text-base font-semibold text-paper">{PROFILES[index].name}</p>
            <p className="text-xs text-paper-muted">{tx(PROFILES[index].dept)}</p>
            <span className="mt-2 inline-block rounded-full bg-surface-3 px-2 py-0.5 text-[0.625rem] font-medium text-paper">
              {tx(PROFILES[index].tag)}
            </span>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-0 flex gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-coral/50 bg-coral/10 text-coral">
          <X size={18} strokeWidth={2.6} />
        </span>
        <motion.span
          key={`like-${tick}`}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.45 }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--amber-soft)] text-[#ffffff]"
        >
          <Heart size={17} fill="currentColor" />
        </motion.span>
      </div>

      <AnimatePresence>
        {matched && (
          <motion.div
            key={`match-${tick}`}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="landing-chip absolute -top-3 z-20 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-paper"
          >
            {tx("Eşleştiniz!")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Doğrulama demosu ---------------- */

const EMAIL = 'elif.yilmaz@itu.edu.tr';

function VerifyDemo() {
  const { t: tx } = useI18n();
  const ref = useRef(null);
  // 0..EMAIL.length: yazılıyor · +1..+3: kontrol · +4..+10: doğrulandı
  const total = EMAIL.length + 12;
  const tick = useTicker(ref, 110, total);
  const reduceMotion = useReducedMotion();
  const step = reduceMotion ? total - 1 : tick;
  const typed = EMAIL.slice(0, Math.min(step, EMAIL.length));
  const checking = step > EMAIL.length && step <= EMAIL.length + 3;
  const done = step > EMAIL.length + 3;

  return (
    <div ref={ref} className="px-6 pb-7 sm:px-7">
      <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
        <Mail size={16} className="shrink-0 text-paper-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-paper">
          {typed}
          {!done && !checking && <span className="landing-caret" />}
        </span>
        {checking && <Loader2 size={16} className="shrink-0 animate-spin text-amber-soft" />}
        {done && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-white"
          >
            <Check size={14} strokeWidth={3} />
          </motion.span>
        )}
      </div>
      <div className="mt-3 flex h-6 items-center gap-2 text-[0.8125rem]">
        {done ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 font-medium text-teal">
            <ShieldCheck size={14} /> {tx("İstanbul Teknik Üniversitesi · doğrulandı")}
          </motion.span>
        ) : (
          <span className="text-paper-faint">{checking ? tx("Üniversite alan adı kontrol ediliyor…") : tx("Okul e-postanı gir")}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------- Seni Beğenenler demosu ---------------- */

const LIKE_GRADS = [
  'from-[var(--amber-soft)] to-[var(--amber-soft)]',
  'from-[#b9d6f7] to-[#b9d6f7]',
  'from-[#9ec9f5] to-[#9ec9f5]',
  'from-[#a7e3b5] to-[#a7e3b5]',
  'from-[#c6c5f2] to-[#c6c5f2]',
  'from-[#ffd6a5] to-[#ffd6a5]',
];

function LikesDemo() {
  const { t: tx } = useI18n();
  const ref = useRef(null);
  const tick = useTicker(ref, 1400, 1000);
  const count = 3 + (tick % 4);

  return (
    <div ref={ref} className="px-6 pb-7 sm:px-7">
      <div className="grid grid-cols-3 gap-2.5">
        {LIKE_GRADS.map((g, i) => (
          <div key={g} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-surface-2/60">
            <div className={`absolute inset-3 rounded-full bg-gradient-to-br ${g} opacity-80 blur-md`} />
            {i < count && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--amber-soft)] text-white"
              >
                <Heart size={10} fill="currentColor" />
              </motion.span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[0.875rem] font-semibold text-paper">
          <motion.span key={count} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-block">
            {count}
          </motion.span>{' '}
          {tx("kişi seni beğendi")}
        </span>
        <span className="flex items-center gap-1 rounded-full bg-[var(--amber-soft)] px-2.5 py-1 text-[0.6875rem] font-bold text-[#ffffff]">
          <Crown size={11} /> {tx("Premium")}
        </span>
      </div>
    </div>
  );
}

/* ---------------- Sohbet demosu ---------------- */

const CHAT = [
  { mine: false, text: 'Selam! Sen de Satranç Kulübü’ndesin değil mi? ♟️' },
  { mine: true, text: 'Evet! Perşembe turnuvasına geliyor musun?' },
  { mine: false, text: 'Kesinlikle. Öncesinde kütüphanede çalışalım mı?' },
  { mine: true, text: 'Olur, 16:00’da girişte buluşalım 👋' },
];

function ChatDemo() {
  const { t: tx } = useI18n();
  const ref = useRef(null);
  // her mesajdan önce bir "yazıyor" adımı, sonunda bir bekleme
  const tick = useTicker(ref, 1100, CHAT.length * 2 + 3);
  const reduceMotion = useReducedMotion();
  const step = reduceMotion ? CHAT.length * 2 : tick;
  const shown = Math.min(Math.floor(step / 2), CHAT.length);
  const typing = step < CHAT.length * 2 && step % 2 === 0 && !CHAT[shown]?.mine;

  return (
    <div ref={ref} className="flex h-[250px] flex-col justify-end gap-2 px-6 pb-7 sm:px-7">
      <AnimatePresence initial={false}>
        {CHAT.slice(0, shown).map((m) => (
          <motion.div
            key={m.text}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: EASE }}
            className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.8125rem] leading-snug ${
              m.mine
                ? 'self-end rounded-br-md bg-[var(--amber-soft)] text-[#ffffff]'
                : 'self-start rounded-bl-md border border-line bg-surface/75 text-paper'
            }`}
          >
            {tx(m.text)}
          </motion.div>
        ))}
      </AnimatePresence>
      {typing && (
        <motion.div layout className="flex w-fit gap-1 self-start rounded-2xl rounded-bl-md border border-line bg-surface/75 px-3.5 py-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="landing-typing-dot h-1.5 w-1.5 rounded-full bg-paper-muted" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

/* ---------------- Kulüpler demosu ---------------- */

const CLUBS = [
  // Örnek kulüpler (uydurma üye sayısı göstermeden yalnızca kategori)
  { icon: Crown, name: 'Satranç Kulübü', category: 'Akademik' },
  { icon: Camera, name: 'Fotoğrafçılık', category: 'Sanat' },
  { icon: Bot, name: 'Robotik Takımı', category: 'Teknoloji' },
  { icon: Guitar, name: 'Müzik Topluluğu', category: 'Sanat' },
];

function ClubsDemo() {
  const { t: tx } = useI18n();
  const ref = useRef(null);
  const tick = useTicker(ref, 1300, CLUBS.length + 2);

  return (
    <div ref={ref} className="grid gap-2.5 px-6 pb-7 sm:grid-cols-2 sm:px-7">
      {CLUBS.map((c, i) => {
        const joined = i < tick;
        return (
          <div key={c.name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 px-3.5 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface/75 text-amber-soft"><c.icon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.875rem] font-semibold text-paper">{tx(c.name)}</p>
              <p className="text-xs text-paper-muted">{tx(c.category)}</p>
            </div>
            <span
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300 ${
                joined ? 'bg-teal/15 text-teal' : 'border border-line text-paper'
              }`}
            >
              {joined ? (
                <>
                  <Check size={12} strokeWidth={3} /> {tx("Üyesin")}
                </>
              ) : (
                tx("Katıl")
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Gizlilik ---------------- */

function PrivacyDemo() {
  const { t: tx } = useI18n();
  const items = [
    { icon: Lock, text: 'Profilini yalnızca kendi kampüsün görür' },
    { icon: UserX, text: 'Tek dokunuşla engelle ve şikayet et' },
    { icon: EyeOff, text: 'İstediğin an hesabını dondur' },
  ];
  return (
    <ul className="space-y-2.5 px-6 pb-7 sm:px-7">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-3 text-[0.875rem] text-paper">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/15 text-teal">
            <Icon size={15} />
          </span>
          {tx(text)}
        </li>
      ))}
    </ul>
  );
}

export default function Bento() {
  const { t: tx } = useI18n();
  return (
    <section id="ozellikler" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="landing-eyebrow">{tx("Uygulamanın içinden")}</p>
          <h2 className="landing-h2 mt-3">{tx("Kampüs hayatın, tek bir uygulamada.")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-[1.0625rem] leading-relaxed text-paper-muted">
            {tx("Tanışmak, sohbet etmek, kulüplere katılmak. Hepsi doğrulanmış öğrencilerle, hepsi kendi üniversitende.")}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto_auto]">
          <Tile
            className="lg:row-span-2"
            tone="sky"
            eyebrow={tx("Kart Modu")}
            title={tx("Sağa kaydır, eşleş.")}
            desc={tx("Ne aradığına göre sıralanan öğrencileri keşfet. İkiniz de beğenirseniz sohbet açılır.")}
          >
            <div className="px-6 pb-8 sm:px-7">
              <SwipeDemo />
            </div>
          </Tile>

          <Tile tone="amber" eyebrow={tx("Doğrulama")} title={tx("Saniyeler içinde doğrulan.")} delay={0.05}>
            <VerifyDemo />
          </Tile>

          <Tile tone="rose" eyebrow={tx("Premium")} title={tx("Seni kimlerin beğendiğini gör.")} delay={0.1}>
            <LikesDemo />
          </Tile>

          <Tile
            className="lg:col-span-2"
            tone="teal"
            eyebrow={tx("Gerçek zamanlı sohbet")}
            title={tx("Eşleştiğin an konuşmaya başla.")}
            desc={tx("Mesajlar anında iletilir; karşı tarafın yazdığını ve mesajını gördüğünü bilirsin.")}
            delay={0.05}
          >
            <ChatDemo />
          </Tile>

          <Tile className="lg:col-span-2" tone="violet" eyebrow={tx("Kulüpler & etkinlikler")} title={tx("İlgi alanın zaten bir kulüp.")} delay={0.05}>
            <ClubsDemo />
          </Tile>

          <Tile tone="teal" eyebrow={tx("Güvenlik")} title={tx("Kontrol her zaman sende.")} delay={0.1}>
            <PrivacyDemo />
          </Tile>
        </div>
      </div>
    </section>
  );
}
