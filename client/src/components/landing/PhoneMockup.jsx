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
  BarChart3,
  BatteryFull,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Heart,
  Layers,
  LayoutGrid,
  MessageCircle,
  Pin,
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
import { demoPhoto } from './demoPhotos';

// Ana sayfadaki telefon: uygulamanın gerçek ekranlarının küçük, dokunulabilen
// bir kopyası. Ekranda görününce kendi kendine bir tur atar (Kart Modu →
// eşleşme → sohbet → kulüp anketi → Keşfet → Akış → Profil); kullanıcı
// telefona dokunduğu an tur durur ve kendisi dener. Hiçbir veri sunucuya gitmez.

const EASE_OUT = [0.23, 1, 0.32, 1];
const UNI = 'Hatay Mustafa Kemal Üni.';

const PEOPLE = [
  { id: 'can', name: 'Can Aydın', age: 22, dept: 'Mimarlık', year: '4. Sınıf', initials: 'CA', tone: '#ffd6a5', intents: ['Spor Arkadaşı', 'Proje Ortağı'], interests: ['Basketbol', 'Eskiz', 'Kamp'], bio: 'Hafta sonu basketbol, hafta içi maket. Bitirme projesi için ekip arıyorum.', likesYou: false },
  { id: 'elif', name: 'Elif Yıldız', age: 21, dept: 'Bilgisayar Müh.', year: '3. Sınıf', initials: 'EY', tone: '#b9d6f7', intents: ['Arkadaşlık', 'Çalışma Arkadaşı'], interests: ['Yazılım', 'Satranç', 'Kahve'], bio: 'Hackathon bağımlısı, satranç kulübü yöneticisi. Kahvesiz kod yazmam.', likesYou: true },
  { id: 'deniz', name: 'Deniz Kara', age: 20, dept: 'Psikoloji', year: '2. Sınıf', initials: 'DK', tone: '#a7e3b5', intents: ['Arkadaşlık', 'Bir Kahve'], interests: ['Kitap', 'Yoga', 'Podcast'], bio: 'Kütüphanenin 2. katındaki cam kenarı masa benim. Kitap önerisine açığım.', likesYou: true },
  { id: 'mert', name: 'Mert Tunç', age: 23, dept: 'Endüstri Müh.', year: '4. Sınıf', initials: 'MT', tone: '#c6c5f2', intents: ['Proje Ortağı', 'Etkinlik Arkadaşı'], interests: ['Girişimcilik', 'Satranç', 'Koşu'], bio: 'Girişimcilik kulübünde etkinlik sorumlusuyum. Fikrin varsa konuşalım.', likesYou: false },
  { id: 'zeynep', name: 'Zeynep Ak', age: 21, dept: 'Tıp', year: '3. Sınıf', initials: 'ZA', tone: '#ffc8d4', intents: ['Çalışma Arkadaşı', 'Bir Kahve'], interests: ['Koşu', 'Piyano', 'Seyahat'], bio: 'Sabah 7 koşusu, akşam anatomi. Sınav haftası çalışma grubu kuruyorum.', likesYou: true },
  { id: 'emre', name: 'Emre Şen', age: 22, dept: 'İşletme', year: '3. Sınıf', initials: 'EŞ', tone: '#d7f0b5', intents: ['Etkinlik Arkadaşı', 'Arkadaşlık'], interests: ['Futbol', 'Konser', 'Fotoğraf'], bio: 'Konser ve maç arkadaşı aranıyor. Kampüs futbol turnuvasında kaleciyim.', likesYou: false },
];
// Akış, sohbet listesi ve aktif şerit için ek kişiler (kart destesinde yok)
const OTHERS = [
  { id: 'selin', name: 'Selin Uçar', age: 21, dept: 'Hukuk', initials: 'SU', tone: '#ffe39f' },
  { id: 'baris', name: 'Barış Öz', age: 22, dept: 'Fizik', initials: 'BÖ', tone: '#b5e3f0' },
];
// Profil sekmesindeki "sen"
const ME = { id: 'ece', name: 'Ece Arslan', age: 20, initials: 'EA', tone: '#ffd6a5' };
const EVERYONE = [...PEOPLE, ...OTHERS];
const byId = (id) => EVERYONE.find((p) => p.id === id);

const TABS = [
  { key: 'discover', icon: Compass, label: 'Keşfet' },
  { key: 'cards', icon: Layers, label: 'Kart Modu' },
  { key: 'feed', icon: LayoutGrid, label: 'Akış' },
  { key: 'clubs', icon: Users, label: 'Kulüpler' },
  { key: 'chat', icon: MessageCircle, label: 'Sohbet' },
  { key: 'profile', icon: User, label: 'Profil' },
];

const HEADERS = {
  discover: { icon: Compass, eyebrow: UNI, title: 'Keşfet', actions: ['bell', 'filter'] },
  cards: { icon: Layers, eyebrow: 'Sağa kaydır: beğen · Sola: geç', title: 'Kart Modu', back: true },
  feed: { icon: LayoutGrid, eyebrow: UNI, title: 'Akış', actions: ['bell'] },
  clubs: { icon: Users, eyebrow: UNI, title: 'Kulüpler' },
  chat: { icon: MessageCircle, eyebrow: 'Eşleşmelerin', title: 'Sohbet' },
  profile: { icon: User, eyebrow: 'Hesabın', title: 'Profilim', actions: ['bell'] },
};

