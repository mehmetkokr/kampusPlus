import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2,
  X,
  Lock,
  Compass,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import ClubIcon from '../components/ClubIcon';
import StudentBadgeCard from '../components/StudentBadgeCard';
import SuggestedPeopleRail from '../components/SuggestedPeopleRail';
import ActiveNowStrip from '../components/ActiveNowStrip';
import DiscoverQuickTiles from '../components/DiscoverQuickTiles';
import InterestTiles from '../components/InterestTiles';
import ReportModal from '../components/ReportModal';
import PaywallModal from '../components/PaywallModal';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { Crown } from 'lucide-react';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export default function DiscoverPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, setUser } = useAuth();

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  function openPaywall(reason) {
    setPaywallReason(reason);
    setShowPaywall(true);
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [followedIds, setFollowedIds] = useState(new Set());
  const [openMenuId, setOpenMenuId] = useState(null);
  const [reportingUserId, setReportingUserId] = useState(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const [showFilters, setShowFilters] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterClassYear, setFilterClassYear] = useState('');

  const load = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const params = {};
      if (filters.department) params.department = filters.department;
      if (filters.classYear) params.classYear = filters.classYear;
      const res = await api.get('/discover/home', { params });
      setData(res.data);
      setFollowedIds(new Set());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Keşfet verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load({ department: filterDepartment, classYear: filterClassYear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Arama (debounce) ----------
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await api.get('/discover/search', { params: { q: query.trim() } });
        setSearchResults(res.data);
      } catch (err) {
        toast.error('Arama yapılamadı.');
      } finally {
        setSearching(false);
      }
    }, 350);
    // NOT: /discover/search artık { results, lockedCount, isPremium } döndürüyor
    // (eskiden düz bir dizi dönüyordu) - üniversite dışı sonuçları Premium'a
    // göre kısıtlamak için.
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
      setFollowedIds((prev) => {
        const next = new Set(prev);
        isFollowing ? next.add(targetUserId) : next.delete(targetUserId);
        return next;
      });
      toast.error(err.response?.data?.error || 'İşlem başarısız oldu.');
    }
  }

  async function handleBlock(userId) {
    if (!await confirm('Bu kullanıcıyı engellemek istediğine emin misin?')) {
      setOpenMenuId(null);
      return;
    }
    setOpenMenuId(null);
    try {
      await api.post(`/users/${userId}/block`);
      setHiddenIds((prev) => new Set(prev).add(userId));
      toast.success('Kullanıcı engellendi.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Engellenemedi.');
    }
  }

  function applyFilters() {
    setShowFilters(false);
    load({ department: filterDepartment, classYear: filterClassYear });
  }

  function clearFilters() {
    setFilterDepartment('');
    setFilterClassYear('');
    setShowFilters(false);
    load({});
  }

  async function handlePostLike(postId) {
    setData((prev) => ({
      ...prev,
      recentPosts: prev.recentPosts.map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      ),
    }));
    try {
      await api.post(`/posts/${postId}/like`);
    } catch {
      toast.error('İşlem başarısız oldu.');
    }
  }

  async function handlePostShare(post) {
    const shareText = `${post.author.fullName} bir gönderi paylaştı: ${post.caption || ''}`;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // kullanıcı paylaşımı iptal etti, sorun değil
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Paylaşım metni kopyalandı.');
      } catch {
        toast.error('Paylaşılamadı.');
      }
    }
  }

  const suggestedUsers = (data?.suggestedUsers || []).filter((u) => !hiddenIds.has(u.id));

  return (
    <div className="container">
      <div className="discover-sticky-header">
        <PageHeader
          compact
          tone="sky"
          icon={Compass}
          eyebrow={user?.university?.name || t("Kampüsünü keşfet")}
          title={t("Keşfet")}
          badge={user?.isPremium && <span className="premium-badge"><Crown size={11} /> {t("PREMIUM")}</span>}
          actions={
            <>
              <NotificationBell />
              <button className="icon-btn-amber" aria-label={t("Filtre")} onClick={() => setShowFilters(true)}>
                <Filter size={18} />
              </button>
            </>
          }
        >
          <div className="discover-search-row">
            <Search size={16} />
            <input
              className="discover-search-input"
              placeholder={t("Kişi, bölüm veya kulüp ara...")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </PageHeader>
      </div>

      {/* ---------- Arama sonuçları ---------- */}
      {query.trim() && (
        <div className="discover-search-results">
          {searching && <p className="muted center-text">{t("Aranıyor...")}</p>}
          {!searching &&
            searchResults &&
            searchResults.results.length === 0 &&
            searchResults.lockedCount === 0 &&
            !searchResults.clubs?.length && <p className="muted center-text">{t("Sonuç bulunamadı.")}</p>}

          {/* Kulüpler: aramaya uyan kendi kampüs kulüplerin */}
          {!searching && searchResults?.clubs?.length > 0 && (
            <>
              <div className="search-group-title">{t("Kulüpler")}</div>
              <div className="search-club-list">
                {searchResults.clubs.map((c) => (
                  <button key={c.id} type="button" className="search-club" onClick={() => navigate(`/clubs/${c.id}`)}>
                    <ClubIcon value={c.iconEmoji} category={c.category} size={40} />
                    <span className="search-club-text">
                      <strong>{c.name}</strong>
                      <span>
                        {t(c.category)} · {t('{n} üye', { n: c.memberCount })}
                      </span>
                    </span>
                    <ChevronRight size={16} className="search-club-chevron" />
                  </button>
                ))}
              </div>
              {searchResults.results.length > 0 && <div className="search-group-title">{t("Kişiler")}</div>}
            </>
          )}
          {!searching &&
            searchResults?.results.map((u) => (
              <div key={u.id} className="suggest-card" onClick={() => navigate(`/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                <div className="suggest-card-top">
                  <img
                    className="suggest-card-avatar"
                    src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
                    alt={u.fullName}
                  />
                  <div className="suggest-card-info">
                    <div className="suggest-card-name">
                      {u.fullName}
                      {u.verified && <BadgeCheck size={15} className="suggest-card-verified" />}
                    </div>
                    <div className="suggest-card-university">{u.university?.name}</div>
                    {u.department && <div className="suggest-card-department">{u.department}</div>}
                  </div>
                </div>
              </div>
            ))}

          {/* Ücretsiz kullanıcı: diğer üniversitelerde de eşleşme varsa kilitli teaser göster */}
          {!searching && searchResults && !searchResults.isPremium && searchResults.lockedCount > 0 && (
            <div
              className="other-uni-locked-banner"
              onClick={() => openPaywall(`"${query.trim()}" için ${searchResults.lockedCount} sonuç daha var, ama farklı üniversitelerden.`)}
              style={{ cursor: 'pointer' }}
            >
              <div className="other-uni-locked-banner-icon">
                <Lock size={18} />
              </div>
              <h4>{t('+{n} sonuç daha', { n: searchResults.lockedCount })}</h4>
              <p>{t('Farklı üniversitelerden de "{q}" ile eşleşen kişiler var. Görmek için Premium\'a geç.', { q: query.trim() })}</p>
              <button className="btn-premium-cta">{t("Premium'a Geç")}</button>
            </div>
          )}
        </div>
      )}

      {!query.trim() && (
        <>
          {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}

          {/* Sıra: canlı kampüs (aktifler + bugünün özeti) → hızlı erişim
              kutuları → önerilen kişiler → ilgi alanına göre keşfet → rozet
              çağrısı → kulüpler → paylaşımlar. Kampüs küçükken bile boş
              kalmayan bölümler (kişinin kendi verisi, davet kartları) önde. */}
          {!loading && data && (
            <>
              <ActiveNowStrip users={data.onlineUsers} />
              <CampusPulse stats={data.stats} />
              <DiscoverQuickTiles user={user} quick={data.quick} />

              {/* ---------- Önerilen Kişiler (sonunda davet kartı) ---------- */}
              <div className="section-heading">
                <h3>{t("Önerilen Kişiler")}</h3>
              </div>
              <SuggestedPeopleRail
                users={suggestedUsers}
                followedIds={followedIds}
                onToggleFollow={handleToggleFollow}
                onReport={setReportingUserId}
                onBlock={handleBlock}
              />

              {/* ---------- İlgi alanına göre keşfet ---------- */}
              <div className="section-heading">
                <h3>{t("İlgi alanına göre keşfet")}</h3>
              </div>
              <InterestTiles tiles={data.interestTiles} />

              {/* ---------- Onaylı öğrenci rozeti çağrısı ---------- */}
              <StudentBadgeCard user={user} setUser={setUser} variant="home" />

              {/* ---------- Kulüp yoksa: ilk kulübü kurma çağrısı ---------- */}
              {data.trendingClubs.length === 0 && (
                <>
                  <div className="section-heading">
                    <h3>{t("Kulüpler")}</h3>
                  </div>
                  <button type="button" className="club-starter" onClick={() => navigate('/clubs?new=1')}>
                    <span className="club-starter-icons" aria-hidden="true">
                      {['icon:code', 'icon:camera', 'icon:trophy', 'icon:music'].map((icon, i) => (
                        <ClubIcon key={icon} value={icon} category={['Teknoloji', 'Sanat', 'Spor', 'Sanat'][i]} size={40} />
                      ))}
                    </span>
                    <span className="club-starter-text">
                      <strong>{t("Kampüsünün ilk kulübünü sen kur")}</strong>
                      <span>{t("Kodlama, fotoğraf, spor... Aynı şeyi sevenleri bir araya getir.")}</span>
                    </span>
                    <ChevronRight size={18} className="club-starter-chevron" />
                  </button>
                </>
              )}

              {/* ---------- Trend Kulüpler ---------- */}
              {data.trendingClubs.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>{t("Trend Kulüpler")}</h3>
                  </div>
                  <div className="category-scroll" style={{ marginBottom: 20 }}>
                    {data.trendingClubs.map((c) => (
                      <div key={c.id} className="trend-club-chip" onClick={() => navigate(`/clubs/${c.id}`)}>
                        <ClubIcon value={c.iconEmoji} category={c.category} size={22} />
                        <span>{c.name}</span>
                        <span className="count">· {c.memberCount}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ---------- Son Paylaşımlar ---------- */}
              {data.recentPosts.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>{t("Son Paylaşımlar")}</h3>
                  </div>
                  {data.recentPosts.map((post) => (
                    <div key={post.id} className="post-card">
                      <div className="post-header">
                        <img
                          className="post-avatar"
                          src={post.author.photoUrl ? `${API_BASE_URL}${post.author.photoUrl}` : undefined}
                          alt={post.author.fullName}
                          onClick={() => navigate(`/users/${post.author.id}`)}
                          style={{ cursor: 'pointer' }}
                        />
                        <span
                          className="post-author-name"
                          onClick={() => navigate(`/users/${post.author.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          {post.author.fullName}
                        </span>
                        <span className="muted" style={{ marginLeft: 'auto', fontSize: 11.5 }}>
                          {t(timeAgo(post.createdAt))}
                        </span>
                      </div>
                      {post.imageUrl ? (
                        <img className="post-image" src={`${API_BASE_URL}${post.imageUrl}`} alt="" />
                      ) : (
                        post.caption && <p className="post-text-only">{post.caption}</p>
                      )}
                      <div className="post-actions">
                        <button
                          className={`post-action-btn ${post.likedByMe ? 'liked' : ''}`}
                          onClick={() => handlePostLike(post.id)}
                        >
                          <Heart size={22} fill={post.likedByMe ? 'currentColor' : 'none'} />
                        </button>
                        <button className="post-action-btn" onClick={() => navigate('/feed')}>
                          <MessageCircle size={22} />
                        </button>
                        <button className="post-action-btn" onClick={() => handlePostShare(post)}>
                          <Share2 size={20} />
                        </button>
                      </div>
                      {post.likeCount > 0 && <p className="post-like-count">{post.likeCount} {t("beğenme")}</p>}
                      {post.imageUrl && post.caption && (
                        <p className="post-caption">
                          <span className="post-author-name">{post.author.fullName}</span> {post.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

            </>
          )}
        </>
      )}

      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("Filtrele")}</h3>
              <button className="modal-close" onClick={() => setShowFilters(false)}>
                <X size={16} />
              </button>
            </div>
            <label>{t("Bölüm")}</label>
            <input
              type="text"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              placeholder={t("örn. Yönetim Bilişim Sistemleri")}
            />
            <label>{t("Sınıf")}</label>
            <select value={filterClassYear} onChange={(e) => setFilterClassYear(e.target.value)}>
              <option value="">{t("Farketmez")}</option>
              <option value="1">{t("1. Sınıf")}</option>
              <option value="2">{t("2. Sınıf")}</option>
              <option value="3">{t("3. Sınıf")}</option>
              <option value="4">{t("4. Sınıf")}</option>
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={clearFilters}>
                {t("Temizle")}
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={applyFilters}>
                {t("Uygula")}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportingUserId && (
        <ReportModal targetType="user" targetId={reportingUserId} onClose={() => setReportingUserId(null)} />
      )}

      {showPaywall && (
        <PaywallModal
          contextText={paywallReason}
          onClose={() => setShowPaywall(false)}
          onUpgraded={() => load({ department: filterDepartment, classYear: filterClassYear })}
        />
      )}
    </div>
  );
}

// "Bugün kampüste" tek satırlık özet: yalnızca sıfırdan büyük sayılar
// gösterilir; hepsi sıfırsa satır hiç çıkmaz (0 / 0 / 0 kartları yerine).
function CampusPulse({ stats }) {
  const { t } = useI18n();
  const parts = [
    stats.newUsersToday > 0 && t('{n} yeni öğrenci katıldı', { n: stats.newUsersToday }),
    stats.newPostsToday > 0 && t('{n} yeni paylaşım', { n: stats.newPostsToday }),
    stats.newClubsToday > 0 && t('{n} yeni kulüp', { n: stats.newClubsToday }),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="campus-pulse">
      <Sparkles size={15} aria-hidden="true" />
      <span>
        <strong>{t('Bugün kampüste')}</strong> {parts.join(' · ')}
      </span>
    </p>
  );
}
