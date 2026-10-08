import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Crop, RotateCcw, Sparkles, SunMedium, Undo2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { loadBitmap } from '../utils/image';
import { ADJUSTMENTS, NO_ADJUST, PRESETS, applyMatrix, buildMatrix, combine, isIdentity, toSvgValues } from '../utils/colorMatrix';

// Paylaşmadan önce fotoğrafı kırp, döndür, ışığını ayarla, filtre uygula.
// Görüntü sabit bir çerçevenin arkasında sürüklenir ve yakınlaştırılır
// (iki parmakla, fare tekerleğiyle ya da sürgüyle); çerçeve hep doludur.
// Sonuç en fazla 1600 px uzun kenarlı bir JPEG olarak döner.

export const ASPECTS = {
  original: { label: 'Orijinal', ratio: null },
  '1:1': { label: 'Kare', ratio: 1 },
  '4:5': { label: '4:5', ratio: 4 / 5 },
  '3:4': { label: '3:4', ratio: 3 / 4 },
  '9:16': { label: '9:16', ratio: 9 / 16 },
};

const MAX_SIDE = 1600;
const MAX_ZOOM = 5;
const STAGE_PAD = 20;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function PhotoEditor({ file, options = {}, onDone, onCancel }) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  const aspects = options.aspects?.length ? options.aspects : ['original', '1:1', '4:5'];

  const [src, setSrc] = useState(null);
  const [nat, setNat] = useState(null); // { w, h } EXIF yönü uygulanmış boyut
  const [aspectKey, setAspectKey] = useState(options.defaultAspect || aspects[0]);
  const [rot, setRot] = useState(0);
  const [view, setView] = useState({ zoom: 1, nx: 0, ny: 0 });
  const [tab, setTab] = useState('crop');
  const [preset, setPreset] = useState('none');
  const [adjust, setAdjust] = useState(NO_ADJUST);
  const [activeAdj, setActiveAdj] = useState('light');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const stageRef = useRef(null);
  const doneRef = useRef(null);
  const pointers = useRef(new Map());

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStage({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Esc ile vazgeç; arka plandaki sayfa kaymasın
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    doneRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  // Çerçeve ve ölçek hesabı
  const geom = useMemo(() => {
    if (!nat || !stage.w) return null;
    const [rw, rh] = rot % 180 ? [nat.h, nat.w] : [nat.w, nat.h];
    const ratio = ASPECTS[aspectKey]?.ratio || rw / rh;
    const avW = Math.max(40, stage.w - STAGE_PAD * 2);
    const avH = Math.max(40, stage.h - STAGE_PAD * 2);
    const fw = Math.min(avW, avH * ratio);
    const fh = fw / ratio;
    const s0 = Math.max(fw / rw, fh / rh);
    return { rw, rh, fw, fh, s0 };
  }, [nat, stage, rot, aspectKey]);

  const geomRef = useRef(geom);
  geomRef.current = geom;

  // Görüntü çerçeveyi her zaman tamamen kaplasın
  const clampView = useCallback((v) => {
    const g = geomRef.current;
    if (!g) return v;
    const zoom = clamp(v.zoom, 1, MAX_ZOOM);
    const s = g.s0 * zoom;
    const maxX = Math.max(0, (g.rw * s - g.fw) / 2 / g.fw);
    const maxY = Math.max(0, (g.rh * s - g.fh) / 2 / g.fh);
    return { zoom, nx: clamp(v.nx, -maxX, maxX), ny: clamp(v.ny, -maxY, maxY) };
  }, []);

  const v = clampView(view);

  function resetCrop() {
    setRot(0);
    setView({ zoom: 1, nx: 0, ny: 0 });
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setDragging(true);
  }

  function onPointerMove(e) {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    const g = geomRef.current;
    if (!prev || !g) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (map.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setView((old) => clampView({ ...clampView(old), nx: clampView(old).nx + dx / g.fw, ny: clampView(old).ny + dy / g.fh }));
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y) || 1;
        const after = Math.hypot(cur.x - other.x, cur.y - other.y) || 1;
        const dx = (cur.x - prev.x) / 2;
        const dy = (cur.y - prev.y) / 2;
        setView((old) => {
          const o = clampView(old);
          return clampView({ zoom: o.zoom * (after / before), nx: o.nx + dx / g.fw, ny: o.ny + dy / g.fh });
        });
      }
    }
    map.set(e.pointerId, cur);
  }

  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  }

  function onWheel(e) {
    setView((old) => clampView({ ...clampView(old), zoom: clampView(old).zoom * Math.exp(-e.deltaY * 0.0015) }));
  }

  function onStageKey(e) {
    const step = e.shiftKey ? 0.05 : 0.015;
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setView((old) => clampView({ ...clampView(old), nx: clampView(old).nx + m[0], ny: clampView(old).ny + m[1] }));
  }

  const values = combine(preset, adjust);
  const matrix = buildMatrix(values);
  const identity = isIdentity(matrix);

  async function finish() {
    if (!geom || saving) return;
    setSaving(true);
    try {
      const bmp = await loadBitmap(file);
      const iw = bmp.width;
      const ih = bmp.height;
      const { fw, fh, s0 } = geom;
      const s = s0 * v.zoom;
      // Çerçevenin kapsadığı gerçek piksel sayısı; büyütülerek çözünürlük uydurulmaz
      let outW = fw / s;
      let outH = fh / s;
      const f = Math.min(1, MAX_SIDE / Math.max(outW, outH));
      outW = Math.max(1, Math.round(outW * f));
      outH = Math.max(1, Math.round(outH * f));
      const k = outW / fw;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(outW / 2 + v.nx * fw * k, outH / 2 + v.ny * fh * k);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(s * k, s * k);
      ctx.drawImage(bmp, -iw / 2, -ih / 2);
      bmp.close?.();

      if (!identity) {
        const data = ctx.getImageData(0, 0, outW, outH);
        ctx.putImageData(applyMatrix(data, matrix), 0, 0);
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
      if (!blob) throw new Error('export');
      const name = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg';
      onDone(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
    } catch {
      // Düzenlenemeyen bir dosyaysa olduğu gibi gönder; paylaşım hiç engellenmesin
      onDone(file);
    }
  }

  const s = geom ? geom.s0 * v.zoom : 1;
  const imgStyle = geom &&
    nat && {
      width: nat.w * s,
      height: nat.h * s,
      transform: `translate(-50%, -50%) translate(${v.nx * geom.fw}px, ${v.ny * geom.fh}px) rotate(${rot}deg)`,
      filter: identity ? undefined : `url(#pe-main-${uid})`,
    };

  const activeValue = adjust[activeAdj] || 0;

  return (
    <div className="pe-overlay" role="dialog" aria-modal="true" aria-labelledby={`pe-title-${uid}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id={`pe-main-${uid}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={toSvgValues(matrix)} />
        </filter>
        {PRESETS.map((p) => (
          <filter key={p.key} id={`pe-${p.key}-${uid}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values={toSvgValues(buildMatrix(combine(p.key, NO_ADJUST)))} />
          </filter>
        ))}
      </svg>

      <header className="pe-top">
        <button type="button" className="pe-text-btn" onClick={onCancel}>
          {t('Vazgeç')}
        </button>
        <h2 id={`pe-title-${uid}`}>{t(options.title || 'Fotoğrafı düzenle')}</h2>
        <button ref={doneRef} type="button" className="pe-done-btn" onClick={finish} disabled={!geom || saving}>
          {saving ? t('Hazırlanıyor…') : t(options.doneLabel || 'Bitti')}
        </button>
      </header>

      <div
        ref={stageRef}
        className="pe-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onStageKey}
        tabIndex={0}
        aria-label={t('Fotoğrafı sürükleyerek konumlandır, iki parmakla yakınlaştır')}
      >
        {geom && (
          <div className="pe-frame" style={{ width: geom.fw, height: geom.fh }}>
            {src && (
              <img
                className="pe-img"
                src={src}
                alt=""
                draggable={false}
                style={imgStyle || { opacity: 0 }}
                onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
            )}
            <div className={`pe-mask ${dragging ? 'is-dragging' : ''}`} aria-hidden="true">
              <span className="pe-grid" />
            </div>
          </div>
        )}
        {!geom && src && (
          <img
            src={src}
            alt=""
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
        )}
      </div>

      <div className="pe-tools">
        <div className="pe-panel">
          {tab === 'crop' && (
            <>
              <div className="pe-chips" role="radiogroup" aria-label={t('Kırpma oranı')}>
                {aspects.length > 1 &&
                  aspects.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={aspectKey === key}
                      className={`pe-chip ${aspectKey === key ? 'is-on' : ''}`}
                      onClick={() => {
                        setAspectKey(key);
                        setView({ zoom: 1, nx: 0, ny: 0 });
                      }}
                    >
                      {t(ASPECTS[key].label)}
                    </button>
                  ))}
                <button type="button" className="pe-chip pe-icon-chip" onClick={() => { setRot((r) => (r + 270) % 360); setView({ zoom: 1, nx: 0, ny: 0 }); }} aria-label={t('Sola döndür')}>
                  <RotateCcw size={17} />
                </button>
                <button type="button" className="pe-chip pe-icon-chip" onClick={resetCrop} aria-label={t('Kırpmayı sıfırla')}>
                  <Undo2 size={17} />
                </button>
              </div>
              <label className="pe-slider">
                <span>{t('Yakınlaştır')}</span>
                <input
                  type="range"
                  min="1"
                  max={MAX_ZOOM}
                  step="0.01"
                  value={v.zoom}
                  onChange={(e) => setView((old) => clampView({ ...clampView(old), zoom: Number(e.target.value) }))}
                />
              </label>
            </>
          )}

          {tab === 'adjust' && (
            <>
              <div className="pe-chips" role="radiogroup" aria-label={t('Ayar')}>
                {ADJUSTMENTS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    role="radio"
                    aria-checked={activeAdj === a.key}
                    className={`pe-chip ${activeAdj === a.key ? 'is-on' : ''}`}
                    onClick={() => setActiveAdj(a.key)}
                    onDoubleClick={() => setAdjust((p) => ({ ...p, [a.key]: 0 }))}
                  >
                    {t(a.label)}
                    {adjust[a.key] !== 0 && <span className="pe-chip-val">{adjust[a.key] > 0 ? '+' : ''}{adjust[a.key]}</span>}
                  </button>
                ))}
              </div>
              <label className="pe-slider is-centered">
                <span>
                  {t(ADJUSTMENTS.find((a) => a.key === activeAdj).label)} <b>{activeValue > 0 ? '+' : ''}{activeValue}</b>
                </span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={activeValue}
                  onChange={(e) => setAdjust((p) => ({ ...p, [activeAdj]: Number(e.target.value) }))}
                />
              </label>
            </>
          )}

          {tab === 'filters' && (
            <div className="pe-filters" role="radiogroup" aria-label={t('Filtre')}>
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={preset === p.key}
                  className={`pe-filter ${preset === p.key ? 'is-on' : ''}`}
                  onClick={() => setPreset(p.key)}
                >
                  {src && <img src={src} alt="" style={{ filter: p.key === 'none' ? undefined : `url(#pe-${p.key}-${uid})` }} />}
                  <span>{t(p.label)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="pe-tabs" role="tablist" aria-label={t('Düzenleme araçları')}>
          {[
            { key: 'crop', label: 'Kırp', icon: Crop },
            { key: 'adjust', label: 'Ayarla', icon: SunMedium },
            { key: 'filters', label: 'Filtreler', icon: Sparkles },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={`pe-tab ${tab === key ? 'is-on' : ''}`} onClick={() => setTab(key)}>
              <Icon size={20} />
              <span>{t(label)}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
