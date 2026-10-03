import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import {
  BadgeCheck,
  BatteryFull,
  Bell,
  CalendarDays,
  Check,
  Compass,
  GraduationCap,
  Heart,
  LayoutGrid,
  MessageCircle,
  RotateCcw,
  Send,
  Signal,
  User,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n';

// Ana sayfadaki telefon: uygulamanın küçük, gerçekten kullanılabilen bir
// demosu. Kartlar parmakla ya da fareyle kaydırılır, alttaki menüyle ekranlar
// arasında gezilir. Kart Modu'nda beğenilen ve karşılık veren kişi Eşleşmeler
// ve Mesajlar ekranına düşer. Hiçbir veri sunucuya gitmez.

const EASE_OUT = [0.23, 1, 0.32, 1];

const PEOPLE = [
  { id: 'elif', name: 'Elif', age: 21, dept: 'Bilgisayar Müh. · 3. Sınıf', initials: 'EY', tags: ['Arkadaşlık', 'Çalışma', 'Kahve'], from: '#a9bfd8', to: '#5f7fa6', likesYou: true },
  { id: 'can', name: 'Can', age: 22, dept: 'Mimarlık · 4. Sınıf', initials: 'CA', tags: ['Spor', 'Fotoğraf'], from: '#f2c4a8', to: '#c75b30', likesYou: false },
  { id: 'deniz', name: 'Deniz', age: 20, dept: 'Psikoloji · 2. Sınıf', initials: 'DK', tags: ['Kitap', 'Kahve', 'Müzik'], from: '#b9d4bf', to: '#4f7d5d', likesYou: true },
  { id: 'mert', name: 'Mert', age: 23, dept: 'Endüstri Müh. · 4. Sınıf', initials: 'MT', tags: ['Proje', 'Satranç'], from: '#d6c8e6', to: '#7d7390', likesYou: false },
];

const TABS = [
  { key: 'cards', icon: Compass, label: 'Keşfet', title: 'Kart Modu' },
  { key: 'clubs', icon: LayoutGrid, label: 'Kulüpler', title: 'Kulüpler' },
  { key: 'matches', icon: Users, label: 'Eşleşme', title: 'Eşleşmeler' },
  { key: 'chat', icon: MessageCircle, label: 'Mesaj', title: 'Mesajlar' },
  { key: 'profile', icon: User, label: 'Profil', title: 'Profilim' },
];

const CLUBS = [
  { id: 1, name: 'Satranç Kulübü', when: 'Perşembe 18:00', members: 64, tone: '#5f7fa6' },
  { id: 2, name: 'Fotoğrafçılık', when: 'Cumartesi 11:00', members: 112, tone: '#c75b30' },
  { id: 3, name: 'Koşu Topluluğu', when: 'Pazar 08:30', members: 87, tone: '#4f7d5d' },
];

const QUICK_REPLIES = ['Selam! Kahve?', 'Hangi dersleri alıyorsun?', 'Kulübe gelsene'];

function Avatar({ person, size = 40, ring = false }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-[#0d0f14] ${ring ? 'ring-4 ring-surface' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.32, background: `linear-gradient(135deg, ${person.from}, ${person.to})` }}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

// Üstteki kart: sürüklenebilir. command değişince (düğmeye basıldı) kendini atar.
function SwipeCard({ person, isTop, depth, command, onDecide, nudge }) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-14, 14]);
  const likeOpacity = useTransform(x, [16, 90], [0, 1]);
  const nopeOpacity = useTransform(x, [-90, -16], [1, 0]);
  const controls = useAnimationControls();
  const leaving = useRef(false);

  // Karar animasyonun bitmesini beklemez: yavaş cihazda ya da arka plandaki
  // sekmede animasyon duraksa bile sıradaki kart gelir.
  const fly = (dir) => {
    if (leaving.current) return;
    leaving.current = true;
    controls.start({ x: dir * 380, opacity: 0, transition: { duration: 0.28, ease: EASE_OUT } });
    setTimeout(() => onDecide(person, dir), 260);
  };

  // Alttaki kart en üste geçince tam boyutuna gelsin
  useEffect(() => {
    if (isTop) controls.start({ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', duration: 0.45, bounce: 0.15 } });
  }, [isTop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isTop && command) fly(command.dir);
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  // İlk görüşte kartın kaydırılabildiğini göstermek için küçük bir sallanma
  useEffect(() => {
    if (isTop && nudge) {
      controls.start({ x: [0, 34, -22, 0], transition: { duration: 1.1, ease: 'easeInOut' } });
    }
  }, [nudge]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className={`absolute inset-0 overflow-hidden rounded-[1.5rem] border border-line bg-surface ${isTop ? 'cursor-grab shadow-2xl active:cursor-grabbing' : ''}`}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={false}
      animate={isTop ? controls : { scale: 1 - depth * 0.045, y: depth * 9, opacity: depth > 2 ? 0 : 1 }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 520) fly(info.offset.x > 0 ? 1 : -1);
      }}
      aria-hidden={!isTop}
    >
      <div className="relative h-[200px] w-full" style={{ background: `linear-gradient(160deg, ${person.from}55, var(--color-surface-2) 55%, ${person.to}40)` }}>
        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          <Avatar person={person} size={84} ring />
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-surface/85 px-2.5 py-1 text-[9.5px] font-semibold text-teal backdrop-blur">
          <BadgeCheck size={11} /> {t('Doğrulanmış')}
        </div>
        {isTop && (
          <>
            <motion.div style={{ opacity: likeOpacity }} className="absolute right-3 top-3 rounded-lg border-2 border-teal px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-teal [transform:rotate(12deg)]">
              {t('BEĞEN')}
            </motion.div>
            <motion.div style={{ opacity: nopeOpacity }} className="absolute left-3 top-10 rounded-lg border-2 border-coral px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-coral [transform:rotate(-12deg)]">
              {t('GEÇ')}
            </motion.div>
          </>
        )}
      </div>
      <div className="px-4 pb-3 pt-3">
        <p className="text-[15px] font-bold text-paper">
          {person.name}, {person.age}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-paper-muted">
          <GraduationCap size={11} /> {t(person.dept)}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {person.tags.map((tag, i) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${i === 0 ? 'bg-teal/15 text-teal' : i === 1 ? 'bg-amber/15 text-amber-soft' : 'bg-surface-3 text-paper'}`}
            >
              {t(tag)}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CardsScreen({ deck, onDecide, onReset, nudge }) {
  const { t } = useI18n();
  const [command, setCommand] = useState(null);
  const top = deck[0];
  // Komut bir kez kullanılır; yoksa yerine gelen kart da aynı komutla atılırdı
  const decide = (person, dir) => {
    setCommand(null);
    onDecide(person, dir);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative mx-4 h-[292px]">
        {deck.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-line px-6 text-center">
            <p className="text-[13px] font-bold text-paper">{t('Şimdilik herkesi gördün')}</p>
            <p className="mt-1 text-[10.5px] text-paper-muted">{t('Kampüsüne yeni öğrenciler katıldıkça burada görünecek.')}</p>
            <button type="button" onClick={onReset} className="mt-4 flex min-h-[36px] items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[11px] font-semibold text-paper">
              <RotateCcw size={12} /> {t('Baştan başla')}
            </button>
          </div>
        ) : (
          deck
            .slice(0, 3)
            .map((p, i) => <SwipeCard key={p.id} person={p} isTop={i === 0} depth={i} command={i === 0 ? command : null} onDecide={decide} nudge={i === 0 && nudge} />)
            .reverse()
        )}
      </div>
      <div className="mt-3 flex items-center justify-center gap-5">
        <button
          type="button"
          disabled={!top}
          onClick={() => setCommand({ dir: -1, n: Date.now() })}
          aria-label={t('Geç')}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-coral/50 bg-coral/10 text-coral transition-transform active:scale-90 disabled:opacity-40"
        >
          <X size={18} strokeWidth={2.6} />
        </button>
        <button
          type="button"
          disabled={!top}
          onClick={() => setCommand({ dir: 1, n: Date.now() })}
          aria-label={t('Beğen')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#e0835a] to-[#b04d24] text-[#fffaf5] shadow-[0_10px_24px_-8px_rgba(199,91,48,0.9)] transition-transform active:scale-90 disabled:opacity-40"
        >
          <Heart size={19} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}

function ClubsScreen({ joined, onToggle }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2.5 px-3">
      {CLUBS.map((c) => {
        const on = joined.includes(c.id);
        return (
          <div key={c.id} className="flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] text-white" style={{ background: c.tone }}>
              <Users size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold text-paper">{t(c.name)}</p>
              <p className="flex items-center gap-1 text-[9.5px] text-paper-muted">
                <CalendarDays size={10} /> {t(c.when)} · {c.members + (on ? 1 : 0)} {t('üye')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggle(c.id)}
              aria-pressed={on}
              className={`flex min-h-[30px] items-center gap-1 rounded-full px-3 text-[10px] font-bold transition-colors ${on ? 'bg-teal/15 text-teal' : 'bg-paper text-ink'}`}
            >
              {on ? (
                <>
                  <Check size={11} /> {t('Üyesin')}
                </>
              ) : (
                t('Katıl')
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MatchesScreen({ matches, onOpenChat, goCards }) {
  const { t } = useI18n();
  if (!matches.length) {
    return (
      <div className="mx-4 flex h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-line px-6 text-center">
        <Heart size={22} className="text-amber-soft" />
        <p className="mt-2 text-[13px] font-bold text-paper">{t('Henüz eşleşme yok')}</p>
        <p className="mt-1 text-[10.5px] text-paper-muted">{t('Kart Modu’nda beğendiğin kişi de seni beğenirse burada görünür.')}</p>
        <button type="button" onClick={goCards} className="mt-4 min-h-[36px] rounded-full bg-paper px-3.5 text-[11px] font-bold text-ink">
          {t('Kartlara dön')}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2.5 px-3">
      {matches.map((p) => (
        <button key={p.id} type="button" onClick={() => onOpenChat(p)} className="flex w-full items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5 text-left">
          <Avatar person={p} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-paper">
              {p.name}, {p.age}
            </span>
            <span className="block truncate text-[9.5px] text-paper-muted">{t('Yeni eşleşme, ilk mesajı sen at')}</span>
          </span>
          <MessageCircle size={15} className="text-amber-soft" />
        </button>
      ))}
    </div>
  );
}

function ChatScreen({ person, messages, onSend, goMatches }) {
  const { t } = useI18n();
  if (!person) {
    return (
      <div className="mx-4 flex h-[260px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-line px-6 text-center">
        <MessageCircle size={22} className="text-amber-soft" />
        <p className="mt-2 text-[13px] font-bold text-paper">{t('Mesajın yok')}</p>
        <p className="mt-1 text-[10.5px] text-paper-muted">{t('Eşleştiğin kişilerle buradan konuşursun.')}</p>
        <button type="button" onClick={goMatches} className="mt-4 min-h-[36px] rounded-full bg-paper px-3.5 text-[11px] font-bold text-ink">
          {t('Eşleşmelere git')}
        </button>
      </div>
    );
  }
  return (
    <div className="flex h-[330px] flex-col px-3">
      <div className="flex items-center gap-2 pb-2">
        <Avatar person={person} size={28} />
        <span className="text-[12px] font-bold text-paper">{person.name}</span>
        <span className="ml-auto text-[9px] font-semibold text-teal">{t('çevrimiçi')}</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.p
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={`max-w-[78%] rounded-[0.9rem] px-2.5 py-1.5 text-[10.5px] leading-snug ${m.mine ? 'self-end bg-gradient-to-br from-[#e0835a] to-[#c75b30] text-white' : 'self-start bg-surface-2 text-paper'}`}
            >
              {m.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" onClick={() => onSend(t(q))} className="flex min-h-[28px] items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[9.5px] font-semibold text-paper">
            <Send size={9} /> {t(q)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({ likes, joined }) {
  const { t } = useI18n();
  const r = 26;
  const c = 2 * Math.PI * r;
  const score = Math.min(100, 60 + likes * 5 + joined * 10);
  return (
    <div className="px-3">
      <div className="flex flex-col items-center rounded-[1.2rem] border border-line bg-surface px-4 py-4 text-center">
        <Avatar person={{ initials: 'SEN', from: '#f2c4a8', to: '#c75b30' }} size={64} />
        <p className="mt-2 text-[14px] font-bold text-paper">{t('Sen, 20')}</p>
        <p className="text-[10px] text-paper-muted">{t('İstanbul Teknik Üniversitesi')}</p>
        <span className="mt-2 flex items-center gap-1 rounded-full bg-teal/15 px-2 py-0.5 text-[9px] font-semibold text-teal">
          <BadgeCheck size={10} /> {t('Okul e-postası doğrulandı')}
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-3 rounded-[1.2rem] border border-line bg-surface p-3">
        <svg width="62" height="62" viewBox="0 0 62 62" className="-rotate-90" aria-hidden="true">
          <circle cx="31" cy="31" r={r} fill="none" strokeWidth="6" className="stroke-surface-3" />
          <motion.circle
            cx="31"
            cy="31"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke="#c75b30"
            strokeDasharray={c}
            animate={{ strokeDashoffset: c - (score / 100) * c }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        </svg>
        <div>
          <p className="text-[18px] font-bold text-paper">%{score}</p>
          <p className="text-[10px] text-paper-muted">{t('Profil gücü: beğendikçe ve kulübe katıldıkça artar')}</p>
        </div>
      </div>
    </div>
  );
}

export default function PhoneMockup({ className = '' }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const inView = useInView(rootRef, { once: true, amount: 0.6 });

  const [tab, setTab] = useState('cards');
  const [deck, setDeck] = useState(PEOPLE);
  const [matches, setMatches] = useState([]);
  const [likes, setLikes] = useState(0);
  const [joined, setJoined] = useState([]);
  const [chatWith, setChatWith] = useState(null);
  const [messages, setMessages] = useState({});
  const [toast, setToast] = useState(null);
  const [interacted, setInteracted] = useState(false);
  const [nudge, setNudge] = useState(false);

  // Görünür olunca bir kez kartı hafifçe salla (kullanıcı henüz dokunmadıysa)
  useEffect(() => {
    if (!inView || reduce) return undefined;
    const id = setTimeout(() => setNudge(true), 1400);
    return () => clearTimeout(id);
  }, [inView, reduce]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  function decide(person, dir) {
    setInteracted(true);
    setDeck((d) => d.filter((p) => p.id !== person.id));
    if (dir > 0) {
      setLikes((n) => n + 1);
      if (person.likesYou) {
        setMatches((m) => [person, ...m]);
        setMessages((all) => ({ ...all, [person.id]: [{ id: 1, mine: false, text: t('Selam! Profilinde kahve yazıyordu, öneri var mı?') }] }));
        setToast(person);
      }
    }
  }

  function openChat(person) {
    setChatWith(person);
    setTab('chat');
    setToast(null);
  }

  function send(text) {
    if (!chatWith) return;
    setMessages((all) => {
      const list = all[chatWith.id] || [];
      return { ...all, [chatWith.id]: [...list, { id: list.length + 1, mine: true, text }].slice(-5) };
    });
  }

  const current = TABS.find((x) => x.key === tab);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className={`relative mx-auto w-[288px] select-none sm:w-[300px] ${className}`}
      onPointerDown={() => setInteracted(true)}
    >
      {/* Kullanıcı dokununca süzülme durur; sürüklerken telefon kaymasın */}
      <div className={interacted ? '' : 'landing-float-slow'}>
        <div className="relative rounded-[3rem] bg-gradient-to-b from-[#3a4152] via-[#1b202b] to-[#0e1117] p-[3px] shadow-[0_50px_100px_-25px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)]">
          <div className="rounded-[2.85rem] bg-black p-[9px]">
            <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-[#1b202b]" />
            <span className="absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-[#1b202b]" />
            <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#1b202b]" />

            {/* ekran */}
            <div className="relative h-[580px] w-full overflow-hidden rounded-[2.3rem] bg-ink" role="group" aria-label={t('kampüs· uygulama önizlemesi')}>
              <div className="pointer-events-none absolute -left-16 -top-10 h-56 w-56 rounded-full bg-[#5f7fa6]/20 blur-3xl" />
              <div className="pointer-events-none absolute -right-20 top-40 h-56 w-56 rounded-full bg-[#c75b30]/15 blur-3xl" />

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

              {/* başlık */}
              <div className="relative z-20 mx-3 mt-4 flex items-center gap-2.5 rounded-[1.1rem] border border-line bg-surface/75 px-3 py-2.5 backdrop-blur-xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-gradient-to-br from-[#d0653a] to-[#b04d24] text-[#fffaf5]">
                  <current.icon size={16} strokeWidth={2.4} />
                </span>
                <div className="leading-tight">
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#7f97b5]">{t('İstanbul Teknik Üni.')}</p>
                  <p className="text-[14px] font-bold text-paper">{t(current.title)}</p>
                </div>
                <span className="relative ml-auto flex h-7 w-7 items-center justify-center rounded-[0.55rem] border border-line bg-surface-2">
                  <Bell size={12} className="text-paper" />
                  {matches.length > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral ring-2 ring-ink" />}
                </span>
              </div>

              {/* ekran içeriği */}
              <div className="relative z-20 mt-4">
                {/* Ekran değişince yeni ekran hafifçe yukarı süzülerek gelir (çıkışı beklenmez) */}
                <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
                    {tab === 'cards' && <CardsScreen deck={deck} onDecide={decide} onReset={() => setDeck(PEOPLE.filter((p) => !matches.some((m) => m.id === p.id)))} nudge={nudge && !interacted} />}
                    {tab === 'clubs' && <ClubsScreen joined={joined} onToggle={(id) => setJoined((j) => (j.includes(id) ? j.filter((x) => x !== id) : [...j, id]))} />}
                    {tab === 'matches' && <MatchesScreen matches={matches} onOpenChat={openChat} goCards={() => setTab('cards')} />}
                    {tab === 'chat' && <ChatScreen person={chatWith || matches[0] || null} messages={messages[(chatWith || matches[0])?.id] || []} onSend={(text) => { if (!chatWith) setChatWith(matches[0]); send(text); }} goMatches={() => setTab('matches')} />}
                    {tab === 'profile' && <ProfileScreen likes={likes} joined={joined.length} />}
                </motion.div>
              </div>

              {/* eşleşme bildirimi */}
              <AnimatePresence>
                {toast && (
                  <motion.button
                    type="button"
                    onClick={() => openChat(toast)}
                    initial={{ opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                    className="absolute inset-x-3 top-[54px] z-40 flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface/95 p-2.5 text-left shadow-xl backdrop-blur-xl"
                  >
                    <Avatar person={toast} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-bold text-paper">{t('{name} ile eşleştin!', { name: toast.name })}</span>
                      <span className="block text-[9.5px] text-paper-muted">{t('Dokun, ilk mesajı gönder')}</span>
                    </span>
                    <MessageCircle size={15} className="text-amber-soft" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* alt menü */}
              <nav className="absolute inset-x-0 bottom-4 z-30 flex justify-center" aria-label={t('Önizleme menüsü')}>
                <div className="flex items-center gap-0.5 rounded-[1.2rem] border border-line bg-surface/85 p-1 shadow-lg backdrop-blur-xl">
                  {TABS.map((item) => {
                    const on = item.key === tab;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTab(item.key)}
                        aria-label={t(item.label)}
                        aria-current={on ? 'page' : undefined}
                        className={`relative flex min-h-[32px] items-center gap-1 rounded-[0.9rem] px-2 text-[9.5px] font-extrabold transition-[background-color,color] duration-200 ${on ? 'bg-gradient-to-br from-[#eaa07e] to-[#d0653a] text-[#0d0f14]' : 'text-paper-muted hover:text-paper'}`}
                      >
                        <item.icon size={14} strokeWidth={on ? 2.4 : 2} className="relative" />
                        {on && <span className="relative">{t(item.label)}</span>}
                        {item.key === 'matches' && matches.length > 0 && !on && (
                          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-coral" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/[0.07] via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[0.75rem] text-paper-faint">{t('Dene: kartı sağa kaydır, alttaki menüde gezin.')}</p>
    </motion.div>
  );
}
