import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, ChevronRight, Flag, MoreHorizontal, ShieldOff, Sparkles, UserPlus, UserRound } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';

// "Ortak: Satranç +2" — dar kartta kesilmesin diye ilk ortak nokta ve kalan
// sayısı; tamamı title ve ekran okuyucu metninde.
function commonLabel(tags, t) {
  const extra = tags.length > 1 ? ` +${tags.length - 1}` : '';
  return t('Ortak: {tags}', { tags: t(tags[0]) + extra });
}

// Instagram'daki "Senin için öneriler" gibi yatay kaydırılan kişi kartları.
// Dokunmatikte parmakla, masaüstünde ok düğmeleriyle kaydırılır; kartlar
// scroll-snap ile hizalanır. ⋯ menüsü kartın içinde açılır (kaydırma alanı
// taşan menüyü kırpmasın diye).
export default function SuggestedPeopleRail({ users, followedIds, onToggleFollow, onReport, onBlock }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const railRef = useRef(null);
  const [menuFor, setMenuFor] = useState(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  const toast = useToast();

  // Paylaşım sayfası (telefonda yerel paylaşım menüsü); yoksa bağlantıyı kopyala
  async function invite() {
    const url = `${window.location.origin}/`;
    const text = t('kampüs· — üniversitendeki öğrencilerle tanış. Okul e-postanla katıl:');
    try {
      if (navigator.share) {
        await navigator.share({ title: 'kampüs·', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success(t('Davet bağlantısı kopyalandı.'));
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error(t('Bağlantı kopyalanamadı.'));
    }
  }

  function updateEdges() {
    const el = railRef.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }

  useEffect(() => {
    updateEdges();
    window.addEventListener('resize', updateEdges);
    return () => window.removeEventListener('resize', updateEdges);
  }, [users.length]);

  function scrollByPage(dir) {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  return (
    <div className={`people-rail-wrap ${edges.start ? 'at-start' : ''} ${edges.end ? 'at-end' : ''}`}>
      <button
        type="button"
        className="people-rail-arrow prev"
        onClick={() => scrollByPage(-1)}
        aria-label={t('Önceki kişiler')}
        tabIndex={edges.start ? -1 : 0}
      >
        <ChevronLeft size={18} />
      </button>

      <ul className="people-rail" ref={railRef} onScroll={updateEdges}>
        {users.map((u) => {
          const following = followedIds.has(u.id);
          const open = menuFor === u.id;
          const sub = u.mutualCount > 0 ? `${u.mutualCount} ${t('Ortak Arkadaş')}` : u.department || u.university?.name;
          return (
            <li key={u.id} className="person-card">
              <button
                type="button"
                className="person-card-more"
                onClick={() => setMenuFor(open ? null : u.id)}
                aria-label={t('Daha fazla')}
                aria-expanded={open}
              >
                <MoreHorizontal size={16} />
              </button>

              <button type="button" className="person-card-main" onClick={() => navigate(`/users/${u.id}`)}>
                <span className="person-card-avatar">
                  {u.photoUrl ? (
                    <img src={`${API_BASE_URL}${u.photoUrl}`} alt="" loading="lazy" />
                  ) : (
                    <UserRound size={34} strokeWidth={1.6} />
                  )}
                </span>
                <span className="person-card-name">
                  <span className="person-card-name-text">{u.fullName}</span>
                  {u.verified && <BadgeCheck size={14} className="person-card-verified" aria-label={t('Doğrulanmış')} />}
                </span>
                <span className="person-card-sub">{sub}</span>
                {u.commonTags?.length > 0 ? (
                  <span className="person-card-common" title={u.commonTags.map((tag) => t(tag)).join(', ')}>
                    <Sparkles size={12} aria-hidden="true" />
                    <span aria-hidden="true">{commonLabel(u.commonTags, t)}</span>
                    <span className="sr-only">{t('Ortak: {tags}', { tags: u.commonTags.map((tag) => t(tag)).join(', ') })}</span>
                  </span>
                ) : (
                  u.lastActiveLabel && <span className="person-card-active">{t(u.lastActiveLabel)}</span>
                )}
              </button>

              <button
                type="button"
                className={`person-card-follow ${following ? 'is-following' : ''}`}
                onClick={() => onToggleFollow(u.id)}
              >
                {following ? t('Takipte') : t('Takip Et')}
              </button>

              {open && (
                <div className="person-card-menu" role="menu">
                  <button role="menuitem" type="button" onClick={() => { setMenuFor(null); onReport(u.id); }}>
                    <Flag size={15} /> {t('Şikayet Et')}
                  </button>
                  <button role="menuitem" type="button" className="danger" onClick={() => { setMenuFor(null); onBlock(u.id); }}>
                    <ShieldOff size={15} /> {t('Engelle')}
                  </button>
                  <button type="button" className="person-card-menu-close" onClick={() => setMenuFor(null)}>
                    {t('Vazgeç')}
                  </button>
                </div>
              )}
            </li>
          );
        })}

        {/* Şeridin sonu: arkadaş daveti (öneri azken de şerit dolu görünür) */}
        <li className="person-card person-card-invite">
          <span className="person-card-avatar invite">
            <UserPlus size={30} strokeWidth={1.7} />
          </span>
          <span className="person-card-name">{t('Arkadaşını davet et')}</span>
          <span className="person-card-sub wrap">{t('Tanıdıklarını da getir.')}</span>
          <button type="button" className="person-card-follow" onClick={invite}>
            {t('Davet et')}
          </button>
        </li>
      </ul>

      <button
        type="button"
        className="people-rail-arrow next"
        onClick={() => scrollByPage(1)}
        aria-label={t('Sonraki kişiler')}
        tabIndex={edges.end ? -1 : 0}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
