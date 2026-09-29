import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, ShieldOff, PenLine, Smile, LayoutGrid } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import { Heart as HeartIcon, MessageCircle as ChatIcon, Share2 as ShareIcon, Plus as PlusIcon, X as CloseIcon, Send as SendIcon, MoreVertical as MoreIcon, Bookmark as BookmarkIcon, BadgeCheck as VerifiedIcon, Camera as CameraIcon } from 'lucide-react';

const PAGE_SIZE = 8;
const EMOJI_SET = ['😀', '😂', '😍', '🥳', '🔥', '👏', '🎉', '❤️', '😎', '🤔', '👍', '🙌'];

const FILTERS = [
  { key: 'all', label: 'Tümü' },
  { key: 'following', label: 'Takip Ettiklerim' },
  { key: 'university', label: 'Kampüsüm' },
  { key: 'popular', label: 'Popüler' },
];

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function FeedPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState('all');
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [storyGroups, setStoryGroups] = useState([]);
  const [sidebar, setSidebar] = useState(null);

  const [createMode, setCreateMode] = useState(null); // null | 'text' | 'photo' | 'emoji'
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [openComments, setOpenComments] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);
  const storyFileRef = useRef(null);
  const sentinelRef = useRef(null);

  function loadStoriesAndSidebar() {
    api.get('/stories').then((res) => setStoryGroups(res.data)).catch((err) => console.error('Hikayeler yüklenemedi:', err));
    api.get('/feed/sidebar').then((res) => setSidebar(res.data)).catch((err) => console.error('Panel yüklenemedi:', err));
  }

  // Filtre değişince akışı sıfırdan yükle
  useEffect(() => {
    setLoading(true);
    api
      .get('/posts/feed', { params: { filter, skip: 0, take: PAGE_SIZE } })
      .then((res) => {
        setPosts(res.data.posts);
        setHasMore(res.data.hasMore);
      })
      .catch((err) => console.error('Akış yüklenemedi:', err))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    loadStoriesAndSidebar();
  }, []);

  // Bildirim merkezinden "gönderine yorum yapıldı / beğenildi" gibi bir
  // bildirime tıklanınca /feed?post=<id> ile buraya gelinir. Akış listesi
  // kendi filtresine göre yüklendiği için o gönderi listede olmayabilir;
  // yine de yorum panelini doğrudan açarak kullanıcıyı ilgili içeriğe götürürüz.
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId) {
      setOpenComments(Number(postId));
      // URL'i temizle ki panel kapatılınca tekrar aynı gönderi açılmasın
      // ve adres çubuğu gereksiz parametre taşımasın.
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/posts/feed', { params: { filter, skip: posts.length, take: PAGE_SIZE } });
      setPosts((prev) => [...prev, ...res.data.posts]);
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error('Daha fazla gönderi yüklenemedi:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, posts.length, hasMore, loading, loadingMore]);

  // Sonsuz kaydırma: alt sınır görünür olunca bir sonraki sayfayı çek
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function refreshFeed() {
    setLoading(true);
    api
      .get('/posts/feed', { params: { filter, skip: 0, take: PAGE_SIZE } })
      .then((res) => {
        setPosts(res.data.posts);
        setHasMore(res.data.hasMore);
      })
      .finally(() => setLoading(false));
  }

  async function handleLike(post) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
    try {
      await api.post(`/posts/${post.id}/like`);
    } catch (err) {
      refreshFeed();
    }
  }

  async function handleSave(post) {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, savedByMe: !p.savedByMe } : p)));
    try {
      const res = await api.post(`/posts/${post.id}/save`);
      toast.success(res.data.saved ? 'Gönderi kaydedildi.' : 'Kayıttan kaldırıldı.');
    } catch (err) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, savedByMe: post.savedByMe } : p)));
      toast.error('İşlem başarısız.');
    }
  }

  function handleCopyLink(post) {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Bağlantı kopyalandı.'))
      .catch(() => toast.error('Bağlantı kopyalanamadı.'));
  }

  async function handleBlock(post) {
    try {
      await api.post(`/users/${post.author.id}/block`);
      setPosts((prev) => prev.filter((p) => p.author.id !== post.author.id));
      toast.success('Kullanıcı engellendi.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Engellenemedi.');
    }
  }

  async function handleFollowSuggested(targetId) {
    try {
      await api.post(`/users/${targetId}/follow`);
      setSidebar((prev) => ({ ...prev, suggested: prev.suggested.filter((u) => u.id !== targetId) }));
      toast.success('Takip etmeye başladın.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Takip edilemedi.');
    }
  }

  async function handleStoryPhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      loadStoriesAndSidebar();
    } catch (err) {
      toast.error('Hikaye paylaşılamadı.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="feed-shell">
      <div className="feed-main">
        <PageHeader
          tone="amber"
          icon={LayoutGrid}
          eyebrow={user?.fullName ? `Merhaba, ${user.fullName.split(' ')[0]}` : 'Kampüsten son haberler'}
          title="Akış"
          subtitle="Kampüsünde bugün neler oluyor? Paylaş, beğen, sohbete katıl."
          actions={<NotificationBell />}
        />

        {/* Gönderi Oluştur — kompakt kutu */}
        <div className="composer-card">
          <img
            className="composer-avatar"
            src={user?.photoUrl ? `${API_BASE_URL}${user.photoUrl}` : undefined}
            alt={user?.fullName || 'Sen'}
          />
          <button className="composer-input-fake" onClick={() => setCreateMode('text')}>
            Bugün ne paylaşmak istiyorsun?
          </button>
        </div>
        <div className="composer-actions">
          <button className="composer-action-btn" onClick={() => setCreateMode('text')}>
            <PenLine size={17} /> Yazı Yaz
          </button>
          <button className="composer-action-btn" onClick={() => setCreateMode('photo')}>
            <CameraIcon width={17} height={17} /> Fotoğraf
          </button>
          <button className="composer-action-btn" onClick={() => setCreateMode('emoji')}>
            <Smile size={17} /> Emoji
          </button>
        </div>

        {/* Hikaye çubuğu */}
        <div className="story-bar">
          <div className="story-item">
            <button className="story-add-btn" onClick={() => storyFileRef.current?.click()}>
              <img
                src={user?.photoUrl ? `${API_BASE_URL}${user.photoUrl}` : undefined}
                alt="Sen"
                className="story-avatar-img"
              />
              <span className="story-add-badge">
                <PlusIcon width={11} height={11} />
              </span>
            </button>
            <span className="story-label">Hikayen</span>
            <input
              ref={storyFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleStoryPhotoSelect}
            />
          </div>

          {storyGroups.map((g) => {
            const allViewed = g.stories.every((s) => s.viewedByMe);
            return (
              <div className="story-item" key={g.author.id}>
                <button
                  className={`story-ring ${allViewed ? 'seen' : ''}`}
                  onClick={() => setActiveStoryGroup(g)}
                >
                  <img
                    src={g.author.photoUrl ? `${API_BASE_URL}${g.author.photoUrl}` : undefined}
                    alt={g.author.fullName}
                    className="story-avatar-img"
                  />
                </button>
                <span className="story-label">{g.author.fullName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        {/* Filtreler */}
        <div className="feed-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`feed-filter-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="muted center-text">Yükleniyor...</p>}

        {!loading && posts.length === 0 && (
          <div className="card empty-state">
            <div className="empty-icon">📸</div>
            <h3>{filter === 'following' ? 'Akışın boş' : 'Henüz gönderi yok'}</h3>
            <p className="muted">
              {filter === 'following'
                ? 'Henüz takip ettiğin kimse paylaşım yapmadı. Yeni kişiler keşfet.'
                : 'Bu filtrede henüz bir gönderi bulunmuyor.'}
            </p>
            <Link to="/discover" className="btn btn-like" style={{ display: 'inline-flex', width: 'auto', padding: '10px 22px', marginTop: 8 }}>
              Keşfete Git
            </Link>
          </div>
        )}

        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={handleLike}
            onSave={handleSave}
            onOpenComments={() => setOpenComments(post.id)}
            onCopyLink={handleCopyLink}
            onReport={() => setReportingPostId(post.id)}
            onBlock={handleBlock}
          />
        ))}

        <div ref={sentinelRef} />
        {loadingMore && <p className="muted center-text">Yükleniyor...</p>}
        {!loading && !hasMore && posts.length > 0 && (
          <p className="muted center-text" style={{ padding: '10px 0 4px' }}>
            Gösterilecek başka gönderi yok.
          </p>
        )}

        {createMode && (
          <CreatePostModal
            initialMode={createMode}
            onClose={() => setCreateMode(null)}
            onCreated={(newPost) => {
              setCreateMode(null);
              if (filter === 'all' || filter === 'following') {
                setPosts((prev) => [newPost, ...prev]);
              }
            }}
          />
        )}

        {activeStoryGroup && (
          <StoryViewer group={activeStoryGroup} onClose={() => { setActiveStoryGroup(null); loadStoriesAndSidebar(); }} />
        )}

        {openComments && (
          <CommentsModal
            postId={openComments}
            onClose={() => setOpenComments(null)}
            onCommentAdded={() =>
              setPosts((prev) => prev.map((p) => (p.id === openComments ? { ...p, commentCount: p.commentCount + 1 } : p)))
            }
          />
        )}

        {reportingPostId && (
          <ReportModal targetType="post" targetId={reportingPostId} onClose={() => setReportingPostId(null)} />
        )}
      </div>

      <FeedSidebar sidebar={sidebar} onFollow={handleFollowSuggested} />
    </div>
  );
}

// ---------------------------------------------------------
// Sağ Panel (yalnızca masaüstü)
// ---------------------------------------------------------
function FeedSidebar({ sidebar, onFollow }) {
  if (!sidebar) return <aside className="feed-side" />;

  return (
    <aside className="feed-side">
      <div className="card sidebar-card">
        <h4 className="sidebar-title">Bugün Kampüste</h4>
        <p className="sidebar-highlight">{sidebar.newTodayCount} yeni kullanıcı</p>
      </div>

      <div className="card sidebar-card">
        <h4 className="sidebar-title">Aktif Kullanıcılar</h4>
        {sidebar.activeUsers.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>Şu anda aktif kimse yok.</p>}
        {sidebar.activeUsers.map((u) => (
          <Link to={`/users/${u.id}`} className="sidebar-user-row" key={u.id}>
            <span className="sidebar-avatar-wrap">
              <img
                className="sidebar-avatar"
                src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
                alt={u.fullName}
              />
              <span className="sidebar-online-dot" />
            </span>
            <span className="sidebar-user-name">{u.fullName}</span>
          </Link>
        ))}
      </div>

      <div className="card sidebar-card">
        <h4 className="sidebar-title">Önerilen Kişiler</h4>
        {sidebar.suggested.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>Şu an önerecek kimse yok.</p>}
        {sidebar.suggested.map((u) => (
          <div className="sidebar-user-row" key={u.id}>
            <Link to={`/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
              <img
                className="sidebar-avatar"
                src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined}
                alt={u.fullName}
              />
              <span className="sidebar-user-name">{u.fullName}</span>
            </Link>
            <button className="sidebar-follow-btn" onClick={() => onFollow(u.id)}>
              Takip Et
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------
// Gönderi Kartı
// ---------------------------------------------------------
function PostCard({ post, onLike, onSave, onOpenComments, onCopyLink, onReport, onBlock }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  return (
    <div className="post-card card">
      <div className="post-header">
        <Link to={`/users/${post.author.id}`} className="post-header-link">
          <img
            className="post-avatar"
            src={post.author.photoUrl ? `${API_BASE_URL}${post.author.photoUrl}` : undefined}
            alt={post.author.fullName}
          />
          <div className="post-header-text">
            <span className="post-author-name">
              {post.author.fullName}
              {post.author.isVerified && <VerifiedIcon width={14} height={14} className="verified-badge" />}
            </span>
            <span className="post-header-meta">
              {post.author.university ? `${post.author.university} · ` : ''}
              {timeAgo(post.createdAt)}
            </span>
          </div>
        </Link>

        <div className="post-menu-wrap" ref={menuRef}>
          <button className="post-action-btn" style={{ marginLeft: 'auto' }} onClick={() => setMenuOpen((v) => !v)}>
            <MoreIcon width={18} height={18} />
          </button>
          {menuOpen && (
            <div className="post-menu-dropdown">
              <button onClick={() => { onSave(post); setMenuOpen(false); }}>
                <BookmarkIcon width={15} height={15} /> {post.savedByMe ? 'Kaydı Kaldır' : 'Gönderiyi Kaydet'}
              </button>
              <button onClick={() => { onCopyLink(post); setMenuOpen(false); }}>
                <ShareIcon width={15} height={15} /> Bağlantıyı Kopyala
              </button>
              {!post.isOwn && (
                <>
                  <button onClick={() => { onReport(); setMenuOpen(false); }}>
                    <Flag size={15} /> Şikayet Et
                  </button>
                  <button className="danger" onClick={() => { onBlock(post); setMenuOpen(false); }}>
                    <ShieldOff size={15} /> Engelle
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {post.imageUrl ? (
        <img className="post-image" src={`${API_BASE_URL}${post.imageUrl}`} alt="" />
      ) : (
        post.caption && <p className="post-text-only">{post.caption}</p>
      )}

      <div className="post-actions">
        <button className={`post-action-btn ${post.likedByMe ? 'liked' : ''}`} onClick={() => onLike(post)}>
          <HeartIcon width={22} height={22} fill={post.likedByMe ? 'currentColor' : 'none'} />
        </button>
        <button className="post-action-btn" onClick={onOpenComments}>
          <ChatIcon width={21} height={21} />
        </button>
        <button className="post-action-btn" onClick={() => onCopyLink(post)}>
          <ShareIcon width={21} height={21} />
        </button>
        <button
          className={`post-action-btn ${post.savedByMe ? 'saved' : ''}`}
          style={{ marginLeft: 'auto' }}
          onClick={() => onSave(post)}
        >
          <BookmarkIcon width={20} height={20} fill={post.savedByMe ? 'currentColor' : 'none'} />
        </button>
      </div>

      {post.likeCount > 0 && <p className="post-like-count">{post.likeCount} beğenme</p>}

      {post.imageUrl && post.caption && (
        <p className="post-caption">
          <span className="post-author-name">{post.author.fullName}</span> {post.caption}
        </p>
      )}

      {post.commentCount > 0 && (
        <button className="post-comment-link" onClick={onOpenComments}>
          {post.commentCount} yorumun tümünü gör
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Gönderi Oluşturma Modalı (fotoğraflı ya da yalnızca metin)
// ---------------------------------------------------------
function CreatePostModal({ initialMode, onClose, onCreated }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [showEmoji, setShowEmoji] = useState(initialMode === 'emoji');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (initialMode === 'photo') fileInputRef.current?.click();
    if (initialMode === 'text') textareaRef.current?.focus();
  }, [initialMode]);

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function insertEmoji(emoji) {
    setCaption((prev) => `${prev}${emoji}`);
    textareaRef.current?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file && !caption.trim()) return setError('Bir fotoğraf ekle veya bir şeyler yaz.');
    setSaving(true);
    setError('');
    const formData = new FormData();
    if (file) formData.append('photo', file);
    formData.append('caption', caption);
    try {
      const res = await api.post('/posts', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gönderi paylaşılamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Yeni Gönderi</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Bugün ne paylaşmak istiyorsun?"
          />

          {preview && (
            <div className="photo-drop-zone" style={{ height: 200, marginBottom: 10, position: 'relative' }}>
              <img src={preview} alt="önizleme" className="photo-drop-preview" />
              <button
                type="button"
                className="story-viewer-close"
                style={{ top: 8, right: 8, width: 28, height: 28 }}
                onClick={() => { setFile(null); setPreview(null); }}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </div>
          )}

          <div className="composer-actions" style={{ marginBottom: 10 }}>
            <button type="button" className="composer-action-btn" onClick={() => fileInputRef.current?.click()}>
              <CameraIcon width={17} height={17} /> {preview ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
            </button>
            <button type="button" className="composer-action-btn" onClick={() => setShowEmoji((v) => !v)}>
              <Smile size={17} /> Emoji
            </button>
          </div>

          {showEmoji && (
            <div className="emoji-strip">
              {EMOJI_SET.map((e) => (
                <button type="button" key={e} onClick={() => insertEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
            style={{ display: 'none' }}
          />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 4 }}>
            {saving ? 'Paylaşılıyor...' : 'Paylaş'}
          </button>
        </form>
      </div>
    </div>
  );
}

function StoryViewer({ group, onClose }) {
  const [index, setIndex] = useState(0);
  const story = group.stories[index];

  useEffect(() => {
    if (!story) return onClose();
    api.post(`/stories/${story.id}/view`).catch(() => {});
    const timer = setTimeout(() => {
      if (index < group.stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
    // group/onClose parent'tan sabit geliyor; sadece index/story değişince tetiklenmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, story]);

  if (!story) return null;

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-progress-row">
        {group.stories.map((s, i) => (
          <div key={s.id} className="story-progress-track">
            <div className={`story-progress-fill ${i < index ? 'done' : i === index ? 'active' : ''}`} />
          </div>
        ))}
      </div>
      <div className="story-viewer-header">
        <img
          src={group.author.photoUrl ? `${API_BASE_URL}${group.author.photoUrl}` : undefined}
          alt={group.author.fullName}
        />
        <span>{group.author.fullName}</span>
      </div>
      <img className="story-viewer-image" src={`${API_BASE_URL}${story.imageUrl}`} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="story-viewer-close" onClick={onClose}>
        <CloseIcon width={22} height={22} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------
// Yorumlar (üst yorum + tek seviye yanıt)
// ---------------------------------------------------------
function CommentsModal({ postId, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null); // { id, name }

  function load() {
    api
      .get(`/posts/${postId}/comments`)
      .then((res) => setComments(res.data))
      .catch((err) => console.error('Yorumlar alınamadı:', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.post(`/posts/${postId}/comments`, { content: text, parentId: replyTo?.id });
      setText('');
      setReplyTo(null);
      load();
      onCommentAdded();
    } catch (err) {
      console.error('Yorum eklenemedi:', err);
    }
  }

  async function handleCommentLike(comment) {
    const wasLiked = comment.likedByMe;
    const updateTree = (list) =>
      list.map((c) => {
        if (c.id === comment.id) {
          return { ...c, likedByMe: !wasLiked, likeCount: c.likeCount + (wasLiked ? -1 : 1) };
        }
        if (c.replies) return { ...c, replies: updateTree(c.replies) };
        return c;
      });
    setComments((prev) => updateTree(prev));

    try {
      const res = await api.post(`/comments/${comment.id}/like`);
      const applyServerCount = (list) =>
        list.map((c) => {
          if (c.id === comment.id) return { ...c, likedByMe: res.data.liked, likeCount: res.data.likeCount };
          if (c.replies) return { ...c, replies: applyServerCount(c.replies) };
          return c;
        });
      setComments((prev) => applyServerCount(prev));
    } catch (err) {
      console.error('Yorum beğenilemedi:', err);
      setComments((prev) => updateTree(prev)); // hatada eski haline geri al
    }
  }

  function CommentRow({ c, isReply }) {
    return (
      <div className="comment-row" style={isReply ? { marginLeft: 34 } : undefined}>
        <img
          className="member-avatar"
          style={{ width: isReply ? 26 : 32, height: isReply ? 26 : 32 }}
          src={c.author.photoUrl ? `${API_BASE_URL}${c.author.photoUrl}` : undefined}
          alt={c.author.fullName}
        />
        <div style={{ flex: 1 }}>
          <div>
            <span className="post-author-name">{c.author.fullName}</span>{' '}
            <span className="comment-text">{c.content}</span>
          </div>
          <div className="comment-row-actions">
            <span>{timeAgo(c.createdAt)}</span>
            <button onClick={() => setReplyTo({ id: c.id, name: c.author.fullName })}>Yanıtla</button>
            {c.likeCount > 0 && <span>{c.likeCount} beğenme</span>}
          </div>
        </div>
        <button className={`post-action-btn comment-heart ${c.likedByMe ? 'liked' : ''}`} onClick={() => handleCommentLike(c)}>
          <HeartIcon width={14} height={14} fill={c.likedByMe ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '75vh' }}>
        <div className="modal-header">
          <h3>Yorumlar</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {loading && <p className="muted center-text">Yükleniyor...</p>}
        {!loading && comments.length === 0 && <p className="muted center-text">Henüz yorum yok.</p>}

        <div className="comment-list">
          {comments.map((c) => (
            <React.Fragment key={c.id}>
              <CommentRow c={c} />
              {c.replies.map((r) => (
                <CommentRow c={r} isReply key={r.id} />
              ))}
            </React.Fragment>
          ))}
        </div>

        {replyTo && (
          <div className="reply-chip">
            <span>{replyTo.name} kullanıcısına yanıt veriyorsun</span>
            <button onClick={() => setReplyTo(null)}>
              <CloseIcon width={12} height={12} />
            </button>
          </div>
        )}

        <form className="chat-input-inner" onSubmit={handleSubmit} style={{ marginTop: 14, maxWidth: '100%' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={replyTo ? `${replyTo.name} kullanıcısına yanıt yaz...` : 'Yorum yaz...'} />
          <button className={`chat-send-btn ${text.trim() ? 'has-text' : ''}`} type="submit">
            <SendIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
