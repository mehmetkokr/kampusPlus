import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Crown, BadgeCheck, Eye } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import LockedUserCard from './LockedUserCard';
import PaywallModal from './PaywallModal';
import MatchCelebration from './MatchCelebration';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';

// Kaç tane kilitli önizleme kartı gösterileceği (gerçek sayıdan bağımsız üst sınır)
const MAX_LOCKED_PREVIEW = 6;

// "Seni Beğenenler" sekmesi. Premium kullanıcı listeyi görür ve geri beğenerek
// anında eşleşebilir; premium olmayan kullanıcı yalnızca kaç kişinin onu
// beğendiğini ve bulanık kartları görür (kimlikler sunucudan hiç gelmez).
export default function LikesReceived({ data, onChanged }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [showPaywall, setShowPaywall] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const { user: me } = useAuth();

  if (!data) return null;
  const { isPremium, count, users } = data;

  async function likeBack(user) {
    setBusyId(user.id);
    try {
      const res = await api.post(`/matches/like/${user.id}`);
      if (res.data.matched) {
        setCelebration({ other: user, matchId: res.data.match?.id });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Beğeni gönderilemedi.');
    } finally {
      setBusyId(null);
    }
  }

  if (count === 0) {
    return (
      <div className="card empty-state">
        <div className="empty-icon is-glyph"><Heart size={26} strokeWidth={1.8} /></div>
        <p className="muted">
          {t("Henüz seni beğenen yeni biri yok. Kart Modu'nda gezinmeye devam et, beğeniler burada görünecek.")}
        </p>
        <button className="btn" style={{ width: 'auto', marginTop: 6 }} onClick={() => navigate('/discover/swipe')}>
          {t("Kart Moduna Git")}
        </button>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <>
        <div className="likes-premium-banner">
          <div className="likes-premium-count">
            <Heart size={18} fill="currentColor" />
            <span>{count}</span>
          </div>
          <h3>{count} {t("kişi seni beğendi")}</h3>
          <p>{t("Kim olduklarını gör ve tek dokunuşla eşleş. Bu özellik yalnızca Premium üyelere açık.")}</p>
          <button className="btn-premium-cta" onClick={() => setShowPaywall(true)}>
            <Crown size={15} /> {t("Premium ile Gör")}
          </button>
        </div>

        <div className="likes-grid">
          {Array.from({ length: Math.min(count, MAX_LOCKED_PREVIEW) }).map((_, i) => (
            <LockedUserCard
              key={i}
              title={t("Seni beğendi")}
              subtitle={t("Görmek için Premium")}
              onClick={() => setShowPaywall(true)}
            />
          ))}
        </div>

        {showPaywall && (
          <PaywallModal
            contextText={`${count} kişi seni beğendi. Premium ile kim olduklarını gör ve hemen eşleş.`}
            onClose={() => setShowPaywall(false)}
            onUpgraded={onChanged}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="section-heading" style={{ marginTop: 4 }}>
        <h3>{t("Seni Beğenenler")}</h3>
        <span className="count">{count}</span>
      </div>
      <div className="likes-list">
        {users.map((u) => (
          <div key={u.id} className="match-row likes-row">
            <img
              className="match-avatar"
              src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
              alt={u.fullName}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="match-name" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {u.fullName}
                {u.age ? `, ${u.age}` : ''}
                {u.studentDocStatus === 'approved' && (
                  <BadgeCheck size={15} className="suggest-card-verified" />
                )}
              </div>
              <div className="match-sub">
                {[u.department, u.classYear ? t(`${u.classYear}. Sınıf`) : null].filter(Boolean).join(' · ') ||
                  u.university?.name}
              </div>
            </div>
            <button className="glass-icon-btn" aria-label={t("Profili gör")} onClick={() => navigate(`/users/${u.id}`)}>
              <Eye size={17} />
            </button>
            <button
              className="icon-btn-amber is-primary"
              aria-label={t("Geri beğen")}
              disabled={busyId === u.id}
              onClick={() => likeBack(u)}
            >
              <Heart size={17} fill="currentColor" />
            </button>
          </div>
        ))}
      </div>

      {celebration && (
        <MatchCelebration
          me={me}
          other={celebration.other}
          matchId={celebration.matchId}
          onMessage={(id) => navigate(`/chat/${id}`)}
          onClose={() => {
            setCelebration(null);
            onChanged?.();
          }}
        />
      )}
    </>
  );
}
