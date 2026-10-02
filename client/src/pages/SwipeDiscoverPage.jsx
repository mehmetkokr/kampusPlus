import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Flag, ArrowLeft, Layers, Heart, ChevronRight, BadgeCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import PhotoCarousel from '../components/PhotoCarousel';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import { INTENT_LABEL, INTENT_CHIP_CLASS, parseIntents } from '../constants/intents';
import { UserPlus as UserPlusIcon, UserCheck as UserCheckIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import { FileText, Telescope } from 'lucide-react';

const SWIPE_THRESHOLD = 110;

export default function SwipeDiscoverPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [candidates, setCandidates] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState(new Set());
  const [reportingUserId, setReportingUserId] = useState(null);
  const [likesCount, setLikesCount] = useState(0);
  const navigate = useNavigate();

  // Kaydırma (swipe) hareketi için durum
  const [drag, setDrag] = useState({ x: 0, active: false });
  const dragState = useRef({ startX: 0, dragging: false, onPhoto: false });
  const [photoIndex, setPhotoIndex] = useState(0);
  // Sürükleme miktarı ref'te de tutulur: pointerup anında state güncellemesi
  // henüz yansımamış olabilir (hızlı dokunuşlarda yanlış kararı önler).
  const dragXRef = useRef(0);
  const cardRef = useRef(null);

  function loadLikesCount() {
    api
      .get('/matches/likes-received')
      .then((res) => setLikesCount(res.data.count))
      .catch(() => {});
  }

  useEffect(() => {
    loadLikesCount();
  }, []);

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
      if (err.response?.data?.swipeDisabled) return; // aşağıda 'Kart Modu kapalı' kartı gösterilir
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
    // Kartı hemen ilerlet (akıcı his), isteği arkada gönder
    advanceCard();
    try {
      const res = await api.post(`/matches/like/${targetUserId}`);
      if (res.data.matched) {
        toast.success('Eşleştiniz! Sohbet sekmesinden mesajlaşabilirsiniz.', 4500);
        // Seni beğenen biriyle eşleştin: "seni beğendi" sayacı artık bir eksik
        loadLikesCount();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Beğeni gönderilemedi.');
    }
  }

  function handlePass() {
    advanceCard();
  }

  function advanceCard() {
    setDrag({ x: 0, active: false });
    dragXRef.current = 0;
    setPhotoIndex(0);
    setIndex((i) => i + 1);
  }

  // ---------- Sürükleyerek kaydırma (Sağa: Beğen, Sola: Geç) ----------
  function onPointerDown(e) {
    // Karttaki butonlara (Beğen, Geç, Takip Et, Şikayet) basılınca sürükleme
    // başlatma: pointer capture tıklamayı karta yönlendirip butonları bozuyordu.
    if (e.target.closest('button')) return;
    dragXRef.current = 0;
    dragState.current = { startX: e.clientX, dragging: true, onPhoto: !!e.target.closest('[data-photo-area]') };
    setDrag((d) => ({ ...d, active: true }));
    cardRef.current?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragState.current.dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    dragXRef.current = deltaX;
    setDrag({ x: deltaX, active: true });
  }

  function onPointerUp(e) {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const x = dragXRef.current;

    // Fotoğrafa hareketsiz dokunuş: sağ yarı → sonraki, sol yarı → önceki fotoğraf
    if (Math.abs(x) < 6 && dragState.current.onPhoto && e?.clientX !== undefined) {
      const area = cardRef.current?.querySelector('[data-photo-area]');
      const count = current?.photos?.length || 0;
      if (area && count > 1) {
        const rect = area.getBoundingClientRect();
        const goNext = e.clientX > rect.left + rect.width / 2;
        setPhotoIndex((i) => (goNext ? Math.min(i + 1, count - 1) : Math.max(i - 1, 0)));
      }
      setDrag({ x: 0, active: false });
      return;
    }

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
        <Link to="/discover" className="chat-back" aria-label={t("Geri")}>
          <ArrowLeft size={18} />
        </Link>
        <h2 className="page-title">{t("Kart Modu")}</h2>
      </div>
        <div className="card empty-state">
          <div className="empty-icon">⏳</div>
          <h3>{t("Hesabın İnceleniyor")}</h3>
          <p className="muted">
            {t("Doğrulama tamamlanana kadar diğer öğrencileri görüntüleyemezsin. Lütfen daha sonra tekrar kontrol et.")}
          </p>
        </div>
      </div>
    );
  }

  if (user && user.verificationStatus === 'manual_review') {
    return (
      <div className="container">
        <div className="page-title-row">
        <Link to="/discover" className="chat-back" aria-label={t("Geri")}>
          <ArrowLeft size={18} />
        </Link>
        <h2 className="page-title">{t("Kart Modu")}</h2>
      </div>
        <div className="card empty-state">
          <div className="empty-icon is-glyph"><FileText size={26} strokeWidth={1.8} /></div>
          <h3>{t("Belgen İnceleniyor")}</h3>
          <p className="muted">
            {t("Yüklediğin öğrenci belgesi ekibimiz tarafından kontrol ediliyor. Onaylandığında kullanıma başlayabilirsin.")}
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

  // Kart Modu'nu Ayarlar'dan kapatan kullanıcı
  if (user?.swipeEnabled === false) {
    return (
      <div className="container">
        <div className="card empty-state" style={{ marginTop: 24 }}>
          <div className="empty-icon is-glyph">
            <Layers size={26} strokeWidth={1.8} />
          </div>
          <h3>{t('Kart Modu kapalı')}</h3>
          <p className="muted">{t("Kart Modu'nu Ayarlar'dan kapattın; şu an kimsenin destesinde görünmüyorsun.")}</p>
          <Link to="/settings" className="btn" style={{ width: 'auto', marginTop: 6 }}>
            {t("Ayarlar'a git")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <PageHeader
        compact
        tone="rose"
        icon={Layers}
        eyebrow={t("Sağa kaydır: beğen · Sola: geç")}
        title={t("Kart Modu")}
        onBack={() => navigate('/discover')}
      />

      {likesCount > 0 && (
        <button type="button" className="likes-teaser" onClick={() => navigate('/matches?tab=likes')}>
          <span className="likes-teaser-icon">
            <Heart size={16} fill="currentColor" />
          </span>
          <span className="likes-teaser-text">
            <strong>{likesCount} {t("kişi seni beğendi")}</strong>
            <small>{user?.isPremium ? t("Kim olduklarını gör") : t("Premium ile kim olduklarını gör")}</small>
          </span>
          <ChevronRight size={18} />
        </button>
      )}

      {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}

      {!loading && !current && (
        <div className="card empty-state">
          <div className="empty-icon is-glyph"><Telescope size={26} strokeWidth={1.8} /></div>
          <p className="muted">{t("Şu an gösterilecek başka kullanıcı yok.")}</p>
          <button className="btn btn-secondary" onClick={loadCandidates} style={{ marginTop: 14 }}>
            {t("Yenile")}
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
          {drag.x > 30 && <span className="swipe-stamp like" style={{ opacity: Math.min(1, drag.x / SWIPE_THRESHOLD) }}>{t("Beğen")}</span>}
          {drag.x < -30 && <span className="swipe-stamp pass" style={{ opacity: Math.min(1, -drag.x / SWIPE_THRESHOLD) }}>{t("Geç")}</span>}

          <div className="swipe-card-photo">
            <PhotoCarousel
              photos={current.photos}
              index={photoIndex}
              name={current.fullName}
              initials={current.fullName
                .split(' ')
                .map((w) => w[0])
                .slice(0, 2)
                .join('')}
            />
          </div>

          {/* Kişisel bilgiler: fotoğrafın altında ayrı bölme */}
          <section className="swipe-info-panel" aria-label={t("Kişisel bilgiler")}>
            <div className="swipe-info-head">
              <div className="swipe-info-title">
                <h3>
                  {current.fullName}
                  {current.age ? <span className="swipe-card-age">{current.age}</span> : null}
                  {current.isStudentVerified && <BadgeCheck size={19} className="swipe-card-verified" aria-label={t("Onaylı öğrenci")} />}
                </h3>
              </div>
              <div className="swipe-info-actions">
            <button
              className={`follow-toggle-btn ${followedIds.has(current.id) ? 'following' : ''}`}
              onClick={() => handleToggleFollow(current.id)}
            >
              {followedIds.has(current.id) ? (
                <>
                  <UserCheckIcon width={14} height={14} /> {t("Takipte")}
                </>
              ) : (
                <>
                  <UserPlusIcon width={14} height={14} /> {t("Takip Et")}
                </>
              )}
            </button>
            <button
              className="follow-toggle-btn"
              title={t("Şikayet Et")}
              onClick={() => setReportingUserId(current.id)}
              aria-label={t("Şikayet et")}
            >
              <Flag size={14} />
            </button>
              </div>
            </div>

            <dl className="swipe-info-facts">
              <div>
                <dt>{t("Bölüm")}</dt>
                <dd>{current.department || '—'}</dd>
              </div>
              <div>
                <dt>{t("Sınıf")}</dt>
                <dd>{current.classYear ? (current.classYear >= 5 ? t("Yüksek Lisans") : t(`${current.classYear}. Sınıf`)) : '—'}</dd>
              </div>
              <div className="span-2">
                <dt>{t("Üniversite")}</dt>
                <dd>{current.university?.name || '—'}</dd>
              </div>
            </dl>
          </section>

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
                      {t(i)}
                    </span>
                  ))}
              </div>
            )}
          </div>

          <div className="swipe-actions">
            <button className="btn btn-pass" onClick={handlePass}>
              {t("Geç")}
            </button>
            <button className="btn btn-like" onClick={() => handleLike(current.id)}>
              {t("Beğen")}
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
