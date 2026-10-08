// Yönetim paneli grafikleri, matplotlib görünümünde: dört kenarı çizili eksen
// kutusu, dışa bakan tik işaretleri, varsayılan renk sırası (C0 mavi, C1
// turuncu, C4 mor), çerçeveli lejant, DejaVu Sans. Koyu modda matplotlib'in
// "dark_background" stili. Bağımlılık yok; SVG ile çizilir, etkileşimlidir.
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fmt } from './ui';

const TICK = 3.5; // matplotlib varsayılan tik uzunluğu (pt)
// Seriler renkle birlikte çizgi tipiyle de ayrılır (renk körlüğünde de okunur)
const DASHES = ['', '6 3', '8 3 2 3'];
const LEGEND_SWATCH = 22;

// Grafik kutusunun gerçek genişliği: SVG bu genişlikte çizilir, böylece dar
// kartlarda da yazılar 10 px kalır (ölçeklenip küçülmez)
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

function niceStep(max, count = 5) {
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= raw) * pow;
  return Math.max(1, step);
}

function niceTicks(maxValue, count = 5) {
  const step = niceStep(Math.max(1, maxValue), count);
  const top = Math.max(step, Math.ceil(maxValue / step) * step);
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { ticks, top };
}

const shortDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

// Eksen kutusu: dört kenar çizgisi (spines)
function Spines({ x0, y0, x1, y1 }) {
  return <rect className="mpl-spines" x={x0} y={y0} width={x1 - x0} height={y1 - y0} />;
}

// ax.plot(...) — çok serili çizgi grafik. Lejanttaki seriye tıklayınca gizlenir.
export function LineChart({ data, series, height = 260 }) {
  const [hidden, setHidden] = useState(() => new Set());
  const [hover, setHover] = useState(null);
  const [plotRef, W] = useWidth();
  const visible = series.filter((s) => !hidden.has(s.key));
  const H = height;
  const P = { top: 10, right: 12, bottom: 32, left: 46 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;

  const { ticks, top } = useMemo(
    () => niceTicks(Math.max(1, ...data.flatMap((d) => visible.map((s) => d[s.key] || 0)))),
    [data, visible]
  );
  // matplotlib x ekseninde verinin iki yanında %5 pay bırakır
  const margin = innerW * 0.05;
  const x = (i) => P.left + margin + (data.length <= 1 ? (innerW - 2 * margin) / 2 : (i / (data.length - 1)) * (innerW - 2 * margin));
  const y = (v) => P.top + innerH - (v / top) * innerH;
  const path = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key] || 0).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 80))));

  function onMove(e) {
    const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - P.left - margin) / (innerW - 2 * margin)) * (data.length - 1));
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
    <figure className="mpl-fig">
      {/* fig.legend(loc="upper center", ncol=3) */}
      <div className="mpl-legend" role="group" aria-label="Seriler">
        {series.map((s, i) => (
          <button key={s.key} type="button" className={hidden.has(s.key) ? 'off' : ''} onClick={() => toggle(s.key)} aria-pressed={!hidden.has(s.key)}>
            <svg width={LEGEND_SWATCH} height="10" aria-hidden="true">
              <line x1="1" x2={LEGEND_SWATCH - 1} y1="5" y2="5" stroke={s.color} strokeWidth="1.5" strokeDasharray={DASHES[i % DASHES.length]} />
            </svg>
            {s.label}
            <b>{fmt(data.reduce((sum, d) => sum + (d[s.key] || 0), 0))}</b>
          </button>
        ))}
      </div>
      <div className="mpl-plot" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${series.map((s) => s.label).join(', ')} günlük grafiği`}>
          <g className="mpl-grid">
            {ticks.map((t) => (
              <line key={t} x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          {visible.map((s) => {
            const idx = series.indexOf(s);
            return <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth="1.5" strokeDasharray={DASHES[idx % DASHES.length]} />;
          })}
          <Spines x0={P.left} y0={P.top} x1={W - P.right} y1={P.top + innerH} />
          <g className="mpl-ticks">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={P.left - TICK} x2={P.left} y1={y(t)} y2={y(t)} />
                <text x={P.left - TICK - 3} y={y(t) + 3.5} textAnchor="end">
                  {fmt(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <g key={d.date}>
                  <line x1={x(i)} x2={x(i)} y1={P.top + innerH} y2={P.top + innerH + TICK} />
                  <text x={x(i)} y={P.top + innerH + TICK + 12} textAnchor="middle">
                    {shortDate(d.date)}
                  </text>
                </g>
              ) : null
            )}
          </g>
          {hoverRow && (
            <g>
              <line className="mpl-cursor" x1={x(hover)} x2={x(hover)} y1={P.top} y2={P.top + innerH} />
              {visible.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(hoverRow[s.key] || 0)} r="4" className="mpl-marker" stroke={s.color} />
              ))}
            </g>
          )}
          <rect x={P.left} y={P.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hoverRow && (
          // ax.annotate(..., bbox=dict(boxstyle="round", fc="w"))
          <div className="mpl-annot" style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${x(hover) > W * 0.7 ? '-105%' : '5%'})` }}>
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
    </figure>
  );
}

