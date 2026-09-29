import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  MoreVertical,
  Flag,
  ShieldOff,
  EyeOff,
  BadgeCheck,
  Heart,
  MessageCircle,
  Share2,
  X,
  Zap,
  Lock,
  Globe2,
  Compass,
} from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import ReportModal from '../components/ReportModal';
import PaywallModal from '../components/PaywallModal';
import LockedUserCard from '../components/LockedUserCard';

const CATEGORIES = [
  { value: 'all', label: 'Tümü' },
  { value: 'nearby', label: 'Yakınımdakiler' },
  { value: 'university', label: 'Aynı Üniversite' },
  { value: 'department', label: 'Aynı Bölüm' },
  { value: 'new', label: 'Yeni Katılanlar' },
  { value: 'popular', label: 'Popüler' },
  { value: 'verified', label: 'Doğrulanmış' },
  { value: 'active', label: 'En Aktif' },
];

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
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  function openPaywall(reason) {
    setPaywallReason(reason);
    setShowPaywall(true);
  }

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
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

  const load = useCallback(async (cat, filters = {}) => {
    setLoading(true);
    try {
      const params = { category: cat };
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
    load(category, { department: filterDepartment, classYear: filterClassYear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

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

  function handleHide(userId) {
    setHiddenIds((prev) => new Set(prev).add(userId));
    setOpenMenuId(null);
  }

  async function handleBlock(userId) {
    if (!window.confirm('Bu kullanıcıyı engellemek istediğine emin misin?')) {
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
    load(category, { department: filterDepartment, classYear: filterClassYear });
  }

  function clearFilters() {
    setFilterDepartment('');
    setFilterClassYear('');
    setShowFilters(false);
    load(category, {});
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
          eyebrow={user?.university?.name || 'Kampüsünü keşfet'}
          title="Keşfet"
          badge={user?.isPremium && <span className="premium-badge">👑 PREMIUM</span>}
          actions={
            <>
              <NotificationBell />
              <button className="icon-btn-amber" aria-label="Filtre" onClick={() => setShowFilters(true)}>
                <Filter size={18} />
              </button>
            </>
          }
        >
          <div className="discover-search-row">
            <Search size={16} />
            <input
              className="discover-search-input"
              placeholder="Kullanıcı, üniversite veya bölüm ara..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </PageHeader>
      </div>

      {/* ---------- Arama sonuçları ---------- */}
      {query.trim() && (
        <div className="discover-search-results">
          {searching && <p className="muted center-text">Aranıyor...</p>}
          {!searching && searchResults && searchResults.results.length === 0 && searchResults.lockedCount === 0 && (
            <p className="muted center-text">Sonuç bulunamadı.</p>
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
              <h4>+{searchResults.lockedCount} sonuç daha</h4>
              <p>Farklı üniversitelerden de "{query.trim()}" ile eşleşen kişiler var. Görmek için Premium'a geç.</p>
              <button className="btn-premium-cta">Premium'a Geç</button>
            </div>
          )}
        </div>
      )}

      {!query.trim() && (
        <>
          {/* ---------- Hızlı Kategoriler ---------- */}
          <div className="category-scroll">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                className={`category-pill ${category === c.value ? 'active' : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {loading && <p className="muted center-text">Yükleniyor...</p>}

          {!loading && data && (
            <>
              {/* ---------- Önerilen Kişiler ---------- */}
              <div className="section-heading">
                <h3>⭐ Önerilen Kişiler</h3>
              </div>

              {suggestedUsers.length === 0 && (
                <div className="card empty-state">
                  <div className="empty-icon">🔭</div>
                  <p className="muted">Şu an gösterilecek kimse yok.</p>
                </div>
              )}

              {suggestedUsers.map((u) => {
                const following = followedIds.has(u.id);
                return (
                  <div className="suggest-card" key={u.id}>
                    <div className="suggest-card-top">
                      <img
                        className="suggest-card-avatar"
                        src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
                        alt={u.fullName}
                        onClick={() => navigate(`/users/${u.id}`)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="suggest-card-info" onClick={() => navigate(`/users/${u.id}`)} style={{ cursor: 'pointer' }}>
                        <div className="suggest-card-name">
                          {u.fullName}
                          {u.verified && <BadgeCheck size={15} className="suggest-card-verified" />}
                        </div>
                        <div className="suggest-card-university">{u.university?.name}</div>
                        {u.department && (
                          <div className="suggest-card-department">
                            {u.department}
                            {u.classYear ? ` · ${u.classYear}. Sınıf` : ''}
                          </div>
                        )}
                        {u.mutualCount > 0 && (
                          <div className="suggest-card-mutual">{u.mutualCount} Ortak Arkadaş</div>
                        )}
                      </div>

                      <button
                        className="suggest-card-menu-btn"
                        onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                        aria-label="Daha fazla"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {openMenuId === u.id && (
                        <div className="suggest-card-menu-dropdown">
                          <button
                            className="suggest-card-menu-item"
                            onClick={() => {
                              setReportingUserId(u.id);
                              setOpenMenuId(null);
                            }}
                          >
                            <Flag size={14} /> Şikayet Et
                          </button>
                          <button className="suggest-card-menu-item danger" onClick={() => handleBlock(u.id)}>
                            <ShieldOff size={14} /> Engelle
                          </button>
                          <button className="suggest-card-menu-item" onClick={() => handleHide(u.id)}>
                            <EyeOff size={14} /> Gizle
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="suggest-card-bottom">
                      <span className="suggest-card-last-active">{u.lastActiveLabel || ' '}</span>
                      <button
                        className={`btn-discover-accent ${following ? 'following' : ''}`}
                        onClick={() => handleToggleFollow(u.id)}
                      >
                        {following ? 'Takipte' : 'Takip Et'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* ---------- Bugün Kampüste ---------- */}
              <div className="section-heading">
                <h3>📈 Bugün Kampüste</h3>
              </div>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <div className="stat-chip">
                  <span className="stat-chip-value">{data.stats.newUsersToday}</span>
                  <span className="stat-chip-label">Yeni Kullanıcı</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-value">{data.stats.newPostsToday}</span>
                  <span className="stat-chip-label">Yeni Paylaşım</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-value">{data.stats.newClubsToday}</span>
                  <span className="stat-chip-label">Yeni Kulüp</span>
                </div>
                <div className="stat-chip">
                  <span className="stat-chip-value">{data.stats.newEventsToday}</span>
                  <span className="stat-chip-label">Yeni Etkinlik</span>
                </div>
              </div>

              {/* ---------- Diğer Üniversiteler (Premium) ---------- */}
              {data.otherUniversities && (
                <>
                  <div className="section-heading">
                    <h3>
                      <Globe2 size={16} style={{ verticalAlign: -2, marginRight: 4 }} />
                      Diğer Üniversiteler
                    </h3>
                  </div>

                  {data.otherUniversities.locked ? (
                    data.otherUniversities.lockedCount > 0 ? (
                      <div
                        className="other-uni-locked-banner"
                        onClick={() =>
                          openPaywall(
                            `${data.otherUniversities.lockedCount} kişi farklı üniversitelerden seninle tanışmayı bekliyor.`
                          )
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="other-uni-locked-banner-icon">
                          <Lock size={18} />
                        </div>
                        <h4>{data.otherUniversities.lockedCount} kişi seni bekliyor</h4>
                        <p>Şu an sadece {user?.university?.name} içindeki kişileri görüyorsun. Premium ile tüm üniversitelerden kişilerle tanış.</p>
                        {data.otherUniversities.universityBreakdown?.length > 0 && (
                          <div className="other-uni-chip-row">
                            {data.otherUniversities.universityBreakdown.map((b) => (
                              <span className="other-uni-chip" key={b.universityId}>
                                {b.name} · <b>{b.count}</b>
                              </span>
                            ))}
                          </div>
                        )}
                        <button className="btn-premium-cta">👑 Premium'a Geç</button>
                      </div>
                    ) : (
                      <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
                        Şu an başka üniversiteden gösterilecek kimse yok.
                      </p>
                    )
                  ) : data.otherUniversities.users.length === 0 ? (
                    <p className="muted" style={{ fontSize: 12.5, marginBottom: 16 }}>
                      Şu an başka üniversiteden gösterilecek kimse yok.
                    </p>
                  ) : (
                    data.otherUniversities.users.map((u) => (
                      <div className="suggest-card" key={u.id} onClick={() => navigate(`/users/${u.id}`)} style={{ cursor: 'pointer' }}>
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
                            {u.department && (
                              <div className="suggest-card-department">
                                {u.department}
                                {u.classYear ? ` · ${u.classYear}. Sınıf` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="suggest-card-bottom">
                          <span className="suggest-card-last-active">{u.lastActiveLabel || ' '}</span>
                          <button
                            className="btn-discover-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(u.id);
                            }}
                          >
                            {followedIds.has(u.id) ? 'Takipte' : 'Takip Et'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* ---------- Popüler Üniversiteler ---------- */}
              {data.popularUniversities.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>🎓 Popüler Üniversiteler</h3>
                  </div>
                  <div className="uni-scroll" style={{ marginBottom: 20 }}>
                    {data.popularUniversities.map((u) => (
                      <div key={u.id} className="uni-card" onClick={() => navigate(`/universities/${u.id}`)}>
                        <div className="uni-card-emoji">🏫</div>
                        <div className="uni-card-name">{u.name}</div>
                        <div className="uni-card-count">{u.activeStudents} Aktif Öğrenci</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ---------- Aktif Kullanıcılar ---------- */}
              {data.onlineUsers.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>💬 Aktif Kullanıcılar</h3>
                  </div>
                  <div className="story-bar" style={{ marginBottom: 20 }}>
                    {data.onlineUsers.map((u) => (
                      <div key={u.id} className="active-user-item" onClick={() => navigate(`/users/${u.id}`)}>
                        <div className="active-user-avatar-wrap">
                          <img
                            className="active-user-avatar"
                            src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
                            alt={u.fullName}
                          />
                          <span className="active-user-dot" />
                        </div>
                        <span className="active-user-name">{u.fullName.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ---------- Trend Kulüpler ---------- */}
              {data.trendingClubs.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>🏆 Trend Kulüpler</h3>
                  </div>
                  <div className="category-scroll" style={{ marginBottom: 20 }}>
                    {data.trendingClubs.map((c) => (
                      <div key={c.id} className="trend-club-chip" onClick={() => navigate(`/clubs/${c.id}`)}>
                        <span>{c.iconEmoji}</span>
                        <span>{c.name}</span>
                        <span className="count">· {c.memberCount}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ---------- Günün Önerisi ---------- */}
              {data.dailyTip.department && (
                <div className="tip-card">
                  <p>
                    {data.dailyTip.newInDepartmentToday > 0
                      ? `Bugün kendi bölümünden ${data.dailyTip.newInDepartmentToday} yeni öğrenci katıldı.`
                      : `${data.dailyTip.department} bölümünden yeni katılanları kaçırma, düzenli kontrol et!`}
                  </p>
                  <button className="tip-card-btn" onClick={() => setCategory('department')}>
                    İncele
                  </button>
                </div>
              )}

              {/* ---------- Son Paylaşımlar ---------- */}
              {data.recentPosts.length > 0 && (
                <>
                  <div className="section-heading">
                    <h3>📢 Son Paylaşımlar</h3>
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
                          {timeAgo(post.createdAt)}
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
                      {post.likeCount > 0 && <p className="post-like-count">{post.likeCount} beğenme</p>}
                      {post.imageUrl && post.caption && (
                        <p className="post-caption">
                          <span className="post-author-name">{post.author.fullName}</span> {post.caption}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* ---------- Kart Modu (eşleşme) erişimi ---------- */}
              <div className="card center-text" style={{ marginBottom: 90 }}>
                <p className="muted" style={{ marginBottom: 10 }}>
                  Kaydırarak eşleşme aramak ister misin?
                </p>
                <button className="btn-discover-accent" style={{ margin: '0 auto' }} onClick={() => navigate('/discover/swipe')}>
                  <Zap size={14} /> Kart Modunu Aç
                </button>
              </div>
            </>
          )}
        </>
      )}

      {showFilters && (
        <div className="modal-overlay" onClick={() => setShowFilters(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Filtrele</h3>
              <button className="modal-close" onClick={() => setShowFilters(false)}>
                <X size={16} />
              </button>
            </div>
            <label>Bölüm</label>
            <input
              type="text"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              placeholder="örn. Yönetim Bilişim Sistemleri"
            />
            <label>Sınıf</label>
            <select value={filterClassYear} onChange={(e) => setFilterClassYear(e.target.value)}>
              <option value="">Farketmez</option>
              <option value="1">1. Sınıf</option>
              <option value="2">2. Sınıf</option>
              <option value="3">3. Sınıf</option>
              <option value="4">4. Sınıf</option>
            </select>
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={clearFilters}>
                Temizle
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={applyFilters}>
                Uygula
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
          onUpgraded={() => load(category, { department: filterDepartment, classYear: filterClassYear })}
        />
      )}
    </div>
  );
}
