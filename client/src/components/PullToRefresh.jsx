import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw } from './icons';
import { haptic, isNative } from '../lib/native';
import { useI18n } from '../i18n';
import '../styles/pull-to-refresh.css';

// Aşağı çekip yenileme (yalnızca telefon uygulamasında; tarayıcının kendi
// yenilemesiyle çakışmasın diye webde kapalı). Sayfanın en üstündeyken parmak
// aşağı çekilince üstte bir yenileme simgesi belirir; eşik geçilip
// bırakılınca onRefresh çağrılır ve bitene kadar simge döner.
const THRESHOLD = 70;
const MAX = 110;

export default function PullToRefresh({ onRefresh }) {
  const { t } = useI18n();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null);
  const armed = useRef(false);
  const busy = useRef(false);
  // Son verilen yenileme fonksiyonu (dinleyiciler her çizimde yeniden kurulmasın)
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!isNative) return undefined;
    const onStart = (e) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) return;
      // Açık bir pencere (modal, alt sayfa) varken çekme yenilemesi yok
      if (document.querySelector('.modal-overlay, .story-cam, .pe-overlay, [role="dialog"]')) return;
      start.current = e.touches[0].clientY;
      armed.current = false;
    };
    const onMove = (e) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Lastik etkisi: çektikçe direnç artar
      const d = Math.min(MAX, dy * 0.5);
      setPull(d);
      if (d >= THRESHOLD && !armed.current) {
        armed.current = true;
        haptic(10);
      } else if (d < THRESHOLD) armed.current = false;
    };
    const onEnd = async () => {
      if (start.current === null) return;
      start.current = null;
      if (!armed.current) {
        setPull(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await refreshRef.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
        setPull(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []);

  if (!isNative || (pull === 0 && !refreshing)) return null;
  const progress = Math.min(1, pull / THRESHOLD);
  return createPortal(
    <div
      className={`ptr ${refreshing ? 'is-refreshing' : ''} ${start.current === null ? 'is-settling' : ''}`}
      style={{ '--ptr-y': `${pull}px` }}
      role="status"
      aria-live="polite"
      aria-label={refreshing ? t('Yenileniyor') : t('Yenilemek için bırak')}
    >
      <span className="ptr-dot" style={{ opacity: Math.max(0.35, progress), transform: `rotate(${progress * 270}deg)` }}>
        <RotateCw size={18} />
      </span>
    </div>,
    document.body
  );
}
