import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart, MessageCircle } from './icons';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';

// Eşleşme anı: iki kişinin buluşması gibi.
// İki fotoğraf iki yandan, adım atar gibi hafifçe sekerek birbirine yaklaşır,
// buluşunca birbirine doğru eğilir; aralarında küçük bir kalp belirip iki kez
// atar (kalp atışı). Telefon destekliyorsa iki kısa titreşim. Ardından başlık
// ve "Mesaj gönder". Arka planda süs/patlama yok; dikkat iki kişide.
// Hareket azaltma açıksa her şey yerinde, animasyonsuz görünür.

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('tr');

function Face({ person, side }) {
  return (
    <span className={`match-face match-face-${side}`}>
      {person?.photoUrl ? <img src={`${API_BASE_URL}${person.photoUrl}`} alt="" /> : <span className="match-initials">{initialsOf(person?.fullName)}</span>}
    </span>
  );
}

// Yaklaşma: iki "adım" (küçük sekme), sonra buluşup birbirine eğilme
const WALK = 0.9;
const MEET = WALK; // buluşma anı (sn)

export default function MatchCelebration({ me, other, matchId, onMessage, onClose }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const primaryRef = useRef(null);
  const firstName = other?.fullName?.split(' ')[0] || '';

  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Buluşma anında kalp atışı gibi iki kısa titreşim (destekleyen telefonlarda)
    const buzz = reduce ? null : setTimeout(() => navigator.vibrate?.([14, 90, 22]), MEET * 1000 + 150);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(buzz);
    };
  }, [onClose, reduce]);

  // dir: -1 soldaki (sen), 1 sağdaki (o). Kendi tarafından başlar, ortaya
  // yürür; sonunda öbürüne doğru eğilir.
  const approach = (dir) =>
    reduce
      ? { initial: false, animate: { x: 0, rotate: -dir * 6 } }
      : {
          initial: { x: dir * 150, y: 0, rotate: dir * 4, opacity: 0 },
          animate: {
            x: [dir * 150, dir * 95, dir * 45, 0],
            y: [0, -7, 0, 0],
            rotate: [dir * 4, dir * 1, 0, -dir * 6],
            opacity: [0, 1, 1, 1],
          },
          transition: { duration: WALK, times: [0, 0.35, 0.7, 1], ease: [0.33, 1, 0.68, 1] },
        };

  const after = (delay) => (reduce ? { duration: 0 } : { type: 'spring', duration: 0.55, bounce: 0.2, delay: MEET + delay });

  return createPortal(
    <motion.div
      className="match-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.3 }}
    >
      <div className="match-content">
        <div className="match-faces" aria-hidden="true">
          <motion.span {...approach(-1)}>
            <Face person={me} side="left" />
          </motion.span>
          <motion.span {...approach(1)}>
            <Face person={other} side="right" />
          </motion.span>
          {/* Buluşma noktasında kalp: belirir, iki kez atar */}
          <motion.span
            className="match-heart"
            initial={reduce ? false : { scale: 0, y: 8, opacity: 0 }}
            animate={reduce ? { scale: 1, y: 0, opacity: 1 } : { scale: [0, 1.15, 1, 1.18, 1], y: [8, -2, 0, 0, 0], opacity: [0, 1, 1, 1, 1] }}
            transition={reduce ? { duration: 0 } : { duration: 1.1, times: [0, 0.3, 0.45, 0.65, 1], ease: 'easeOut', delay: MEET - 0.05 }}
          >
            <Heart size={22} weight="fill" />
          </motion.span>
        </div>
        <motion.h2 id="match-title" initial={{ y: reduce ? 0 : 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={after(0.25)}>
          {t('Eşleştiniz!')}
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={reduce ? { duration: 0 } : { duration: 0.4, delay: MEET + 0.4 }}>
          {t('{name} ile birbirinizi beğendiniz. İlk mesajı sen at.', { name: firstName })}
        </motion.p>
        <motion.div className="match-actions" initial={{ y: reduce ? 0 : 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={after(0.5)}>
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
