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
  ArrowRight,
  BadgeCheck,
  BatteryFull,
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Heart,
  Layers,
  LayoutGrid,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Signal,
  SlidersHorizontal,
  User,
  UserPlus,
  Users,
  Wifi,
} from 'lucide-react';
import { useI18n } from '../../i18n';

// Ana sayfadaki telefon: uygulamanın gerçek ekranlarının küçük, dokunulabilen
// bir kopyası. Menü, başlıklar, kart yapısı ve renkler uygulamayla aynıdır
// (bkz. NavBar, PageHeader, SwipeDiscoverPage). Hiçbir veri sunucuya gitmez.

const EASE_OUT = [0.23, 1, 0.32, 1];
const UNI = 'Hatay Mustafa Kemal Üni.';

const PEOPLE = [
  { id: 'elif', name: 'Elif Yıldız', age: 21, dept: 'Bilgisayar Müh.', year: '3. Sınıf', initials: 'EY', tone: '#b9d6f7', intents: ['Arkadaşlık', 'Çalışma Arkadaşı'], likesYou: true },
  { id: 'can', name: 'Can Aydın', age: 22, dept: 'Mimarlık', year: '4. Sınıf', initials: 'CA', tone: '#ffd6a5', intents: ['Spor Arkadaşı'], likesYou: false },
  { id: 'deniz', name: 'Deniz Kara', age: 20, dept: 'Psikoloji', year: '2. Sınıf', initials: 'DK', tone: '#a7e3b5', intents: ['Arkadaşlık', 'Bir Kahve'], likesYou: true },
  { id: 'mert', name: 'Mert Tunç', age: 23, dept: 'Endüstri Müh.', year: '4. Sınıf', initials: 'MT', tone: '#c6c5f2', intents: ['Proje Ortağı'], likesYou: false },
];

// Uygulamadaki alt menüyle aynı sıra, simge ve adlar
const TABS = [
  { key: 'discover', icon: Compass, label: 'Keşfet' },
  { key: 'cards', icon: Layers, label: 'Kart Modu' },
  { key: 'feed', icon: LayoutGrid, label: 'Akış' },
  { key: 'clubs', icon: Users, label: 'Kulüpler' },
  { key: 'chat', icon: MessageCircle, label: 'Sohbet' },
  { key: 'profile', icon: User, label: 'Profil' },
];

// Her ekranın başlığı (PageHeader ile aynı düzen)
const HEADERS = {
  discover: { icon: Compass, eyebrow: UNI, title: 'Keşfet', actions: ['bell', 'filter'] },
  cards: { icon: Layers, eyebrow: 'Sağa kaydır: beğen · Sola: geç', title: 'Kart Modu', back: true },
  feed: { icon: LayoutGrid, eyebrow: UNI, title: 'Akış', actions: ['bell'] },
  clubs: { icon: Users, eyebrow: UNI, title: 'Kulüpler' },
  chat: { icon: MessageCircle, eyebrow: 'Eşleşmelerin', title: 'Sohbet' },
  profile: { icon: User, eyebrow: 'Hesabın', title: 'Profilim', actions: ['bell'] },
};

const CLUBS = [
  { id: 1, name: 'Satranç Kulübü', category: 'Akademik', members: 64, tone: '#5856d6' },
  { id: 2, name: 'Fotoğrafçılık', category: 'Sanat', members: 112, tone: '#ff375f' },
  { id: 3, name: 'Koşu Topluluğu', category: 'Spor', members: 87, tone: '#34c759' },
];

const QUICK_REPLIES = ['Selam! Kahve?', 'Hangi dersleri alıyorsun?', 'Kulübe gelsene'];

const INTENT_TONE = { 'Arkadaşlık': 'bg-teal/15 text-teal', 'Çalışma Arkadaşı': 'bg-amber-soft/12 text-amber-soft' };