// Yatay çubuklarda sol pay: en uzun etiket kadar (çok uzunsa kısaltılır)
// Sol pay en fazla genişliğin %38'i; sığmayan etiket kısaltılır (tamamı üzerine gelince görünür)
const CHAR_W = 6.1;
// ax.set_xlim(0, ...): en uzun çubuğun ucundaki etiket de kutuya sığsın
function barTicks(maxValue, innerW, longestLabel) {
  const labelW = longestLabel * CHAR_W + 8;
  const room = innerW - labelW;
  const need = room > innerW * 0.35 ? (maxValue * innerW) / room : maxValue * 2.2;
  return niceTicks(Math.max(1, need), 4);
}

function labelLayout(labels, W) {
  const maxPad = Math.min(200, W * 0.38);
  const maxChars = Math.max(6, Math.floor((maxPad - 14) / CHAR_W));
  const clip = (l) => (l.length > maxChars ? l.slice(0, maxChars - 1) + '…' : l);
  const pad = Math.min(maxPad, 14 + Math.max(0, ...labels.map((l) => clip(l).length)) * CHAR_W);
  return { pad, clip };
}

// ax.barh(...) + ax.bar_label(...) — dağılımlar ve en çok seçilenler
export function BarList({ items, color = 'var(--adm-c1)', labelFor = (k) => k, max: maxProp, total }) {
  const [hover, setHover] = useState(null);
  const [plotRef, W] = useWidth();
  const labels = items.map((it) => String(labelFor(it.key)));
  const { pad, clip } = labelLayout(labels, W);
  const ROW = 24;
  const P = { top: 6, right: 12, bottom: 30, left: pad };
  const H = P.top + items.length * ROW + P.bottom;
  const innerW = W - P.left - P.right;
  const shareOf = (c) => (total ? ` (%${Math.round((c / total) * 100)})` : '');
  const longest = Math.max(...items.map((it) => (fmt(it.count) + shareOf(it.count)).length));
  const { ticks, top } = barTicks(maxProp || Math.max(1, ...items.map((i) => i.count)), innerW, longest);
  const x = (v) => P.left + (v / top) * innerW;
  const rowY = (i) => P.top + i * ROW;
  const bottom = P.top + items.length * ROW;

  return (
    <figure className="mpl-fig">
      <div className="mpl-plot" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Yatay çubuk grafiği">
          <g className="mpl-grid">
            {ticks.map((t) => (
              <line key={t} x1={x(t)} x2={x(t)} y1={P.top} y2={bottom} />
            ))}
          </g>
          {items.map((it, i) => {
            const label = labels[i];
            const share = shareOf(it.count);
            return (
              <g key={it.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <title>{`${label}: ${fmt(it.count)}${share}`}</title>
                <rect
                  x={P.left}
                  y={rowY(i) + ROW * 0.1}
                  width={Math.max(1, x(it.count) - P.left)}
                  height={ROW * 0.8}
                  fill={color}
                  className={hover !== null && hover !== i ? 'mpl-dim' : ''}
                />
                <text className="mpl-barlabel" x={x(it.count) + 4} y={rowY(i) + ROW / 2 + 3.5}>
                  {fmt(it.count)}
                  {share}
                </text>
                {/* satırın tamamı üzerine gelme alanı (çubuktan geniş) */}
                <rect x={0} y={rowY(i)} width={W} height={ROW} fill="transparent" />
              </g>
            );
          })}
          <Spines x0={P.left} y0={P.top} x1={W - P.right} y1={bottom} />
          <g className="mpl-ticks">
            {items.map((it, i) => (
              <g key={it.key}>
                <line x1={P.left - TICK} x2={P.left} y1={rowY(i) + ROW / 2} y2={rowY(i) + ROW / 2} />
                <text x={P.left - TICK - 3} y={rowY(i) + ROW / 2 + 3.5} textAnchor="end">
                  {clip(labels[i])}
                </text>
              </g>
            ))}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + TICK} />
                <text x={x(t)} y={bottom + TICK + 12} textAnchor="middle">
                  {fmt(t)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  );
}

// Aktivasyon hunisi: ax.barh, ilk adım en üstte (ax.invert_yaxis()).
// Her çubuğun ucunda sayı ve kayda oranı, altında bir önceki adıma göre kayıp.
export function Funnel({ steps }) {
  const [plotRef, W] = useWidth();
  const labels = steps.map((s, i) => `${i + 1}. ${s.label}`);
  const { pad, clip } = labelLayout(labels, W);
  const ROW = 38;
  const P = { top: 6, right: 12, bottom: 30, left: pad };
  const H = P.top + steps.length * ROW + P.bottom;
  const innerW = W - P.left - P.right;
  const valueLabel = (st) => `${fmt(st.count)} (%${(st.rate || 0).toLocaleString('tr-TR')})`;
  const longest = Math.max(...steps.map((st) => valueLabel(st).length));
  const { ticks, top } = barTicks(Math.max(1, steps[0]?.count || 0), innerW, longest);
  const x = (v) => P.left + (v / top) * innerW;
  const rowY = (i) => P.top + i * ROW;
  const bottom = P.top + steps.length * ROW;

  return (
    <figure className="mpl-fig">
      <div className="mpl-plot" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Aktivasyon hunisi">
          <g className="mpl-grid">
            {ticks.map((t) => (
              <line key={t} x1={x(t)} x2={x(t)} y1={P.top} y2={bottom} />
            ))}
          </g>
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1].count : null;
            const lost = prev ? prev - s.count : 0;
            const barH = ROW * 0.5;
            const y0 = rowY(i) + 5;
            return (
              <g key={s.key}>
                <title>{`${labels[i]}: ${fmt(s.count)} (%${(s.rate || 0).toLocaleString('tr-TR')})`}</title>
                <rect x={P.left} y={y0} width={Math.max(1, x(s.count) - P.left)} height={barH} fill="var(--adm-c1)" />
                <text className="mpl-barlabel" x={x(s.count) + 4} y={y0 + barH / 2 + 3.5}>
                  {valueLabel(s)}
                </text>
                {lost > 0 && prev > 0 && (
                  <text className="mpl-drop" x={P.left + 4} y={y0 + barH + 11}>
                    −{fmt(lost)} kişi kaldı (%{Math.round((lost / prev) * 100)})
                  </text>
                )}
              </g>
            );
          })}
          <Spines x0={P.left} y0={P.top} x1={W - P.right} y1={bottom} />
          <g className="mpl-ticks">
            {steps.map((s, i) => (
              <g key={s.key}>
                <line x1={P.left - TICK} x2={P.left} y1={rowY(i) + 5 + ROW * 0.25} y2={rowY(i) + 5 + ROW * 0.25} />
                <text x={P.left - TICK - 3} y={rowY(i) + 5 + ROW * 0.25 + 3.5} textAnchor="end">
                  {clip(labels[i])}
                </text>
              </g>
            ))}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + TICK} />
                <text x={x(t)} y={bottom + TICK + 12} textAnchor="middle">
                  {fmt(t)}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  );
}

