// Yönetim paneli grafikleri: bağımlılık yok, SVG ile çizilir.
import React, { useId, useMemo, useRef, useState } from 'react';
import { fmt } from './ui';

const W = 640;
const PAD = { top: 12, right: 8, bottom: 26, left: 34 };

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow * 4 >= v) * pow;
  return step * 4;
}

const shortDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

// Çok serili çizgi grafik. Göstergeye tıklayınca seri açılıp kapanır.
export function LineChart({ data, series, height = 230 }) {
  const id = useId().replace(/:/g, '');
  const wrapRef = useRef(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  const visible = series.filter((s) => !hidden.has(s.key));
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = useMemo(
    () => niceMax(Math.max(1, ...data.flatMap((d) => visible.map((s) => d[s.key] || 0)))),
    [data, visible]
  );
  const x = (i) => PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key] || 0).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.left) / innerW) * (data.length - 1));
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
      <div className="adm-legend" style={{ marginBottom: 10 }}>
        {series.map((s) => (
          <button
            key={s.key}
            type="button"
            className={hidden.has(s.key) ? '' : 'on'}
            style={{ '--c': s.color }}
            onClick={() => toggle(s.key)}
            aria-pressed={!hidden.has(s.key)}
          >
            <i /> {s.label}
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(data.reduce((sum, d) => sum + (d[s.key] || 0), 0))}</b>
          </button>
        ))}
      </div>
      <div className="adm-chart" ref={wrapRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.map((s) => s.label).join(', ')} günlük grafiği`}>
          <defs>
            {visible.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <g className="grid">
            {ticks.map((t) => (
              <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          <g className="axis">
            {ticks.map((t) => (
              <text key={t} x={PAD.left - 8} y={y(t) + 3} textAnchor="end">
                {fmt(t)}
              </text>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={d.date} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
                  {shortDate(d.date)}
                </text>
              ) : null
            )}
          </g>
          {visible.map((s) => (
            <g key={s.key}>
              <path d={`${path(s.key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-${s.key})`} />
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {hoverRow && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--text-faint)" strokeDasharray="3 3" />
              {visible.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(hoverRow[s.key] || 0)} r="4" fill="var(--surface)" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          )}
          <rect
            x={PAD.left}
            y={0}
            width={innerW}
            height={H}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hoverRow && (
          <div className="adm-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <b>{shortDate(hoverRow.date)}</b>
            {visible.map((s) => (
              <div key={s.key} style={{ '--c': s.color }}>
                <span>
                  <i />
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

// Yatay çubuk listesi (dağılımlar, en çok seçilenler)
export function BarList({ items, color, labelFor = (k) => k, max: maxProp, total }) {
  const max = maxProp || Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="adm-bars">
      {items.map((it) => (
        <div className="adm-bar-row" key={it.key}>
          <span>{labelFor(it.key)}</span>
          <b>
            {fmt(it.count)}
            {total ? <span className="adm-faint"> · %{Math.round((it.count / total) * 100)}</span> : null}
          </b>
          <div className="adm-bar-track">
            <div className="adm-bar-fill" style={{ width: `${Math.max(2, (it.count / max) * 100)}%`, '--c': color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Aktivasyon hunisi: her adımın kayıt olanlara oranı ve bir önceki adıma göre kayıp
export function Funnel({ steps }) {
  const first = steps[0]?.count || 0;
  return (
    <div className="adm-funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].count : null;
        const lost = prev ? prev - s.count : 0;
        return (
          <div className="adm-funnel-step" key={s.key}>
            <span className="n">{i + 1}</span>
            <span className="label">{s.label}</span>
            <span className="val">
              {fmt(s.count)}
              <small>%{(s.rate || 0).toLocaleString('tr-TR')}</small>
            </span>
            <div className="adm-bar-track">
              <div
                className="adm-bar-fill"
                style={{ width: `${first ? Math.max(2, (s.count / first) * 100) : 2}%`, '--c': `color-mix(in srgb, var(--amber-soft) ${100 - i * 11}%, var(--adm-c3))` }}
              />
            </div>
            {lost > 0 && prev > 0 && (
              <span className="adm-funnel-drop">
                {fmt(lost)} kişi bu adımda kaldı (%{Math.round((lost / prev) * 100)})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