function Avatar({ person, size = 40, ring = false }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-[#1d1d1f] ${ring ? 'ring-[3px] ring-amber-soft' : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.34, background: person.tone }}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

function IconButton({ children, badge }) {
  return (
    <span className="relative flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-surface-2 text-paper">
      {children}
      {badge ? <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-coral px-0.5 text-[7px] font-bold text-white">{badge}</span> : null}
    </span>
  );
}

function Header({ tab, matches }) {
  const { t } = useI18n();
  const h = HEADERS[tab];
  return (
    <div className="relative z-20 mx-3 mt-3 flex items-center gap-2 rounded-[1.1rem] border border-line bg-surface/90 px-2.5 py-2 backdrop-blur-xl">
      {h.back && (
        <span className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-surface-2 text-paper">
          <ChevronLeft size={14} />
        </span>
      )}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] bg-amber-soft text-white">
        <h.icon size={15} strokeWidth={2.3} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[7.5px] font-bold uppercase tracking-[0.12em] text-amber-soft">{t(h.eyebrow)}</p>
        <p className="text-[14px] font-bold text-paper">{t(h.title)}</p>
      </div>
      <div className="ml-auto flex gap-1.5">
        {h.actions?.includes('bell') && (
          <IconButton badge={matches.length || null}>
            <Bell size={12} />
          </IconButton>
        )}
        {h.actions?.includes('filter') && (
          <IconButton>
            <SlidersHorizontal size={12} />
          </IconButton>
        )}
      </div>
    </div>
  );
}

// Kart Modu: uygulamadaki kart (fotoğraf, ad + yaş, Takip Et, bilgi kutusu,
// ne arıyor etiketleri, Geç / Beğen). Sürüklenebilir.
function SwipeCard({ person, isTop, depth, command, onDecide, nudge }) {
  const { t } = useI18n();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-12, 12]);
  const likeOpacity = useTransform(x, [16, 90], [0, 1]);
  const nopeOpacity = useTransform(x, [-90, -16], [1, 0]);
  const controls = useAnimationControls();
  const leaving = useRef(false);

  // Karar animasyonun bitmesini beklemez (yavaş cihazda takılmasın)
  const fly = (dir) => {
    if (leaving.current) return;
    leaving.current = true;
    controls.start({ x: dir * 380, opacity: 0, transition: { duration: 0.28, ease: EASE_OUT } });
    setTimeout(() => onDecide(person, dir), 260);
  };

  useEffect(() => {
    if (isTop) controls.start({ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', duration: 0.45, bounce: 0.15 } });
  }, [isTop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isTop && command) fly(command.dir);
  }, [command]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isTop && nudge) controls.start({ x: [0, 34, -22, 0], transition: { duration: 1.1, ease: 'easeInOut' } });
  }, [nudge]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      className={`absolute inset-x-0 top-0 overflow-hidden rounded-[1.3rem] border border-line bg-surface ${isTop ? 'cursor-grab shadow-xl active:cursor-grabbing' : ''}`}
      style={{ x, rotate, zIndex: 10 - depth }}
      initial={false}
      animate={isTop ? controls : { scale: 1 - depth * 0.04, y: depth * 8, opacity: depth > 1 ? 0 : 1 }}
      transition={{ type: 'spring', duration: 0.45, bounce: 0.15 }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 520) fly(info.offset.x > 0 ? 1 : -1);
      }}
      aria-hidden={!isTop}
    >
      {/* fotoğraf alanı */}
      <div className="relative h-[168px]" style={{ background: person.tone }}>
        <div className="absolute inset-x-2.5 top-2 flex gap-1">
          <span className="h-[3px] flex-1 rounded-full bg-white" />
          <span className="h-[3px] flex-1 rounded-full bg-white/45" />
        </div>
        <span className="absolute right-2.5 top-3.5 rounded-full bg-black/35 px-1.5 text-[8px] font-semibold text-white">1/2</span>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[44px] font-bold text-[#1d1d1f]/70">{person.initials}</span>
        {isTop && (
          <>
            <motion.span style={{ opacity: likeOpacity }} className="absolute left-3 top-8 rounded-lg border-2 border-teal bg-white/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-teal [transform:rotate(-10deg)]">
              {t('BEĞEN')}
            </motion.span>
            <motion.span style={{ opacity: nopeOpacity }} className="absolute right-3 top-8 rounded-lg border-2 border-coral bg-white/80 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-coral [transform:rotate(10deg)]">
              {t('GEÇ')}
            </motion.span>
          </>
        )}
      </div>

      {/* bilgi paneli */}
      <div className="px-3 pb-3 pt-2.5">
        <div className="flex items-start gap-1.5">
          <p className="flex items-center gap-1 text-[14px] font-bold leading-tight text-paper">
            {person.name} <BadgeCheck size={13} className="text-amber-soft" aria-label={t('Onaylı öğrenci')} />
          </p>
          <span className="text-[12px] text-paper-muted">{person.age}</span>
          <span className="ml-auto flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[8.5px] font-semibold text-paper">
            <UserPlus size={9} /> {t('Takip Et')}
          </span>
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line text-paper-muted">
            <Flag size={8} />
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 rounded-[0.8rem] bg-surface-2 px-2.5 py-2">
          <div>
            <dt className="text-[7px] font-bold uppercase tracking-wider text-paper-faint">{t('Bölüm')}</dt>
            <dd className="text-[9.5px] font-semibold text-paper">{t(person.dept)}</dd>
          </div>
          <div>
            <dt className="text-[7px] font-bold uppercase tracking-wider text-paper-faint">{t('Sınıf')}</dt>
            <dd className="text-[9.5px] font-semibold text-paper">{t(person.year)}</dd>
          </div>
        </dl>
        <div className="mt-2 flex flex-wrap gap-1">
          {person.intents.map((i) => (
            <span key={i} className={`rounded-full px-2 py-0.5 text-[8.5px] font-semibold ${INTENT_TONE[i] || 'bg-surface-2 text-paper'}`}>
              {t(i)}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CardsScreen({ deck, likesCount, onDecide, onReset, nudge }) {
  const { t } = useI18n();
  const [command, setCommand] = useState(null);
  const top = deck[0];
  // Komut bir kez kullanılır; yoksa yerine gelen kart da aynı komutla atılırdı
  const decide = (person, dir) => {
    setCommand(null);
    onDecide(person, dir);
  };

  return (
    <div className="px-3">
      <div className="mb-2 flex items-center gap-2 rounded-[0.9rem] border border-line bg-surface px-2.5 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-[0.5rem] bg-amber-soft text-white">
          <Heart size={11} fill="currentColor" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-bold text-paper">{t('{n} kişi seni beğendi', { n: likesCount })}</span>
          <span className="block text-[8px] text-paper-muted">{t('Premium ile kim olduklarını gör')}</span>
        </span>
        <ChevronRight size={12} className="text-paper-faint" />
      </div>

      <div className="relative h-[300px]">
        {deck.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[1.3rem] border border-line bg-surface px-6 text-center">
            <p className="text-[12px] font-bold text-paper">{t('Şu an gösterilecek kimse kalmadı.')}</p>
            <p className="mt-1 text-[9.5px] text-paper-muted">{t('Kampüsüne yeni öğrenciler katıldıkça burada görünecek.')}</p>
            <button type="button" onClick={onReset} className="mt-3 flex min-h-[34px] items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[10px] font-semibold text-paper">
              <RotateCcw size={11} /> {t('Baştan başla')}
            </button>
          </div>
        ) : (
          deck
            .slice(0, 2)
            .map((p, i) => <SwipeCard key={p.id} person={p} isTop={i === 0} depth={i} command={i === 0 ? command : null} onDecide={decide} nudge={i === 0 && nudge} />)
            .reverse()
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!top}
          onClick={() => setCommand({ dir: -1, n: Date.now() })}
          className="min-h-[34px] rounded-[0.8rem] border border-coral/45 bg-coral/10 text-[11px] font-bold text-coral transition-transform active:scale-95 disabled:opacity-40"
        >
          {t('Geç')}
        </button>
        <button
          type="button"
          disabled={!top}
          onClick={() => setCommand({ dir: 1, n: Date.now() })}
          className="min-h-[34px] rounded-[0.8rem] bg-amber-soft text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          {t('Beğen')}
        </button>
      </div>
    </div>
  );
}

// Keşfet: arama, Kart Modu kutusu, beğeni ve kulüp sayıları, önerilen kişiler
function DiscoverScreen({ deck, likesCount, joined, goCards }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 px-3">
      <div className="flex items-center gap-1.5 rounded-[0.8rem] bg-surface-2 px-2.5 py-2 text-[9.5px] text-paper-faint">
        <Search size={11} /> {t('Kişi, bölüm veya kulüp ara...')}
      </div>
      <div className="grid grid-cols-[1.25fr_1fr] gap-2">
        <button type="button" onClick={goCards} className="flex flex-col rounded-[1rem] bg-amber-soft p-2.5 text-left text-white">
          <span className="flex w-fit items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider">
            <Layers size={8} /> {t('Kart Modu')}
          </span>
          <span className="mt-1.5 text-[13px] font-bold leading-tight">{t('Sağa kaydır, eşleş.')}</span>
          <span className="mt-0.5 text-[8.5px] text-white/80">{deck.length ? t('Sırada {n} kişi seni bekliyor', { n: deck.length }) : t('Şimdilik herkesi gördün')}</span>
          <span className="mt-2.5 flex w-fit items-center gap-1 rounded-full bg-white px-2 py-1 text-[8.5px] font-bold text-amber-soft">
            {t('Kaydırmaya başla')} <ArrowRight size={9} />
          </span>
        </button>
        <div className="grid gap-2">
          <div className="rounded-[1rem] border border-line bg-surface p-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[0.45rem] bg-coral/12 text-coral">
              <Heart size={10} fill="currentColor" />
            </span>
            <p className="mt-1 text-[14px] font-bold leading-none text-paper">{likesCount}</p>
            <p className="text-[7.5px] text-paper-muted">{t('kişi seni beğendi')}</p>
          </div>
          <div className="rounded-[1rem] border border-line bg-surface p-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[0.45rem] bg-teal/15 text-teal">
              <Users size={10} />
            </span>
            <p className="mt-1 text-[14px] font-bold leading-none text-paper">{joined}</p>
            <p className="text-[7.5px] text-paper-muted">{t('kulübün var')}</p>
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 pt-1 text-[10px] font-bold text-paper">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-soft" /> {t('Önerilen Kişiler')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PEOPLE.slice(0, 2).map((p) => (
          <div key={p.id} className="flex flex-col items-center rounded-[1rem] border border-line bg-surface px-2 pb-2 pt-2.5 text-center">
            <Avatar person={p} size={40} ring />
            <p className="mt-1.5 text-[9.5px] font-bold text-paper">{p.name}</p>
            <p className="text-[7.5px] text-paper-muted">{t(p.dept)}</p>
            <span className="mt-1.5 w-full rounded-[0.6rem] bg-amber-soft py-1 text-[8.5px] font-bold text-white">{t('Takip Et')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedScreen() {
  const { t } = useI18n();
  const [liked, setLiked] = useState(false);
  return (
    <div className="space-y-2 px-3">
      <div className="flex rounded-[0.8rem] bg-surface-2 p-0.5 text-[9px] font-semibold">
        <span className="flex-1 rounded-[0.65rem] bg-surface py-1 text-center text-paper shadow-sm">{t('Kampüs')}</span>
        <span className="flex-1 py-1 text-center text-paper-muted">{t('Takip')}</span>
      </div>
      <div className="flex items-center gap-2 rounded-[1rem] border border-line bg-surface px-2.5 py-2">
        <Avatar person={{ initials: 'SN', tone: '#ffd6a5' }} size={24} />
        <span className="text-[9.5px] text-paper-faint">{t('Neler oluyor?')}</span>
      </div>
      <article className="rounded-[1rem] border border-line bg-surface p-2.5">
        <div className="flex items-center gap-2">
          <Avatar person={PEOPLE[2]} size={26} />
          <div className="leading-tight">
            <p className="text-[10px] font-bold text-paper">{PEOPLE[2].name}</p>
            <p className="text-[7.5px] text-paper-muted">{t('Psikoloji')} · 2 sa</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-paper">{t('Bu akşam kütüphanede final çalışması yapacak olan var mı? 2. kattayım, yer ayırabilirim.')}</p>
        <div className="mt-2 flex items-center gap-3 text-[9px] text-paper-muted">
          <button type="button" onClick={() => setLiked((v) => !v)} aria-pressed={liked} className={`flex min-h-[28px] items-center gap-1 ${liked ? 'text-coral' : ''}`}>
            <Heart size={12} fill={liked ? 'currentColor' : 'none'} /> {12 + (liked ? 1 : 0)}
          </button>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} /> 4
          </span>
        </div>
      </article>
    </div>
  );
}

function ClubsScreen({ joined, onToggle }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 px-3">
      {CLUBS.map((c) => {
        const on = joined.includes(c.id);
        return (
          <div key={c.id} className="flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] text-white" style={{ background: c.tone }}>
              <Users size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-bold text-paper">{t(c.name)}</p>
              <p className="text-[8.5px] text-paper-muted">
                {t(c.category)} · {c.members + (on ? 1 : 0)} {t('üye')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onToggle(c.id)}
              aria-pressed={on}
              className={`min-h-[30px] rounded-full px-3 text-[9.5px] font-bold transition-colors ${on ? 'bg-teal/15 text-teal' : 'bg-amber-soft text-white'}`}
            >
              {on ? t('Üyesin') : t('Katıl')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ChatScreen({ matches, active, messages, onOpen, onBack, onSend, goCards }) {
  const { t } = useI18n();
  if (!matches.length) {
    return (
      <div className="mx-3 flex h-[300px] flex-col items-center justify-center rounded-[1.3rem] border border-line bg-surface px-6 text-center">
        <MessageCircle size={20} className="text-amber-soft" />
        <p className="mt-2 text-[12px] font-bold text-paper">{t('Henüz eşleşme yok')}</p>
        <p className="mt-1 text-[9.5px] text-paper-muted">{t('Kart Modu’nda beğendiğin kişi de seni beğenirse burada görünür.')}</p>
        <button type="button" onClick={goCards} className="mt-3 min-h-[34px] rounded-full bg-amber-soft px-3.5 text-[10px] font-bold text-white">
          {t('Kartlara dön')}
        </button>
      </div>
    );
  }
  if (!active) {
    return (
      <div className="space-y-2 px-3">
        {matches.map((p) => (
          <button key={p.id} type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5 text-left">
            <Avatar person={p} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold text-paper">{p.name}</span>
              <span className="block truncate text-[8.5px] text-paper-muted">{(messages[p.id] || []).slice(-1)[0]?.text}</span>
            </span>
            <span className="h-2 w-2 rounded-full bg-amber-soft" />
          </button>
        ))}
      </div>
    );
  }
  const list = messages[active.id] || [];
  return (
    <div className="flex h-[360px] flex-col px-3">
      <div className="flex items-center gap-2 pb-2">
        <button type="button" onClick={onBack} aria-label={t('Geri')} className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-surface-2 text-paper">
          <ChevronLeft size={13} />
        </button>
        <Avatar person={active} size={26} />
        <span className="text-[11px] font-bold text-paper">{active.name}</span>
        <span className="ml-auto text-[8px] font-semibold text-teal">{t('çevrimiçi')}</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((m) => (
            <motion.p
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={`max-w-[78%] rounded-[0.9rem] px-2.5 py-1.5 text-[10px] leading-snug ${m.mine ? 'self-end bg-amber-soft text-white' : 'self-start bg-surface-2 text-paper'}`}
            >
              {m.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" onClick={() => onSend(t(q))} className="flex min-h-[28px] items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-[9px] font-semibold text-paper">
            <Send size={9} /> {t(q)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({ likes, joined }) {
  const { t } = useI18n();
  const r = 22;
  const c = 2 * Math.PI * r;
  const score = Math.min(100, 60 + likes * 5 + joined * 10);
  return (
    <div className="space-y-2 px-3">
      <div className="flex flex-col items-center rounded-[1.2rem] border border-line bg-surface px-4 py-3.5 text-center">
        <Avatar person={{ initials: 'SN', tone: '#ffd6a5' }} size={58} ring />
        <p className="mt-2 text-[13px] font-bold text-paper">{t('Sen, 20')}</p>
        <p className="text-[9px] text-paper-muted">{t('Hatay Mustafa Kemal Üniversitesi')}</p>
        <span className="mt-1.5 rounded-full border border-line px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-wider text-paper-muted">{t('E-posta doğrulandı')}</span>
      </div>
      <div className="flex items-center gap-3 rounded-[1.2rem] border border-line bg-surface p-3">
        <svg width="54" height="54" viewBox="0 0 54 54" className="-rotate-90" aria-hidden="true">
          <circle cx="27" cy="27" r={r} fill="none" strokeWidth="5" className="stroke-surface-3" />
          <motion.circle
            cx="27"
            cy="27"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke="var(--amber-soft)"
            strokeDasharray={c}
            animate={{ strokeDashoffset: c - (score / 100) * c }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        </svg>
        <div>
          <p className="text-[12px] font-bold text-paper">{t('Profilini tamamla')}</p>
          <p className="text-[9px] text-paper-muted">%{score} · {t('beğendikçe ve kulübe katıldıkça artar')}</p>
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

  const likesCount = PEOPLE.filter((p) => p.likesYou).length;

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
        <div className="relative rounded-[3rem] bg-[#1d1d1f] p-[3px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.45)]">
          <div className="rounded-[2.85rem] bg-black p-[9px]">
            <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-[#2c2c2e]" />
            <span className="absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-[#2c2c2e]" />
            <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#2c2c2e]" />

            <div className="relative h-[600px] w-full overflow-hidden rounded-[2.3rem] bg-ink" role="group" aria-label={t('kampüs· uygulama önizlemesi')}>
              <div className="absolute left-1/2 top-2.5 z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />

              <div className="relative z-20 flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-paper">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <Signal size={12} />
                  <Wifi size={12} />
                  <BatteryFull size={14} />
                </div>
              </div>

              <Header tab={tab} matches={matches} />

              <div className="relative z-20 mt-2.5">
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
                  {tab === 'discover' && <DiscoverScreen deck={deck} likesCount={likesCount} joined={joined.length} goCards={() => setTab('cards')} />}
                  {tab === 'cards' && (
                    <CardsScreen
                      deck={deck}
                      likesCount={likesCount}
                      onDecide={decide}
                      onReset={() => setDeck(PEOPLE.filter((p) => !matches.some((m) => m.id === p.id)))}
                      nudge={nudge && !interacted}
                    />
                  )}
                  {tab === 'feed' && <FeedScreen />}
                  {tab === 'clubs' && <ClubsScreen joined={joined} onToggle={(id) => setJoined((j) => (j.includes(id) ? j.filter((x) => x !== id) : [...j, id]))} />}
                  {tab === 'chat' && (
                    <ChatScreen
                      matches={matches}
                      active={chatWith}
                      messages={messages}
                      onOpen={setChatWith}
                      onBack={() => setChatWith(null)}
                      onSend={send}
                      goCards={() => setTab('cards')}
                    />
                  )}
                  {tab === 'profile' && <ProfileScreen likes={likes} joined={joined.length} />}
                </motion.div>
              </div>

              <AnimatePresence>
                {toast && (
                  <motion.button
                    type="button"
                    onClick={() => openChat(toast)}
                    initial={{ opacity: 0, y: -14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                    className="absolute inset-x-3 top-[52px] z-40 flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5 text-left shadow-xl"
                  >
                    <Avatar person={toast} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-paper">{t('{name} ile eşleştin!', { name: toast.name.split(' ')[0] })}</span>
                      <span className="block text-[9px] text-paper-muted">{t('Dokun, ilk mesajı gönder')}</span>
                    </span>
                    <MessageCircle size={14} className="text-amber-soft" />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* alt menü: uygulamadaki dock ile aynı 6 sekme */}
              <nav className="absolute inset-x-0 bottom-3 z-30 flex justify-center" aria-label={t('Önizleme menüsü')}>
                <div className="flex items-center gap-0.5 rounded-[1.1rem] border border-line bg-surface/90 p-1 shadow-lg backdrop-blur-xl">
                  {TABS.map((item) => {
                    const on = item.key === tab;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setTab(item.key);
                          if (item.key !== 'chat') setChatWith(null);
                        }}
                        aria-label={t(item.label)}
                        aria-current={on ? 'page' : undefined}
                        className={`relative flex min-h-[30px] items-center gap-1 rounded-[0.8rem] px-1.5 text-[8.5px] font-bold transition-[background-color,color] duration-200 ${on ? 'bg-amber-soft text-white' : 'text-paper-muted'}`}
                      >
                        <item.icon size={13} strokeWidth={on ? 2.4 : 2} />
                        {on && <span>{t(item.label)}</span>}
                        {item.key === 'chat' && matches.length > 0 && !on && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-coral" />}
                      </button>
                    );
                  })}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[0.75rem] text-paper-faint">{t('Dene: kartı sağa kaydır, alttaki menüde gezin.')}</p>
    </motion.div>
  );
}
