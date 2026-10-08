import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import api from '../../api';
import Reveal from './Reveal';
import { useI18n } from '../../i18n';
import { hasWebGL, useNearViewport, useThemeMode } from '../../utils/webgl';
import data from './turkeyMap.json';

// "Türkiye genelinde" bölümü: 81 ilin hepsinde en az bir üniversite var.
// WebGL varsa kabartma 3D harita (ekrana yaklaşınca yüklenir ve yalnızca
// görünürken çizilir); yoksa aynı veriden düz bir SVG harita.
const CampusMap3D = lazy(() => import('./CampusMap3D'));

const pts = data.rings.flat();
const MIN_X = Math.min(...pts.map((p) => p[0]));
const MAX_X = Math.max(...pts.map((p) => p[0]));
const MIN_Y = Math.min(...pts.map((p) => p[1]));
const MAX_Y = Math.max(...pts.map((p) => p[1]));
const PAD = 0.4;
const VB = `${MIN_X - PAD} ${-MAX_Y - PAD} ${MAX_X - MIN_X + PAD * 2} ${MAX_Y - MIN_Y + PAD * 2}`;

function FlatMap() {
  return (
    <svg viewBox={VB} className="landing-map-flat" aria-hidden="true">
      {data.rings.map((ring, i) => (
        <polygon key={i} points={ring.map(([x, y]) => `${x},${-y}`).join(' ')} />
      ))}
      {data.provinces.map((p) => (
        <circle key={p.name} cx={p.x} cy={-p.y} r="0.08" />
      ))}
    </svg>
  );
}

export default function CampusMapSection() {
  const { t } = useI18n();
  const mode = useThemeMode();
  const reduce = useReducedMotion();
  const [boxRef, near] = useNearViewport('300px');
  const [webgl] = useState(() => typeof window !== 'undefined' && hasWebGL());
  const [loaded, setLoaded] = useState(false);
  const [uniCount, setUniCount] = useState(null);
  const [hover, setHover] = useState(null); // { i, x, y }
  const frameRef = useRef(null);

  useEffect(() => {
    api
      .get('/universities')
      .then((res) => setUniCount(Array.isArray(res.data) ? res.data.length : null))
      .catch(() => {});
  }, []);

  // 3D parça bir kez ekrana yaklaşınca yüklenir; sonra görünürlüğe göre durur/çalışır
  useEffect(() => {
    if (near && webgl) setLoaded(true);
  }, [near, webgl]);

  const onHover = useCallback((i, ev) => {
    if (i === null || !ev || !frameRef.current) return setHover(null);
    const rect = frameRef.current.getBoundingClientRect();
    setHover({ i, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
  }, []);

  const hovered = hover ? data.provinces[hover.i] : null;

  return (
    <section id="turkiye" className="relative scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:px-8">
        <Reveal className="text-center lg:text-left">
          <p className="landing-eyebrow">{t('Türkiye genelinde')}</p>
          <h2 className="landing-h2 mt-3">{t('81 ilin hepsinde bir kampüs var.')}</h2>
          <p className="mx-auto mt-4 max-w-md text-[1.0625rem] leading-relaxed text-paper-muted lg:mx-0">
            {t('Türkiye\'nin her ilinde en az bir üniversite bulunuyor. Hangi şehirde okursan oku, okul e-postanla kendi kampüsündeki öğrencilerle tanışırsın.')}
          </p>
          <dl className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-3 lg:mx-0">
            {[
              ['81', t('il')],
              [uniCount ? String(uniCount) : '200+', t('üniversite')],
              ['1 dk', t('doğrulama')],
            ].map(([n, label]) => (
              <div key={label} className="landing-map-stat">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <strong>{n}</strong>
                  <span>{label}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 hidden text-[0.875rem] text-paper-faint sm:block lg:text-left">
            {webgl ? t('Bir ilin üzerine gel ya da dokun.') : ''}
          </p>
        </Reveal>

        <div
          ref={(el) => {
            boxRef.current = el;
            frameRef.current = el;
          }}
          className="landing-map-frame"
          role="img"
          aria-label={t('Türkiye haritası: 81 ilin tamamında üniversite var')}
          onPointerLeave={() => setHover(null)}
        >
          {/* Düz harita her zaman altta: 3D yüklenene kadar ve WebGL yoksa görünür */}
          <div className={`landing-map-layer ${loaded ? 'is-hidden' : ''}`}>
            <FlatMap />
          </div>
          {loaded && (
            <div className="landing-map-layer landing-map-3d" data-html2canvas-ignore>
              <Suspense fallback={null}>
                <CampusMap3D mode={mode} active={near} animate={!reduce} hovered={hover?.i ?? null} onHover={onHover} />
              </Suspense>
            </div>
          )}
          {hovered && (
            <div className="landing-map-tip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
              <MapPin size={13} /> {hovered.name}
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {hovered ? hovered.name : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