// ax.bar(...) — geri dönüş oranı: 1., 7. ve 30. gün. Tek ölçü olduğu için tek
// renk (C0); süresi dolmamış dönem çubuksuz, "yetersiz süre" notuyla gösterilir.
export function RetentionBars({ items, height = 210 }) {
  const [plotRef, W] = useWidth();
  const H = height;
  const P = { top: 10, right: 12, bottom: 30, left: 42 };
  const innerW = W - P.left - P.right;
  const innerH = H - P.top - P.bottom;
  const ticks = [0, 25, 50, 75, 100];
  const y = (v) => P.top + innerH - (v / 100) * innerH;
  const slot = innerW / items.length;
  const barW = Math.min(64, slot * 0.6);
  const cx = (i) => P.left + slot * i + slot / 2;
  const bottom = P.top + innerH;

  return (
    <figure className="mpl-fig">
      <div className="mpl-plot" ref={plotRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Geri dönüş oranı">
          <g className="mpl-grid">
            {ticks.map((t) => (
              <line key={t} x1={P.left} x2={W - P.right} y1={y(t)} y2={y(t)} />
            ))}
          </g>
          {items.map((r, i) => {
            const v = Math.min(Math.max(r.rate || 0, 0), 100);
            const detail = r.eligible ? `${fmt(r.returned)}/${fmt(r.eligible)} öğrenci` : 'yetersiz süre';
            return (
              <g key={r.day}>
                <title>{`${r.day}. gün: ${r.eligible ? `%${v.toLocaleString('tr-TR')} (${detail})` : 'henüz yeterli süre geçmedi'}`}</title>
                {r.eligible > 0 && <rect x={cx(i) - barW / 2} y={y(v)} width={barW} height={Math.max(0.8, bottom - y(v))} fill="var(--adm-c1)" />}
                <text className="mpl-barlabel" x={cx(i)} y={(r.eligible ? y(v) : bottom) - 16} textAnchor="middle">
                  {r.eligible ? `%${v.toLocaleString('tr-TR')}` : '—'}
                </text>
                <text className="mpl-barlabel mpl-sub" x={cx(i)} y={(r.eligible ? y(v) : bottom) - 4} textAnchor="middle">
                  {detail}
                </text>
              </g>
            );
          })}
          <Spines x0={P.left} y0={P.top} x1={W - P.right} y1={bottom} />
          <g className="mpl-ticks">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={P.left - TICK} x2={P.left} y1={y(t)} y2={y(t)} />
                <text x={P.left - TICK - 3} y={y(t) + 3.5} textAnchor="end">
                  %{t}
                </text>
              </g>
            ))}
            {items.map((r, i) => (
              <g key={r.day}>
                <line x1={cx(i)} x2={cx(i)} y1={bottom} y2={bottom + TICK} />
                <text x={cx(i)} y={bottom + TICK + 12} textAnchor="middle">
                  {r.day}. gün
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  );
}