const CLUBS = [
  { id: 1, name: 'Satranç Kulübü', category: 'Akademik', members: 64, tone: '#5856d6', next: 'Perşembe 18:00', faces: ['elif', 'mert', 'baris'] },
  { id: 2, name: 'Fotoğrafçılık', category: 'Sanat', members: 112, tone: '#ff375f', next: 'Cumartesi 11:00', faces: ['selin', 'deniz', 'can'] },
  { id: 3, name: 'Koşu Topluluğu', category: 'Spor', members: 87, tone: '#34c759', next: 'Pazar 08:30', faces: ['emre', 'zeynep', 'can'] },
  { id: 4, name: 'Girişimcilik', category: 'Akademik', members: 53, tone: '#ff9500', next: 'Çarşamba 19:00', faces: ['mert', 'selin', 'elif'] },
];

const POLL_OPTIONS = ['Salı 18:00', 'Perşembe 18:00', 'Cuma 17:00'];

const SEED_CHATS = {
  zeynep: [{ id: 1, mine: false, text: 'Yarın kütüphanede misin?' }],
  baris: [{ id: 1, mine: true, text: 'Fizik notlarını atar mısın?' }, { id: 2, mine: false, text: 'Tabii, akşam gönderirim.' }],
};

const QUICK_REPLIES = ['Selam! Kahve?', 'Hangi dersleri alıyorsun?', 'Kulübe gelsene'];

const INTENT_TONE = { 'Arkadaşlık': 'bg-teal/15 text-teal', 'Çalışma Arkadaşı': 'bg-amber-soft/12 text-amber-soft' };

// Otomatik tur adımları (her biri bir özelliği gösterir)
const TOUR = [
  { key: 'swipe', label: 'Kart Modu', ms: 4300 },
  { key: 'chat', label: 'Sohbet', ms: 5200 },
  { key: 'club', label: 'Kulüp anketi', ms: 5200 },
  { key: 'discover', label: 'Kimler aktif', ms: 4200 },
  { key: 'feed', label: 'Akış', ms: 4600 },
  { key: 'profile', label: 'Profil', ms: 4600 },
];

