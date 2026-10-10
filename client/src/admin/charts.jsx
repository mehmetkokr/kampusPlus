// Yönetim paneli grafikleri, TailAdmin (ApexCharts) görünümünde: yalnızca
// yatay ızgara çizgileri, gri eksen yazıları, altı yumuşak dolgulu alan
// grafiği, yuvarlak köşeli sütunlar ve ilerleme çubukları. Bağımlılık yok;
// SVG ile, kutunun gerçek genişliğinde çizilir ve etkileşimlidir.
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmt } from './ui';

function useWidth(fallback = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(220, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(maxValue, count = 5) {
  const raw = Math.max(1, maxValue) / (count - 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].find((s) => s * pow >= raw) * pow);
  const top = Math.max(step, Math.ceil(Math.max(1, maxValue) / step) * step);
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { ticks, top };
}

const shortDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

// Alan grafiği (StatisticsChart): lejanttaki seriye tıklayınca gizlenir
export function LineChart({ data, series, height = 300 }) {
  const gid = useId().replace(/:/g, '');
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  const [plotRef, W] = useWidth();
  const visible = series.filter((s) => !hidden.has(s.key));
  const H = height;
  const P = { top: 10, right: 8, bottom: 30, left: 40 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  const { ticks, top } = useMemo(
    () => niceTicks(Math.max(1, ...data.flatMap((d) => visible.map((s) => d[s.key] || 0)))),
    [data, visible]
  );
  const x = (i) => P.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => P.top + innerH - (v / top) * innerH;
  const line = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key] || 0).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 80))));

  function onMove(e) {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - P.left) / innerW) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  }

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visible.length > 1) next.add(key);
      return next;
    });

  const hoverRow = hover !== null ? data[hover] : null;
  return (
    <div>
      <div className="ta-legend" role="group" aria-label="Seriler">
        {series.map((s) => (
          <button key={s.key} type="button" className={hidden.has(s.key) ? 'off' : ''} onClick={() => toggle(s.key)} aria-pressed={!hidden.has(s.key)}>
            <i style={{ background: s.color }} aria-hidden="true" />
            {s.label}
            <b>{fmt(data.reduce((sum, d) => sum + (d[s.key] || 0), 0))}</b>
          </button>
        ))}
      </div>
      <div className="ta-chart" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${series.map((s) => s.label).join(', ')} günlük grafiği`}>
          <defs>
            {visible.map((s) => (
              <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.55" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <g className="ta-grid">
            {ticks.map((t) => (
              <line key={t} x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <g className="ta-axis">
            {ticks.map((t) => (
              <text key={t} x={P.left - 10} y={y(t) + 4} textAnchor="end">
                {fmt(t)}
              </text>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={d.date} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
                  {shortDate(d.date)}
                </text>
              ) : null
            )}
          </g>
          {visible.map((s) => (
            <g key={s.key}>
              <path d={`${line(s.key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gid}-${s.key})`} />
              <path d={line(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {hoverRow && (
            <g>
              <line className="ta-cursor" x1={x(hover)} x2={x(hover)} y1={P.top} y2={P.top + innerH} />
              {visible.map((s) => (
                <circle key={s.key} className="ta-marker" cx={x(hover)} cy={y(hoverRow[s.key] || 0)} r="5" fill={s.color} />
              ))}
            </g>
          )}
          <rect x={P.left} y={P.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hoverRow && (
          <div className="ta-tooltip" style={{ left: x(hover), transform: `translateX(${x(hover) > W * 0.65 ? 'calc(-100% - 12px)' : '12px'})` }}>
            <b>{shortDate(hoverRow.date)}</b>
            {visible.map((s) => (
              <div key={s.key}>
                <span>
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
                <strong>{fmt(hoverRow[s.key] || 0)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// İlerleme çubukları (DemographicCard): dağılımlar ve en çok seçilenler
export function BarList({ items, color = 'var(--adm-c1)', labelFor = (k) => k, max: maxProp, total }) {
  const max = maxProp || Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="ta-bars">
      {items.map((it) => {
        const label = String(labelFor(it.key));
        const share = total ? Math.round((it.count / total) * 100) : null;
        return (
          <div className="ta-bar-row" key={it.key} title={`${label}: ${fmt(it.count)}${share !== null ? ` (%${share})` : ''}`}>
            <span className="name">{label}</span>
            <span className="val">
              {fmt(it.count)}
              {share !== null && <small>%{share}</small>}
            </span>
            <div className="ta-track" role="presentation">
              <div className="ta-fill" style={{ width: `${Math.max(2, (it.count / max) * 100)}%`, '--c': color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Aktivasyon hunisi: her adım ilk adıma göre çubuk; altında bir önceki adıma göre kayıp
export function Funnel({ steps }) {
  const first = steps[0]?.count || 0;
  return (
    <div className="ta-bars">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const lost = prev ? prev - s.count : 0;
        return (
          <div className="ta-bar-row" key={s.key}>
            <span className="name">
              {i + 1}. {s.label}
            </span>
            <span className="val">
              {fmt(s.count)}
              <small>%{(s.rate || 0).toLocaleString('tr-TR')}</small>
            </span>
            <div className="ta-track" role="presentation">
              <div className="ta-fill" style={{ width: `${first ? Math.max(2, (s.count / first) * 100) : 2}%` }} />
            </div>
            {lost > 0 && prev > 0 && (
              <span className="ta-drop">
                {fmt(lost)} kişi bu adımda kaldı (%{Math.round((lost / prev) * 100)})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Sütun grafiği (MonthlySalesChart): geri dönüş oranı, 1./7./30. gün.
// Süresi dolmamış dönem sütunsuz, "yetersiz süre" notuyla gösterilir.
export function RetentionBars({ items, height = 240 }) {
  const [plotRef, W] = useWidth();
  const [hover, setHover] = useState(null);
  const H = height;
  const P = { top: 26, right: 8, bottom: 30, left: 40 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;
  const ticks = [0, 25, 50, 75, 100];
  const y = (v) => P.top + innerH - (v / 100) * innerH;
  const slot = innerW / items.length;
  const barW = Math.min(56, slot * 0.39);
  const cx = (i) => P.left + slot * i + slot / 2;
  const bottom = P.top + innerH;
  const R = 5;

  // Yalnızca üst köşeleri yuvarlak sütun
  const col = (x0, y0, w, h) => {
    const r = Math.min(R, w / 2, h);
    return `M${x0},${y0 + h} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + w - r} Q${x0 + w},${y0} ${x0 + w},${y0 + r} V${y0 + h} Z`;
  };

  return (
    <div className="ta-chart" ref={plotRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Geri dönüş oranı">
        <g className="ta-grid">
          {ticks.map((t) => (
            <line key={t} x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="ta-axis">
          {ticks.map((t) => (
            <text key={t} x={P.left - 10} y={y(t) + 4} textAnchor="end">
              %{t}
            </text>
          ))}
          {items.map((r, i) => (
            <text key={r.day} x={cx(i)} y={H - 8} textAnchor="middle">
              {r.day}. gün
            </text>
          ))}
        </g>
        {items.map((r, i) => {
          const v = Math.min(Math.max(r.rate || 0, 0), 100);
          const top = r.eligible ? y(v) : bottom;
          return (
            <g key={r.day} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <title>{`${r.day}. gün: ${r.eligible ? `%${v.toLocaleString('tr-TR')} (${fmt(r.returned)}/${fmt(r.eligible)} öğrenci)` : 'henüz yeterli süre geçmedi'}`}</title>
              <rect x={cx(i) - slot / 2} y={P.top} width={slot} height={innerH} fill="transparent" />
              {r.eligible > 0 && (
                <path d={col(cx(i) - barW / 2, top, barW, Math.max(1, bottom - top))} fill="var(--adm-c1)" opacity={hover === null || hover === i ? 1 : 0.55} />
              )}
              <text className="ta-axis-value" x={cx(i)} y={top - 8} textAnchor="middle" fill="var(--text)" fontSize="13" fontWeight="600" fontFamily="var(--adm-font)">
                {r.eligible ? `%${v.toLocaleString('tr-TR')}` : 'yetersiz süre'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
