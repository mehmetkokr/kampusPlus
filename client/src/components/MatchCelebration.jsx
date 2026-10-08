import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { MessageCircle, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import { hasWebGL } from '../utils/webgl';

// Eşleşme anı: iki profil fotoğrafı, büyük başlık, "Mesaj gönder" ve
// "Kaydırmaya devam et". Arkada kısa bir 3D kalp patlaması (WebGL varsa ve
// hareket azaltılmadıysa; parça yalnızca ilk eşleşmede yüklenir).
const MatchHearts3D = lazy(() => import('./MatchHearts3D'));

function Face({ person, side }) {
  return (
    <span className={`match-face match-face-${side}`}>
      {person?.photoUrl ? <img src={`${API_BASE_URL}${person.photoUrl}`} alt="" /> : <UserRound size={40} />}
    </span>
  );
}

export default function MatchCelebration({ me, other, matchId, onMessage, onClose }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(() => !reduce && hasWebGL());
  const primaryRef = useRef(null);
  const firstName = other?.fullName?.split(' ')[0] || '';

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const spring = reduce ? { duration: 0 } : { type: 'spring', duration: 0.6, bounce: 0.3 };

  return createPortal(
    <motion.div
      className="match-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
    >
      {burst && (
        <Suspense fallback={null}>
          <MatchHearts3D onDone={() => setBurst(false)} />
        </Suspense>
      )}
      <div className="match-content">
        <div className="match-faces" aria-hidden="true">
          <motion.span initial={{ x: reduce ? 0 : -60, rotate: 0, opacity: 0 }} animate={{ x: 0, rotate: -8, opacity: 1 }} transition={spring}>
            <Face person={me} side="left" />
          </motion.span>
          <motion.span initial={{ x: reduce ? 0 : 60, rotate: 0, opacity: 0 }} animate={{ x: 0, rotate: 8, opacity: 1 }} transition={spring}>
            <Face person={other} side="right" />
          </motion.span>
        </div>
        <motion.h2 id="match-title" initial={{ y: reduce ? 0 : 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: reduce ? 0 : 0.12 }}>
          {t('Eşleştiniz!')}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.22 }}>
          {t('{name} ile birbirinizi beğendiniz. İlk mesajı sen at.', { name: firstName })}
        </motion.p>
        <motion.div className="match-actions" initial={{ y: reduce ? 0 : 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: reduce ? 0 : 0.3 }}>
          <button ref={primaryRef} type="button" className="match-primary" onClick={() => onMessage(matchId)} disabled={!matchId}>
            <MessageCircle size={18} /> {t('Mesaj gönder')}
          </button>
          <button type="button" className="match-secondary" onClick={onClose}>
            {t('Kaydırmaya devam et')}
          </button>
        </motion.div>
      </div>
    </motion.div>,
    document.body
  );
}
