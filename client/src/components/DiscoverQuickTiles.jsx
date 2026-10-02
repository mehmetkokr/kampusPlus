import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Heart, Layers, Lock, Plus, Users } from 'lucide-react';
import api from '../api';
import { useI18n } from '../i18n';
import { getCompletionPercent, getCompletionSteps } from './ProfileCompletion';

// Keşfet'in üstündeki hızlı erişim kutuları (bento ızgara):
//   ┌──────────┬─────────┐
//   │ Kart     │ Beğenen │
//   │ Modu     ├─────────┤
//   │ (uzun)   │ Kulüp   │
//   ├──────────┴─────────┤
//   │ Profil gücü        │  (profil tamamsa gösterilmez)
//   └────────────────────┘
// Kutular kişinin kendi verisiyle dolduğu için kampüs küçükken de sayfa dolu görünür.
export default function DiscoverQuickTiles({ user, quick }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [likes, setLikes] = useState({ count: 0, isPremium: false });

  // Kart Modu kapalıysa Kart Modu ve beğenen kutuları gösterilmez
  const swipeOn = user?.swipeEnabled !== false;

  useEffect(() => {
    if (!swipeOn) return;
    api
      .get('/matches/likes-received')
      .then((res) =>
        setLikes({
          count: res.data.count || 0,
          isPremium: !!res.data.isPremium,
        }),
      )
      .catch(() => {});
  }, [swipeOn]);

  const percent = getCompletionPercent(user);
  const nextStep = getCompletionSteps(user).find((s) => !s.done);
  const swipeCount = quick?.swipeCount ?? 0;
  const clubCount = quick?.myClubCount ?? 0;

  const r = 22;
  const circ = 2 * Math.PI * r;

  return (
    <div className={`quick-tiles ${swipeOn ? '' : 'no-swipe'}`}>
      {swipeOn && (
        <button type="button" className="quick-tile quick-swipe" onClick={() => navigate('/discover/swipe')}>
          <span className="quick-eyebrow">
            <Layers size={13} /> {t('Kart Modu')}
          </span>
          <strong className="quick-title">{t('Sağa kaydır, eşleş.')}</strong>
          <span className="quick-sub">
            {swipeCount > 0 ? t('Sırada {n} kişi seni bekliyor', { n: swipeCount }) : t('Şimdilik herkesi gördün')}
          </span>
          <span className="quick-swipe-stack" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="quick-cta">
            {t('Kaydırmaya başla')} <ArrowRight size={15} />
          </span>
        </button>
      )}

      {swipeOn && (
        <button type="button" className="quick-tile quick-likes" onClick={() => navigate('/matches?tab=likes')}>
          <span className="quick-icon tone-rose">
            <Heart size={17} fill="currentColor" />
          </span>
          <span className="quick-number">{likes.count}</span>
          <span className="quick-label">{t('kişi seni beğendi')}</span>
          {!likes.isPremium && likes.count > 0 && (
            <span className="quick-badge">
              <Lock size={11} /> {t('Premium')}
            </span>
          )}
        </button>
      )}

      <button
        type="button"
        className="quick-tile quick-clubs"
        onClick={() => navigate(clubCount > 0 ? '/clubs' : '/clubs?new=1')}
      >
        <span className="quick-icon tone-sage">{clubCount > 0 ? <Users size={17} /> : <Plus size={17} />}</span>
        {clubCount > 0 ? (
          <>
            <span className="quick-number">{clubCount}</span>
            <span className="quick-label">{t('kulübün var')}</span>
          </>
        ) : (
          <>
            <span className="quick-label strong">{t('Kulüp kur')}</span>
            <span className="quick-label">{t('İlgi alanını topluluğa dönüştür')}</span>
          </>
        )}
      </button>

      {percent < 100 && (
        <button type="button" className="quick-tile quick-profile" onClick={() => navigate('/profile')}>
          <span className="quick-ring" aria-hidden="true">
            <svg width="54" height="54" viewBox="0 0 54 54">
              <circle cx="27" cy="27" r={r} className="quick-ring-track" />
              <circle
                cx="27"
                cy="27"
                r={r}
                className="quick-ring-fill"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - percent / 100)}
              />
            </svg>
            <span>%{percent}</span>
          </span>
          <span className="quick-profile-text">
            <strong>{t('Profil gücün')}</strong>
            <span>{nextStep ? t('Sıradaki adım: {step}', { step: t(nextStep.label) }) : ''}</span>
          </span>
          <ChevronRight size={18} className="quick-chevron" />
        </button>
      )}
    </div>
  );
}