// Fotoğraf yüklenene kadar (ya da yüklenemezse) baş harfler görünür
function Face({ person, size, className = '', style }) {
  const src = demoPhoto(person.id, size);
  return (
    <span
      className={`relative flex items-center justify-center overflow-hidden rounded-full font-bold text-[#1d1d1f] ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34, background: person.tone, ...style }}
      aria-hidden="true"
    >
      {person.initials}
      {src && <img src={src} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />}
    </span>
  );
}

function Avatar({ person, size = 40, ring = false, online = false }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Face person={person} size={size} style={{ boxShadow: ring ? '0 0 0 2px var(--surface), 0 0 0 4px var(--amber-soft)' : undefined }} />
      {online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] bg-[#30d158]" />}
    </span>
  );
}

function FaceStack({ ids, size = 18 }) {
  return (
    <span className="flex -space-x-1.5">
      {ids.map((id) => {
        const p = byId(id);
        return <Face key={id} person={p} size={size} className="border-2 border-[var(--surface)]" />;
      })}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="flex w-fit items-center gap-1 self-start rounded-[0.9rem] bg-surface-3 px-2.5 py-2" aria-label="yazıyor">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-paper-muted"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
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

function Header({ tab, matches, club, onBack }) {
  const { t } = useI18n();
  const h = club
    ? { icon: Users, eyebrow: t('Kulüp sohbeti · {n} üye', { n: club.members }), title: club.name, back: true }
    : HEADERS[tab];
  return (
    <div className="relative z-20 mx-3 mt-3 flex items-center gap-2 rounded-[1.1rem] border border-line bg-surface/90 px-2.5 py-2 backdrop-blur-xl">
      {h.back && (
        <button type="button" onClick={onBack} aria-label={t('Geri')} className="flex h-7 w-7 items-center justify-center rounded-[0.6rem] bg-surface-2 text-paper">
          <ChevronLeft size={14} />
        </button>
      )}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] text-white" style={{ background: club ? club.tone : 'var(--amber-soft)' }}>
        <h.icon size={15} strokeWidth={2.3} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[7.5px] font-bold uppercase tracking-[0.12em] text-amber-soft">{t(h.eyebrow)}</p>
        <p className="truncate text-[14px] font-bold text-paper">{t(h.title)}</p>
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

// Kart Modu'ndaki kart: sürüklenebilir; command değişince kendini atar
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
    controls.start({ x: dir * 380, opacity: 0, transition: { duration: 0.32, ease: EASE_OUT } });
    setTimeout(() => onDecide(person, dir), 280);
  };

  useEffect(() => {
    if (isTop) controls.start({ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', duration: 0.45, bounce: 0.15 } });
  }, [isTop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isTop || !command) return;
    // Tur sırasında kart önce yavaşça kayar (damga görünsün), sonra atılır
    if (command.preview) {
      controls.start({ x: command.dir * 70, rotate: command.dir * 6, transition: { duration: 0.45, ease: 'easeOut' } });
      const id = setTimeout(() => fly(command.dir), 520);
      return () => clearTimeout(id);
    }
    fly(command.dir);
    return undefined;
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
      <div className="relative h-[134px]" style={{ background: person.tone }}>
        <span className="absolute inset-0 flex items-center justify-center text-[44px] font-bold text-[#1d1d1f]/70">{person.initials}</span>
        <img src={demoPhoto(person.id, 260, 134)} alt="" draggable={false} decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />
        <span className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute inset-x-2.5 top-2 flex gap-1">
          <span className="h-[3px] flex-1 rounded-full bg-white" />
          <span className="h-[3px] flex-1 rounded-full bg-white/45" />
        </div>
        <span className="absolute right-2.5 top-3.5 rounded-full bg-black/35 px-1.5 text-[8px] font-semibold text-white">1/2</span>
        {isTop && (
          <>
            <motion.span style={{ opacity: likeOpacity }} className="absolute left-3 top-8 rounded-lg border-2 border-teal bg-white/85 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-teal [transform:rotate(-10deg)]">
              {t('BEĞEN')}
            </motion.span>
            <motion.span style={{ opacity: nopeOpacity }} className="absolute right-3 top-8 rounded-lg border-2 border-coral bg-white/85 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-coral [transform:rotate(10deg)]">
              {t('GEÇ')}
            </motion.span>
          </>
        )}
      </div>
      <div className="px-3 pb-3 pt-2">
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
        {person.bio && <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-paper-muted">{t(person.bio)}</p>}
        <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1 rounded-[0.8rem] bg-surface-2 px-2.5 py-1.5">
          <div>
            <dt className="text-[7px] font-bold uppercase tracking-wider text-paper-faint">{t('Bölüm')}</dt>
            <dd className="text-[9.5px] font-semibold text-paper">{t(person.dept)}</dd>
          </div>
          <div>
            <dt className="text-[7px] font-bold uppercase tracking-wider text-paper-faint">{t('Sınıf')}</dt>
            <dd className="text-[9.5px] font-semibold text-paper">{t(person.year)}</dd>
          </div>
        </dl>
        <div className="mt-1.5 flex gap-1 overflow-hidden">
          {person.intents.map((i) => (
            <span key={i} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[8.5px] font-semibold ${INTENT_TONE[i] || 'bg-[color:var(--sky)]/15 text-[color:var(--sky)]'}`}>
              {t(i)}
            </span>
          ))}
          {person.interests?.map((i) => (
            <span key={i} className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[8.5px] font-semibold text-paper">
              {t(i)}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function CardsScreen({ deck, likesCount, command, setCommand, onDecide, onReset, nudge }) {
  const { t } = useI18n();
  const top = deck[0];
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
        <FaceStack ids={['zeynep', 'deniz', 'elif']} size={16} />
        <ChevronRight size={12} className="text-paper-faint" />
      </div>
      <div className="relative h-[292px]">
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
        <button type="button" disabled={!top} onClick={() => setCommand({ dir: -1, n: Date.now() })} className="min-h-[34px] rounded-[0.8rem] border border-coral/45 bg-coral/10 text-[11px] font-bold text-coral transition-transform active:scale-95 disabled:opacity-40">
          {t('Geç')}
        </button>
        <button type="button" disabled={!top} onClick={() => setCommand({ dir: 1, n: Date.now() })} className="min-h-[34px] rounded-[0.8rem] bg-amber-soft text-[11px] font-bold text-white transition-transform active:scale-95 disabled:opacity-40">
          {t('Beğen')}
        </button>
      </div>
    </div>
  );
}

// Keşfet: aktif öğrenciler şeridi, Kart Modu kutusu, sayılar, kayan öneriler
function DiscoverScreen({ deck, likesCount, joined, goCards, railRef, followed, onFollow }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 px-3">
      <div className="flex items-center gap-1.5 rounded-[0.8rem] bg-surface-2 px-2.5 py-2 text-[9.5px] text-paper-faint">
        <Search size={11} /> {t('Kişi, bölüm veya kulüp ara...')}
      </div>
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[9px] font-bold text-paper">
          <span className="h-1.5 w-1.5 rounded-full bg-[#30d158]" /> {t('Şu an kampüste')} <span className="font-medium text-paper-muted">· 38</span>
        </p>
        <div className="flex gap-2.5 overflow-hidden">
          {EVERYONE.slice(0, 7).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }} className="flex w-9 flex-col items-center">
              <Avatar person={p} size={32} online />
              <span className="mt-0.5 w-full truncate text-center text-[7px] text-paper-muted">{p.name.split(' ')[0]}</span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1.25fr_1fr] gap-2">
        <button type="button" onClick={goCards} className="flex flex-col rounded-[1rem] bg-amber-soft p-2.5 text-left text-white">
          <span className="flex w-fit items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider">
            <Layers size={8} /> {t('Kart Modu')}
          </span>
          <span className="mt-1 text-[12.5px] font-bold leading-tight">{t('Sağa kaydır, eşleş.')}</span>
          <span className="mt-0.5 text-[8px] text-white/80">{deck.length ? t('Sırada {n} kişi seni bekliyor', { n: deck.length }) : t('Şimdilik herkesi gördün')}</span>
          <span className="mt-2 flex w-fit items-center gap-1 rounded-full bg-white px-2 py-1 text-[8px] font-bold text-amber-soft">
            {t('Kaydırmaya başla')} <ArrowRight size={9} />
          </span>
        </button>
        <div className="grid gap-2">
          <div className="rounded-[1rem] border border-line bg-surface p-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[0.45rem] bg-coral/12 text-coral">
              <Heart size={10} fill="currentColor" />
            </span>
            <p className="mt-1 text-[13px] font-bold leading-none text-paper">{likesCount}</p>
            <p className="text-[7.5px] text-paper-muted">{t('kişi seni beğendi')}</p>
          </div>
          <div className="rounded-[1rem] border border-line bg-surface p-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[0.45rem] bg-teal/15 text-teal">
              <Users size={10} />
            </span>
            <p className="mt-1 text-[13px] font-bold leading-none text-paper">{joined}</p>
            <p className="text-[7.5px] text-paper-muted">{t('kulübün var')}</p>
          </div>
        </div>
      </div>
      <p className="flex items-center gap-1.5 pt-0.5 text-[10px] font-bold text-paper">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-soft" /> {t('Önerilen Kişiler')}
      </p>
      <div ref={railRef} className="-mx-3 flex gap-2 overflow-x-auto scroll-smooth px-3 pb-1 [scrollbar-width:none]">
        {PEOPLE.slice(1).map((p) => {
          const on = followed.includes(p.id);
          return (
            <div key={p.id} className="flex w-[104px] shrink-0 flex-col items-center rounded-[1rem] border border-line bg-surface px-2 pb-2 pt-2.5 text-center">
              <Avatar person={p} size={38} ring />
              <p className="mt-1.5 w-full truncate text-[9.5px] font-bold text-paper">{p.name}</p>
              <p className="w-full truncate text-[7.5px] text-paper-muted">{t(p.dept)}</p>
              <button type="button" onClick={() => onFollow(p.id)} className={`mt-1.5 min-h-[24px] w-full rounded-[0.6rem] text-[8.5px] font-bold ${on ? 'bg-surface-2 text-paper' : 'bg-amber-soft text-white'}`}>
                {on ? t('Takiptesin') : t('Takip Et')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FeedScreen({ liked, onLike, scrollRef, going, onGo }) {
  const { t } = useI18n();
  const stories = ['elif', 'mert', 'zeynep', 'baris', 'deniz'];
  const posts = [
    {
      id: 1,
      who: byId('deniz'),
      meta: 'Psikoloji · 2 sa',
      text: 'Bu akşam kütüphanede final çalışması yapacak olan var mı? 2. kattayım, yer ayırabilirim.',
      likes: 12,
      likedBy: 'Elif',
      comments: 4,
      comment: { who: 'Mert', text: 'Ben de geliyorum, 19:00 gibi oradayım.' },
    },
    {
      id: 2,
      who: byId('selin'),
      meta: 'Hukuk · 5 sa',
      text: 'Fotoğrafçılık kulübünün kampüs yürüyüşünden. Sonbahar ışığı bu hafta harika.',
      photo: 'campus',
      likes: 31,
      likedBy: 'Barış',
      comments: 7,
    },
  ];
  return (
    <div ref={scrollRef} className="h-[452px] space-y-2 overflow-y-auto scroll-smooth px-3 pb-16 [scrollbar-width:none]">
      {/* Hikâyeler */}
      <div className="flex gap-2.5">
        <div className="flex w-10 shrink-0 flex-col items-center">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-dashed border-line bg-surface text-[13px] font-bold text-amber-soft">+</span>
          <span className="mt-0.5 text-[7px] text-paper-muted">{t('Hikâyen')}</span>
        </div>
        {stories.map((id, i) => {
          const p = byId(id);
          return (
            <div key={id} className="flex w-10 shrink-0 flex-col items-center">
              <span className="rounded-full p-[2px]" style={{ background: i < 3 ? 'var(--amber-soft)' : 'var(--border)' }}>
                <span className="block rounded-full border-2 border-[var(--bg)]">
                  <Avatar person={p} size={30} />
                </span>
              </span>
              <span className="mt-0.5 w-full truncate text-center text-[7px] text-paper-muted">{p.name.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      <div className="flex rounded-[0.8rem] bg-surface-2 p-0.5 text-[9px] font-semibold">
        <span className="flex-1 rounded-[0.65rem] bg-surface py-1 text-center text-paper shadow-sm">{t('Kampüs')}</span>
        <span className="flex-1 py-1 text-center text-paper-muted">{t('Takip')}</span>
        <span className="flex-1 py-1 text-center text-paper-muted">{t('Paylaşımlarım')}</span>
      </div>

      {/* Kulüp etkinliği */}
      <div className="flex items-center gap-2 rounded-[1rem] border border-line bg-surface p-2">
        <span className="flex w-9 shrink-0 flex-col items-center rounded-[0.6rem] bg-amber-soft/12 py-1 text-amber-soft">
          <span className="text-[12px] font-bold leading-none">16</span>
          <span className="text-[7px] font-bold uppercase">{t('Eki')}</span>
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[7.5px] font-semibold text-paper-muted">{t('Satranç Kulübü')} · {t('Etkinlik')}</span>
          <span className="block truncate text-[10px] font-bold text-paper">{t('Kampüs Satranç Turnuvası')}</span>
          <span className="mt-0.5 flex items-center gap-1">
            <FaceStack ids={['elif', 'mert', 'baris']} size={13} />
            <span className="text-[7.5px] text-paper-muted">{t('{n} katılımcı', { n: 24 + (going ? 1 : 0) })}</span>
          </span>
        </span>
        <button type="button" onClick={onGo} aria-pressed={going} className={`min-h-[26px] rounded-full px-2.5 text-[8.5px] font-bold ${going ? 'bg-teal/15 text-teal' : 'bg-amber-soft text-white'}`}>
          {going ? t('Katılıyorsun') : t('Katıl')}
        </button>
      </div>

      {posts.map((p) => {
        const on = liked.includes(p.id);
        return (
          <article key={p.id} className="rounded-[1rem] border border-line bg-surface p-2.5">
            <div className="flex items-center gap-2">
              <Avatar person={p.who} size={26} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="flex items-center gap-1 text-[9.5px] font-bold text-paper">
                  {p.who.name} <BadgeCheck size={10} className="text-amber-soft" />
                </p>
                <p className="text-[7.5px] text-paper-muted">{t(p.meta)}</p>
              </div>
              <span className="text-[11px] leading-none text-paper-faint">···</span>
            </div>
            <p className="mt-1.5 text-[9.5px] leading-snug text-paper">{t(p.text)}</p>
            {p.photo && (
              <div className="relative mt-1.5 h-32 overflow-hidden rounded-[0.7rem] bg-[#b9d6f7]">
                <img src={demoPhoto(p.photo, 260, 128)} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />
                <span className="absolute bottom-1.5 right-2 rounded-full bg-black/45 px-1.5 text-[7px] font-semibold text-white">1/3</span>
              </div>
            )}
            <div className="mt-1.5 flex items-center gap-3 text-[9px] text-paper-muted">
              <button type="button" onClick={() => onLike(p.id)} aria-pressed={on} className={`flex min-h-[26px] items-center gap-1 ${on ? 'text-coral' : ''}`}>
                <motion.span key={on ? 'on' : 'off'} initial={{ scale: on ? 0.5 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', duration: 0.35, bounce: 0.55 }}>
                  <Heart size={12} fill={on ? 'currentColor' : 'none'} />
                </motion.span>
                {p.likes + (on ? 1 : 0)}
              </button>
              <span className="flex items-center gap-1">
                <MessageCircle size={12} /> {p.comments}
              </span>
              <Send size={11} className="ml-auto" />
            </div>
            <p className="text-[8px] text-paper-muted">
              {t('{name} ve {n} kişi beğendi', { name: p.likedBy, n: p.likes - 1 + (on ? 1 : 0) })}
            </p>
            {p.comment && (
              <p className="mt-1 rounded-[0.6rem] bg-surface-2 px-2 py-1 text-[8.5px] text-paper">
                <b className="font-bold">{p.comment.who}</b> {t(p.comment.text)}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ClubsScreen({ joined, onToggle, onOpen }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2 px-3">
      {CLUBS.map((c) => {
        const on = joined.includes(c.id);
        return (
          <div key={c.id} className="flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5">
            <button type="button" onClick={() => onOpen(c)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.7rem] text-white" style={{ background: c.tone }}>
                <Users size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-paper">{t(c.name)}</span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  <FaceStack ids={c.faces} size={14} />
                  <span className="text-[8px] text-paper-muted">
                    {c.members + (on ? 1 : 0)} {t('üye')}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[7.5px] font-semibold text-amber-soft">
                  <CalendarDays size={8} /> {t(c.next)}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => onToggle(c.id)} aria-pressed={on} className={`min-h-[28px] rounded-full px-3 text-[9px] font-bold transition-colors ${on ? 'bg-teal/15 text-teal' : 'bg-amber-soft text-white'}`}>
              {on ? t('Üyesin') : t('Katıl')}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Kulüp sohbeti: sabitlenmiş duyuru, mesajlar ve canlı anket
function ClubChatScreen({ club, votes, myVote, onVote }) {
  const { t } = useI18n();
  const total = votes.reduce((s, v) => s + v, 0);
  return (
    <div className="flex h-[412px] flex-col px-3">
      <div className="flex items-center gap-2 rounded-[0.9rem] border border-line bg-surface px-2.5 py-1.5 text-amber-soft">
        <Pin size={11} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[7px] font-bold uppercase tracking-wider">{t('Sabitlenmiş duyuru')}</span>
          <span className="block truncate text-[9px] text-paper">{t('Turnuva kayıtları cuma akşamı kapanıyor.')}</span>
        </span>
      </div>
      <div className="mt-2 flex flex-1 flex-col gap-1.5 overflow-hidden">
        <p className="text-[7.5px] font-semibold text-paper-muted">{byId('mert').name}</p>
        <p className="max-w-[80%] self-start rounded-[0.9rem] bg-surface-3 px-2.5 py-1.5 text-[9.5px] text-paper">{t('Herkese merhaba! Bu hafta ne zaman buluşalım?')}</p>
        <div className="mt-1 rounded-[1rem] border border-line bg-surface p-2.5">
          <p className="flex items-center gap-1 text-[8px] font-bold text-amber-soft">
            <BarChart3 size={10} /> {t('Anket')}
          </p>
          <p className="mt-1 text-[10.5px] font-bold text-paper">{t('Buluşma hangi gün olsun?')}</p>
          <div className="mt-1.5 space-y-1">
            {POLL_OPTIONS.map((o, i) => {
              const pct = total ? Math.round((votes[i] / total) * 100) : 0;
              const mine = myVote === i;
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => onVote(i)}
                  className={`relative flex min-h-[28px] w-full items-center justify-between overflow-hidden rounded-[0.6rem] border px-2 text-[9px] font-semibold text-paper ${mine ? 'border-amber-soft' : 'border-line'} bg-surface-2`}
                >
                  <motion.span className="absolute inset-y-0 left-0 bg-amber-soft/15" animate={{ width: `${pct}%` }} transition={{ duration: 0.45, ease: EASE_OUT }} />
                  <span className="relative flex items-center gap-1">
                    {mine && <Check size={10} className="text-amber-soft" />}
                    {t(o)}
                  </span>
                  <span className="relative tabular-nums text-paper-muted">%{pct}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[7.5px] text-paper-muted">{t('{n} kişi oy verdi', { n: total })}</p>
        </div>
      </div>
    </div>
  );
}

function ChatScreen({ chats, active, typing, onOpen, onSend }) {
  const { t } = useI18n();
  const ids = Object.keys(chats);
  if (!active) {
    return (
      <div className="space-y-1.5 px-3">
        {ids.map((id) => {
          const p = byId(id);
          const list = chats[id];
          const last = list[list.length - 1];
          const unread = !last.mine && !last.read;
          return (
            <button key={id} type="button" onClick={() => onOpen(p)} className="flex w-full items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2 text-left">
              <Avatar person={p} size={34} online={id === 'elif' || id === 'zeynep'} />
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] font-bold text-paper">{p.name}</span>
                <span className={`block truncate text-[8.5px] ${unread ? 'font-semibold text-paper' : 'text-paper-muted'}`}>
                  {typing === id ? t('yazıyor…') : `${last.mine ? t('Sen: ') : ''}${last.text}`}
                </span>
              </span>
              {unread && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-soft px-1 text-[8px] font-bold text-white">1</span>}
            </button>
          );
        })}
      </div>
    );
  }
  const list = chats[active.id] || [];
  return (
    <div className="flex h-[412px] flex-col px-3">
      <div className="flex items-center gap-2 pb-2">
        <Avatar person={active} size={26} online />
        <span className="text-[11px] font-bold text-paper">{active.name}</span>
        <span className="ml-auto text-[8px] font-semibold text-teal">{typing === active.id ? t('yazıyor…') : t('çevrimiçi')}</span>
      </div>
      <div className="flex flex-1 flex-col justify-end gap-1.5 overflow-hidden">
        <AnimatePresence initial={false}>
          {list.map((m) => (
            <motion.p
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={`max-w-[78%] rounded-[0.9rem] px-2.5 py-1.5 text-[10px] leading-snug ${m.mine ? 'self-end bg-amber-soft text-white' : 'self-start bg-surface-3 text-paper'}`}
            >
              {m.text}
            </motion.p>
          ))}
          {typing === active.id && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TypingDots />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Hazır cevaplar tek satırda kayar; alttaki menünün altına taşmaz */}
      <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" onClick={() => onSend(t(q))} className="flex min-h-[28px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 text-[9px] font-semibold text-paper">
            <Send size={9} /> {t(q)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileScreen({ likes, joined, matches, scrollRef }) {
  const { t } = useI18n();
  const me = ME;
  const r = 16;
  const c = 2 * Math.PI * r;
  const score = Math.min(100, 70 + likes * 5 + joined * 5);
  const myClubs = [CLUBS[0], CLUBS[1], ...CLUBS.slice(2).filter((cl) => joined > 0 && cl.id === 3)];
  return (
    <div ref={scrollRef} className="h-[452px] space-y-2 overflow-y-auto scroll-smooth px-3 pb-16 [scrollbar-width:none]">
      <div className="rounded-[1.2rem] border border-line bg-surface px-3 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <Avatar person={me} size={52} ring />
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-1 text-[12.5px] font-bold text-paper">
              {me.name}, {me.age} <BadgeCheck size={12} className="text-amber-soft" />
            </p>
            <p className="truncate text-[8.5px] text-paper-muted">{t('Hatay Mustafa Kemal Üniversitesi')}</p>
            <p className="text-[8.5px] text-paper-muted">{t('Bilgisayar Müh.')} · {t('2. Sınıf')}</p>
          </div>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-paper">{t('Kahve, satranç ve uzun yürüyüşler. Proje arkadaşı arıyorum.')}</p>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {[
            [matches, 'eşleşme'],
            [2 + joined, 'kulüp'],
            [128, 'takipçi'],
            [96, 'takip'],
          ].map(([n, l]) => (
            <div key={l} className="rounded-[0.6rem] bg-surface-2 py-1 text-center">
              <p className="text-[11px] font-bold leading-tight text-paper">{n}</p>
              <p className="text-[6.5px] text-paper-muted">{t(l)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[1rem] border border-line bg-surface p-2.5">
        <p className="text-[8px] font-bold uppercase tracking-wider text-paper-faint">{t('Ne arıyorum')}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {['Arkadaşlık', 'Çalışma Arkadaşı', 'Proje Ortağı'].map((i) => (
            <span key={i} className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${INTENT_TONE[i] || 'bg-[color:var(--sky)]/15 text-[color:var(--sky)]'}`}>
              {t(i)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[8px] font-bold uppercase tracking-wider text-paper-faint">{t('İlgi alanları')}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {['Satranç', 'Fotoğraf', 'Koşu', 'Kahve', 'Müzik'].map((i) => (
            <span key={i} className="rounded-full bg-surface-2 px-2 py-0.5 text-[8px] font-semibold text-paper">
              {t(i)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {[
          ['ece', '#ffd6a5'],
          ['coffee', '#e8d5c0'],
          ['chess', '#b9d6f7'],
        ].map(([key, bg], i) => (
          <div key={key} className="relative aspect-[3/4] overflow-hidden rounded-[0.7rem]" style={{ background: bg }}>
            <img src={demoPhoto(key, 90, 120)} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => e.currentTarget.remove()} />
            {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-black/45 px-1 text-[6.5px] font-bold text-white">{t('Ana')}</span>}
          </div>
        ))}
      </div>

      <div className="rounded-[1rem] border border-line bg-surface p-2.5">
        <p className="mb-1.5 text-[8px] font-bold uppercase tracking-wider text-paper-faint">{t('Kulüplerim')}</p>
        <div className="space-y-1.5">
          {myClubs.map((cl, i) => (
            <div key={cl.id} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-[0.5rem] text-white" style={{ background: cl.tone }}>
                <Users size={11} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[9.5px] font-semibold text-paper">{t(cl.name)}</span>
              {i === 0 && <span className="rounded-full bg-[color:var(--sky)]/15 px-1.5 py-0.5 text-[7px] font-bold text-[color:var(--sky)]">{t('Yönetici')}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-[1rem] border border-line bg-surface p-2.5">
        <svg width="40" height="40" viewBox="0 0 40 40" className="-rotate-90" aria-hidden="true">
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-surface-3" />
          <motion.circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" stroke="var(--amber-soft)" strokeDasharray={c} animate={{ strokeDashoffset: c - (score / 100) * c }} transition={{ duration: 0.6, ease: EASE_OUT }} />
        </svg>
        <div>
          <p className="text-[10.5px] font-bold text-paper">{t('Profil gücün')} %{score}</p>
          <p className="text-[8px] text-paper-muted">{score >= 100 ? t('Profilin eksiksiz') : t('Sıradaki adım: Instagram hesabını bağla')}</p>
        </div>
      </div>
    </div>
  );
}

export default function PhoneMockup({ className = '' }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const railRef = useRef(null);
  const feedRef = useRef(null);
  const profileRef = useRef(null);
  // Telefon ilk ekranda; görünür kabul edilir, kaydırılıp gözden çıkınca tur bekler
  const inView = useInView(rootRef, { amount: 0.45, initial: true });

  const [tab, setTab] = useState('cards');
  const [deck, setDeck] = useState(PEOPLE);
  const [command, setCommand] = useState(null);
  const [matches, setMatches] = useState([]);
  const [likes, setLikes] = useState(0);
  const [joined, setJoined] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [liked, setLiked] = useState([]);
  const [going, setGoing] = useState(false);
  const [chats, setChats] = useState(SEED_CHATS);
  const [chatWith, setChatWith] = useState(null);
  const [typing, setTyping] = useState(null);
  const [openClub, setOpenClub] = useState(null);
  const [votes, setVotes] = useState([4, 9, 3]);
  const [myVote, setMyVote] = useState(null);
  const [toast, setToast] = useState(null);

  // Otomatik tur: hareket azaltılmamışsa ve kullanıcı dokunmadıysa çalışır
  const [touring, setTouring] = useState(!reduce);
  const [step, setStep] = useState(0);
  const timers = useRef([]);
  const after = (ms, fn) => timers.current.push(setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  function decide(person, dir) {
    setDeck((d) => d.filter((p) => p.id !== person.id));
    if (dir > 0) {
      setLikes((n) => n + 1);
      if (person.likesYou) {
        setMatches((m) => (m.some((x) => x.id === person.id) ? m : [person, ...m]));
        setChats((all) => ({ [person.id]: [{ id: 1, mine: false, text: t('Selam! Profilinde kahve yazıyordu, öneri var mı?') }], ...all }));
        setToast(person);
      }
    }
  }

  function send(text, to = chatWith) {
    if (!to) return;
    setChats((all) => {
      const list = all[to.id] || [];
      return { ...all, [to.id]: [...list, { id: list.length + 1, mine: true, text }].slice(-5) };
    });
    // Karşı taraf kısa bir süre "yazıyor…", sonra cevap verir
    after(500, () => setTyping(to.id));
    after(1700, () => {
      setTyping(null);
      setChats((all) => {
        const list = all[to.id] || [];
        return { ...all, [to.id]: [...list, { id: list.length + 1, mine: false, text: t('Olur! 2. katta yer ayırırım.') }].slice(-5) };
      });
    });
  }

  function openChat(person) {
    setOpenClub(null);
    setChatWith(person);
    setTab('chat');
    setToast(null);
    setChats((all) => ({ ...all, [person.id]: (all[person.id] || []).map((m) => ({ ...m, read: true })) }));
  }

  function vote(i) {
    setVotes((v) => v.map((n, j) => n + (j === i ? 1 : 0) - (j === myVote ? 1 : 0)));
    setMyVote((cur) => (cur === i ? cur : i));
  }

  function resetDemo() {
    setDeck(PEOPLE);
    setMatches([]);
    setLikes(0);
    setChats(SEED_CHATS);
    setChatWith(null);
    setTyping(null);
    setOpenClub(null);
    setVotes([4, 9, 3]);
    setMyVote(null);
    setLiked([]);
    setGoing(false);
    setFollowed([]);
    setCommand(null);
  }

  // Her tur adımının senaryosu
  function runStep(key) {
    clearTimers();
    setToast(null);
    if (key === 'swipe') {
      resetDemo();
      setTab('cards');
      after(1100, () => setCommand({ dir: -1, preview: true, n: Date.now() }));
      after(2400, () => setCommand({ dir: 1, preview: true, n: Date.now() }));
    } else if (key === 'chat') {
      const elif = byId('elif');
      openChat(elif);
      after(1000, () => send(t('Selam! Bu akşam kütüphane?'), elif));
    } else if (key === 'club') {
      setTab('clubs');
      setChatWith(null);
      after(900, () => setOpenClub(CLUBS[0]));
      [1700, 2300, 2900, 3500].forEach((ms, k) => after(ms, () => setVotes((v) => v.map((n, j) => n + (j === [1, 0, 1, 2][k] ? 1 : 0)))));
      after(4000, () => setMyVote(1));
    } else if (key === 'discover') {
      setOpenClub(null);
      setTab('discover');
      after(1300, () => railRef.current?.scrollTo({ left: 230, behavior: 'smooth' }));
      after(2300, () => setFollowed((f) => [...f, 'deniz']));
      after(3200, () => railRef.current?.scrollTo({ left: 0, behavior: 'smooth' }));
    } else if (key === 'feed') {
      setTab('feed');
      after(1100, () => setGoing(true));
      after(1900, () => feedRef.current?.scrollTo({ top: 200, behavior: 'smooth' }));
      after(2900, () => setLiked((l) => (l.includes(2) ? l : [...l, 2])));
    } else if (key === 'profile') {
      setTab('profile');
      after(1500, () => profileRef.current?.scrollTo({ top: 170, behavior: 'smooth' }));
      after(3100, () => profileRef.current?.scrollTo({ top: 330, behavior: 'smooth' }));
    }
  }

  // Tur zamanlayıcısı: görünürken ilerler, görünmezken bekler
  useEffect(() => {
    if (!touring || !inView) return undefined;
    runStep(TOUR[step].key);
    const id = setTimeout(() => setStep((s) => (s + 1) % TOUR.length), TOUR[step].ms);
    return () => {
      clearTimeout(id);
    };
  }, [touring, inView, step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimers(), []);

  function stopTour() {
    if (!touring) return;
    setTouring(false);
    clearTimers();
    setTyping(null);
  }

  // Alttaki adım çiplerine dokununca o özelliğe atla (tur durur)
  function jumpTo(i) {
    setTouring(false);
    setStep(i);
    runStep(TOUR[i].key);
  }

  const likesCount = 3 + likes;
  const headerClub = tab === 'clubs' ? openClub : null;

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      className={`relative mx-auto w-[288px] select-none sm:w-[300px] ${className}`}
    >
      <div className={touring ? 'landing-float-slow' : ''}>
        <div className="relative rounded-[3rem] bg-[#1d1d1f] p-[3px] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.45)]">
          <div className="rounded-[2.85rem] bg-black p-[9px]">
            <span className="absolute -left-[3px] top-28 h-8 w-[3px] rounded-l-sm bg-[#2c2c2e]" />
            <span className="absolute -left-[3px] top-40 h-12 w-[3px] rounded-l-sm bg-[#2c2c2e]" />
            <span className="absolute -right-[3px] top-32 h-16 w-[3px] rounded-r-sm bg-[#2c2c2e]" />

            <div
              className="relative h-[600px] w-full overflow-hidden rounded-[2.3rem] bg-ink"
              role="group"
              aria-label={t('kampüs· uygulama önizlemesi')}
              onPointerDown={stopTour}
            >
              <div className="absolute left-1/2 top-2.5 z-30 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
              <div className="relative z-20 flex items-center justify-between px-7 pt-3.5 text-[11px] font-semibold text-paper">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                  <Signal size={12} />
                  <Wifi size={12} />
                  <BatteryFull size={14} />
                </div>
              </div>

              <Header
                tab={tab}
                matches={matches}
                club={headerClub}
                onBack={() => {
                  if (headerClub) setOpenClub(null);
                  else if (tab === 'chat') setChatWith(null);
                  else setTab('discover');
                }}
              />

              <div className="relative z-20 mt-2.5">
                <motion.div key={`${tab}-${headerClub?.id || ''}-${chatWith?.id || ''}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: EASE_OUT }}>
                  {tab === 'discover' && (
                    <DiscoverScreen
                      deck={deck}
                      likesCount={likesCount}
                      joined={joined.length}
                      goCards={() => setTab('cards')}
                      railRef={railRef}
                      followed={followed}
                      onFollow={(id) => setFollowed((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))}
                    />
                  )}
                  {tab === 'cards' && (
                    <CardsScreen
                      deck={deck}
                      likesCount={likesCount}
                      command={command}
                      setCommand={setCommand}
                      onDecide={decide}
                      onReset={() => setDeck(PEOPLE.filter((p) => !matches.some((m) => m.id === p.id)))}
                      nudge={!touring && !reduce}
                    />
                  )}
                  {tab === 'feed' && <FeedScreen scrollRef={feedRef} going={going} onGo={() => setGoing((g) => !g)} liked={liked} onLike={(id) => setLiked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))} />}
                  {tab === 'clubs' && !openClub && <ClubsScreen joined={joined} onOpen={setOpenClub} onToggle={(id) => setJoined((j) => (j.includes(id) ? j.filter((x) => x !== id) : [...j, id]))} />}
                  {tab === 'clubs' && openClub && <ClubChatScreen club={openClub} votes={votes} myVote={myVote} onVote={vote} />}
                  {tab === 'chat' && <ChatScreen chats={chats} active={chatWith} typing={typing} onOpen={openChat} onSend={(text) => send(text)} />}
                  {tab === 'profile' && <ProfileScreen scrollRef={profileRef} likes={likes} joined={joined.length} matches={matches.length} />}
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
                    <span className="relative flex">
                      <Avatar person={ME} size={28} />
                      <span className="-ml-2">
                        <Avatar person={toast} size={28} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold text-paper">{t('{name} ile eşleştin!', { name: toast.name.split(' ')[0] })}</span>
                      <span className="block text-[9px] text-paper-muted">{t('Dokun, ilk mesajı gönder')}</span>
                    </span>
                    <MessageCircle size={14} className="text-amber-soft" />
                  </motion.button>
                )}
              </AnimatePresence>

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
                          if (item.key !== 'clubs') setOpenClub(null);
                        }}
                        aria-label={t(item.label)}
                        aria-current={on ? 'page' : undefined}
                        className={`relative flex min-h-[30px] items-center gap-1 rounded-[0.8rem] px-1.5 text-[8.5px] font-bold transition-[background-color,color] duration-200 ${on ? 'bg-amber-soft text-white' : 'text-paper-muted'}`}
                      >
                        <item.icon size={13} strokeWidth={on ? 2.4 : 2} />
                        {on && <span>{t(item.label)}</span>}
                        {item.key === 'chat' && !on && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-coral" />}
                      </button>
                    );
                  })}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Tur adımları: hangi özelliğin gösterildiği ve ilerleme; dokununca o adıma geçer */}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5" aria-label={t('Özellik turu')}>
        {TOUR.map((s, i) => {
          const on = i === step;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => jumpTo(i)}
              aria-current={on ? 'step' : undefined}
              className={`relative min-h-[32px] overflow-hidden rounded-full px-3 text-[0.72rem] font-semibold transition-colors ${on ? 'bg-surface text-paper shadow-sm ring-1 ring-line' : 'text-paper-muted hover:text-paper'}`}
            >
              {on && touring && inView && (
                <motion.span
                  key={`p-${step}`}
                  className="absolute inset-y-0 left-0 bg-amber-soft/12"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: s.ms / 1000, ease: 'linear' }}
                />
              )}
              <span className="relative">{t(s.label)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[0.75rem] text-paper-faint">
        {touring ? t('Telefona dokun, kendin dene.') : t('Kartı kaydır, alttaki menüde gezin.')}
      </p>
    </motion.div>
  );
}
