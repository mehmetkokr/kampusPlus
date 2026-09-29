// Gerçek logolar yerine (telif riski + varlık yükü olmadan), her üniversite
// için kısa rumuz + tam ad içeren cam rozetler. Liste iki kez art arda
// eklenerek %50 kaydırmada kusursuz, sonsuz bir döngü elde edilir.
const UNIVERSITIES = [
  { abbr: 'İTÜ', name: 'İstanbul Teknik Üniversitesi' },
  { abbr: 'ODTÜ', name: 'Orta Doğu Teknik Üniversitesi' },
  { abbr: 'BÜ', name: 'Boğaziçi Üniversitesi' },
  { abbr: 'HÜ', name: 'Hacettepe Üniversitesi' },
  { abbr: 'AÜ', name: 'Ankara Üniversitesi' },
  { abbr: 'EGE', name: 'Ege Üniversitesi' },
  { abbr: 'BİL', name: 'Bilkent Üniversitesi' },
  { abbr: 'SÜ', name: 'Sabancı Üniversitesi' },
  { abbr: 'KÜ', name: 'Koç Üniversitesi' },
  { abbr: 'MÜ', name: 'Marmara Üniversitesi' },
  { abbr: 'GÜ', name: 'Gazi Üniversitesi' },
  { abbr: 'DEÜ', name: 'Dokuz Eylül Üniversitesi' },
  { abbr: 'YTÜ', name: 'Yıldız Teknik Üniversitesi' },
  { abbr: 'İÜ', name: 'İstanbul Üniversitesi' },
];

function Badge({ abbr, name }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-line-soft bg-surface/50 px-4 py-2 backdrop-blur">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 font-display text-[10px] font-bold text-paper-muted">
        {abbr}
      </span>
      <span className="whitespace-nowrap text-[12.5px] font-semibold text-paper-muted">{name}</span>
    </div>
  );
}

export default function UniversityMarquee() {
  const items = [...UNIVERSITIES, ...UNIVERSITIES];

  return (
    <div className="relative mt-14 sm:mt-20">
      {/* kenar geçişleri: şeridin başladığı/bittiği yerde yumuşak kayboluş */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-ink to-transparent sm:w-28" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-ink to-transparent sm:w-28" />

      <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-wider text-paper-faint">
        Türkiye&apos;nin dört bir yanından öğrenciler kampüs&apos;te
      </p>

      <div className="group overflow-hidden">
        <div className="flex w-max animate-marquee gap-3 group-hover:[animation-play-state:paused]">
          {items.map((u, i) => (
            <Badge key={`${u.abbr}-${i}`} {...u} />
          ))}
        </div>
      </div>
    </div>
  );
}
