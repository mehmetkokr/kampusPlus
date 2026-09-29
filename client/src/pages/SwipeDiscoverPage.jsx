import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Flag, ArrowLeft } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import { INTENT_LABEL, INTENT_CHIP_CLASS, parseIntents } from '../constants/intents';
import { UserPlus as UserPlusIcon, UserCheck as UserCheckIcon } from 'lucide-react';

const SWIPE_THRESHOLD = 110;

export default function SwipeDiscoverPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [reportingUserId, setReportingUserId] = useState(null);

  // Kaydırma (swipe) hareketi için durum
  const [drag, setDrag] = useState({ x: 0, active: false });
  const dragState = useRef({ startX: 0, dragging: false });
  const cardRef = useRef(null);

  useEffect(() => {
    loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCandidates() {
    setLoading(true);
    try {
      const res = await api.get('/profile/discover');
      setCandidates(res.data);
      setIndex(0);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Liste yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFollow(targetUserId) {
    const isFollowing = followedIds.has(targetUserId);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(targetUserId) : next.add(targetUserId);
      return next;
    });
    try {
      await api.post(`/users/${targetUserId}/${isFollowing ? 'unfollow' : 'follow'}`);
    } catch (err) {
      // başarısız olursa görsel durumu geri al
      setFollowedIds((prev) => {
        const next = new Set(prev);
        isFollowing ? next.add(targetUserId) : next.delete(targetUserId);
        return next;
      });
    }
  }

  async function handleLike(targetUserId) {
    try {
      const res = await api.post(`/matches/like/${targetUserId}`);
      if (res.data.matched) {
        toast.success('🎉 Eşleştiniz! Sohbet sekmesinden mesajlaşabilirsiniz.', 4500);
      }
    } catch (err) {
      console.error(err);
    }
    advanceCard();
  }

  function handlePass() {
    advanceCard();
  }

  function advanceCard() {
    setDrag({ x: 0, active: false });
    setIndex((i) => i + 1);
  }

  // ---------- Sürükleyerek kaydırma (Sağa: Beğen, Sola: Geç) ----------
  function onPointerDown(e) {
    dragState.current = { startX: e.clientX, dragging: true };
    setDrag((d) => ({ ...d, active: true }));
    cardRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragState.current.dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    setDrag({ x: deltaX, active: true });
  }

  function onPointerUp() {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const { x } = drag;
    if (x > SWIPE_THRESHOLD) {
      handleLike(current.id);
    } else if (x < -SWIPE_THRESHOLD) {
      handlePass();
    } else {
      setDrag({ x: 0, active: false });
    }
  }

  if (user && user.verificationStatus === 'pending') {
    return (
      <div className="container">
        <div className="page-title-row">
        <Link to="/discover" className="chat-back" aria-label="Geri">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="page-title">Kart Modu</h2>
      </div>
        <div className="card empty-state">
          <div className="empty-icon">⏳</div>
          <h3>Hesabın İnceleniyor</h3>
          <p className="muted">
            Doğrulama tamamlanana kadar diğer öğrencileri görüntüleyemezsin. Lütfen daha sonra
            tekrar kontrol et.
          </p>
        </div>
      </div>
    );
  }

  if (user && user.verificationStatus === 'manual_review') {
    return (
      <div className="container">
        <div className="page-title-row">
        <Link to="/discover" className="chat-back" aria-label="Geri">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="page-title">Kart Modu</h2>
      </div>
        <div className="card empty-state">
          <div className="empty-icon">📄</div>
          <h3>Belgen İnceleniyor</h3>
          <p className="muted">
            Yüklediğin öğrenci belgesi ekibimiz tarafından kontrol ediliyor. Onaylandığında
            kullanıma başlayabilirsin.
          </p>
        </div>
      </div>
    );
  }

  const current = candidates[index];
  const rotation = Math.max(-15, Math.min(15, drag.x / 12));
  const cardStyle = drag.active
    ? { transform: `translateX(${drag.x}px) rotate(${rotation}deg)`, transition: 'none' }
    : { transform: 'translateX(0) rotate(0)', transition: 'transform 0.25s ease' };

  return (
    <div className="container">
      <div className="page-title-row">
        <Link to="/discover" className="chat-back" aria-label="Geri">
          <ArrowLeft size={18} />
        </Link>
        <h2 className="page-title">Kart Modu</h2>
      </div>

      {loading && <p className="muted center-text">Yükleniyor...</p>}

      {!loading && !current && (
        <div className="card empty-state">
          <div className="empty-icon">🔭</div>
          <p className="muted">Şu an gösterilecek başka kullanıcı yok.</p>
          <button className="btn btn-secondary" onClick={loadCandidates} style={{ marginTop: 14 }}>
            Yenile
          </button>
        </div>
      )}

      {current && (
        <div
          className="swipe-card swipe-card-drag-layer"
          ref={cardRef}
          style={{ position: 'relative', ...cardStyle }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {drag.x > 30 && <span className="swipe-stamp like" style={{ opacity: Math.min(1, drag.x / SWIPE_THRESHOLD) }}>Beğen</span>}
          {drag.x < -30 && <span className="swipe-stamp pass" style={{ opacity: Math.min(1, -drag.x / SWIPE_THRESHOLD) }}>Geç</span>}

          <div className="swipe-card-top">
            <img
              className="swipe-card-avatar"
              src={current.photoUrl ? `${API_BASE_URL}${current.photoUrl}` : undefined}
              alt={current.fullName}
              draggable={false}
            />
            <div className="swipe-card-heading">
              <div className="swipe-card-info">
                <h3>
                  {current.fullName}
                  {current.age ? `, ${current.age}` : ''}
                </h3>
                <p className="swipe-card-meta">
                  {current.department || 'Bölüm belirtilmemiş'}
                  {current.classYear ? ` · ${current.classYear}. Sınıf` : ''}
                </p>
                {current.university?.name && (
                  <p className="swipe-card-university">{current.university.name}</p>
                )}
              </div>
            </div>
            <button
              className={`follow-toggle-btn ${followedIds.has(current.id) ? 'following' : ''}`}
              onClick={() => handleToggleFollow(current.id)}
            >
              {followedIds.has(current.id) ? (
                <>
                  <UserCheckIcon width={14} height={14} /> Takipte
                </>
              ) : (
                <>
                  <UserPlusIcon width={14} height={14} /> Takip Et
                </>
              )}
            </button>
            <button
              className="follow-toggle-btn"
              title="Şikayet Et"
              onClick={() => setReportingUserId(current.id)}
              style={{ marginLeft: 6 }}
            >
              <Flag size={14} />
            </button>
          </div>

          {current.intent && (
            <div className="intent-chip-stack">
              {parseIntents(current.intent).map((tag) => (
                <span key={tag} className={`intent-chip ${INTENT_CHIP_CLASS[tag] || 'friendship'}`}>
                  {INTENT_LABEL[tag] || tag}
                </span>
              ))}
            </div>
          )}

          <div className="swipe-card-details">
            {current.bio && <p>{current.bio}</p>}
            {current.interests && (
              <div className="interest-chips">
                {current.interests
                  .split(',')
                  .map((i) => i.trim())
                  .filter(Boolean)
                  .map((i) => (
                    <span key={i} className="interest-chip">
                      {i}
                    </span>
                  ))}
              </div>
            )}
            {current.hobbies && (
              <div className="interest-chips">
                {current.hobbies
                  .split(',')
                  .map((i) => i.trim())
                  .filter(Boolean)
                  .map((i) => (
                    <span key={`hobby-${i}`} className="interest-chip">
                      🎯 {i}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="swipe-actions">
            <button className="btn btn-pass" onClick={handlePass}>
              Geç
            </button>
            <button className="btn btn-like" onClick={() => handleLike(current.id)}>
              Beğen
            </button>
          </div>
        </div>
      )}

      {reportingUserId && (
        <ReportModal
          targetType="user"
          targetId={reportingUserId}
          onClose={() => setReportingUserId(null)}
        />
      )}
    </div>
  );
}
