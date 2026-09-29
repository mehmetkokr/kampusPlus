// Gerçek bir fotoğraf yerine, "kampüste gece" kimliğine sadık, tamamen
// orijinal bir illüstrasyon: kütüphane + yurt binası silüetleri, yanan
// pencereler, ve amber/teal bokeh ışıkları. Telif riski yok, her ekran
// boyutuna anında uyarlanıyor, video çözme yükü yok.
export default function CampusBackdrop({ className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* gökyüzü gradyanı */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#161b26_0%,#0a0d12_55%)]" />

      {/* bokeh ışıkları */}
      <div className="absolute -left-32 -top-24 h-[34rem] w-[34rem] rounded-full bg-amber/25 blur-[110px] animate-drift-a" />
      <div className="absolute -right-24 top-10 h-[28rem] w-[28rem] rounded-full bg-teal/20 blur-[110px] animate-drift-b" />

      {/* yıldızlar */}
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(1.5px_1.5px_at_20%_20%,#fff_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_70%_15%,#fff_50%,transparent_51%),radial-gradient(1px_1px_at_45%_30%,#fff_50%,transparent_51%),radial-gradient(1.5px_1.5px_at_85%_35%,#fff_50%,transparent_51%),radial-gradient(1px_1px_at_10%_45%,#fff_50%,transparent_51%)] [background-size:100%_100%]" />

      {/* kampüs silüeti */}
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 h-[42%] w-full opacity-90"
      >
        <defs>
          <linearGradient id="bld" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#171c27" />
            <stop offset="100%" stopColor="#0a0d12" />
          </linearGradient>
        </defs>
        {/* kütüphane / ana bina (kubbeli) */}
        <rect x="80" y="160" width="220" height="260" fill="url(#bld)" />
        <rect x="150" y="90" width="80" height="90" fill="url(#bld)" />
        <circle cx="190" cy="88" r="42" fill="url(#bld)" />
        <rect x="120" y="190" width="20" height="28" fill="#e8a33d" opacity="0.55" />
        <rect x="160" y="190" width="20" height="28" fill="#e8a33d" opacity="0.25" />
        <rect x="200" y="190" width="20" height="28" fill="#45d8c0" opacity="0.35" />
        <rect x="240" y="190" width="20" height="28" fill="#e8a33d" opacity="0.45" />
        <rect x="120" y="240" width="20" height="28" fill="#e8a33d" opacity="0.3" />
        <rect x="200" y="240" width="20" height="28" fill="#e8a33d" opacity="0.5" />
        <rect x="240" y="240" width="20" height="28" fill="#45d8c0" opacity="0.25" />

        {/* yurt kuleleri */}
        <rect x="340" y="120" width="90" height="300" fill="url(#bld)" />
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 3 }).map((__, col) => (
            <rect
              key={`d1-${row}-${col}`}
              x={352 + col * 24}
              y={140 + row * 28}
              width="14"
              height="18"
              fill={(row + col) % 3 === 0 ? '#e8a33d' : (row + col) % 3 === 1 ? '#45d8c0' : '#1c212c'}
              opacity={(row + col) % 3 === 2 ? 0.6 : 0.4}
            />
          ))
        )}

        <rect x="460" y="200" width="140" height="220" fill="url(#bld)" />
        {Array.from({ length: 4 }).map((_, row) =>
          Array.from({ length: 5 }).map((__, col) => (
            <rect
              key={`d2-${row}-${col}`}
              x={474 + col * 24}
              y={216 + row * 30}
              width="14"
              height="18"
              fill={(row * 5 + col) % 4 === 0 ? '#e8a33d' : '#1c212c'}
              opacity={(row * 5 + col) % 4 === 0 ? 0.55 : 0.5}
            />
          ))
        )}

        {/* uzak şehir hattı (sağ) */}
        <rect x="980" y="240" width="60" height="180" fill="url(#bld)" opacity="0.8" />
        <rect x="1050" y="180" width="80" height="240" fill="url(#bld)" opacity="0.8" />
        <rect x="1140" y="260" width="50" height="160" fill="url(#bld)" opacity="0.8" />
        <rect x="1200" y="150" width="100" height="270" fill="url(#bld)" opacity="0.8" />
        <rect x="1310" y="220" width="70" height="200" fill="url(#bld)" opacity="0.8" />

        {/* zemin çizgisi */}
        <rect x="0" y="416" width="1440" height="4" fill="#0a0d12" />
      </svg>

      {/* alt vinyetler */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-ink to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_100%,transparent_30%,rgba(10,13,18,0.75)_100%)]" />
    </div>
  );
}
