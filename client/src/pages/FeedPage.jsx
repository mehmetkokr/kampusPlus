import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Flag,
  ShieldOff,
  Smile,
  LayoutGrid,
  ImagePlus,
  Users as UsersIcon,
  Sparkles,
  Trash2,
  MoreHorizontal,
  Eye,
  UserRound,
  ChevronLeft,
  Globe2,
  Handshake,
  Lock,
  Check,
  ChevronDown,
  Heart as HeartIcon,
  MessageCircle as ChatIcon,
  Share2 as ShareIcon,
  Plus as PlusIcon,
  X as CloseIcon,
  Send as SendIcon,
  Bookmark as BookmarkIcon,
  BadgeCheck as VerifiedIcon,
} from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReportModal from '../components/ReportModal';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { PenLine, Sprout, UsersRound } from 'lucide-react';
import { compressImage } from '../utils/image';
import { usePhotoEditor } from '../context/PhotoEditorContext';

const PAGE_SIZE = 10;
const CAPTION_MAX = 280;
const EMOJI_SET = ['😀', '😂', '😍', '🥳', '🔥', '👏', '🎉', '❤️', '😎', '🤔', '👍', '🙌'];

// Akış sekmeleri: kampüsteki herkes, takip ettiklerim, benim paylaşımlarım.
// Gönderiler sen silene kadar kalır; hikayeler 12 saat sonra kaybolur.
const TABS = [
  { value: 'campus', label: 'Kampüs' },
  { value: 'following', label: 'Takip' },
  { value: 'mine', label: 'Paylaşımlarım' },
];

// Gönderi görünürlüğü ("kimler görebilir")
const VISIBILITY = {
  campus: { label: 'Kampüsteki herkes', short: 'Herkes', icon: Globe2, hint: 'Üniversitendeki tüm öğrenciler görebilir ve beğenebilir.' },
  followers: { label: 'Takipçilerim', short: 'Takipçiler', icon: UsersIcon, hint: 'Yalnızca seni takip edenler görebilir.' },
  mutual: { label: 'Karşılıklı takipleştiklerim', short: 'Karşılıklı', icon: Handshake, hint: 'Yalnızca karşılıklı takipleştiğin kişiler görebilir.' },
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} g`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function PostSkeleton() {
  return (
    <div className="x-post x-post-skeleton" aria-hidden="true">
      <span className="skeleton skeleton-avatar" />
      <div style={{ flex: 1 }}>
        <span className="skeleton skeleton-line" style={{ width: '38%' }} />
        <span className="skeleton skeleton-line" style={{ width: '92%', marginTop: 10 }} />
        <span className="skeleton skeleton-line" style={{ width: '70%', marginTop: 6 }} />
      </div>
    </div>
  );
}

export default function FeedPage() {
  const { t: tx } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const editPhoto = usePhotoEditor();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState('campus');
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [storyGroups, setStoryGroups] = useState([]);
  const [sidebar, setSidebar] = useState(null);

  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [openComments, setOpenComments] = useState(null);
  const [reportingPostId, setReportingPostId] = useState(null);
  const [reportingStoryId, setReportingStoryId] = useState(null);
  const storyFileRef = useRef(null);
  const sentinelRef = useRef(null);

  function loadStoriesAndSidebar() {
    api.get('/stories').then((res) => setStoryGroups(res.data)).catch((err) => console.error('Hikayeler yüklenemedi:', err));
    api.get('/feed/sidebar').then((res) => setSidebar(res.data)).catch((err) => console.error('Panel yüklenemedi:', err));
  }

  const fetchPage = useCallback(
    (skip) => api.get('/posts/feed', { params: { filter, skip, take: PAGE_SIZE } }),
    [filter]
  );

  // Sekme değişince akışı sıfırdan yükle
  useEffect(() => {
    setLoading(true);
    fetchPage(0)
      .then((res) => {
        setPosts(res.data.posts);
        setHasMore(res.data.hasMore);
      })
      .catch((err) => console.error('Akış yüklenemedi:', err))
      .finally(() => setLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    loadStoriesAndSidebar();
  }, []);

  // Bildirimden /feed?post=<id> ile gelinirse yorum panelini doğrudan aç
  useEffect(() => {
    const postId = searchParams.get('post');
    if (postId) {
      setOpenComments(Number(postId));
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(posts.length);
      setPosts((prev) => [...prev, ...res.data.posts]);
      setHasMore(res.data.hasMore);
    } catch (err) {
      console.error('Daha fazla gönderi yüklenemedi:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, posts.length, hasMore, loading, loadingMore]);

  // Sonsuz kaydırma
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function patchPost(id, patch) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)));
  }

  async function handleLike(post) {
    patchPost(post.id, (p) => ({ likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }));
    try {
      await api.post(`/posts/${post.id}/like`);
    } catch (err) {
      patchPost(post.id, () => ({ likedByMe: post.likedByMe, likeCount: post.likeCount }));
      toast.error(err.response?.data?.error || 'Beğenilemedi.');
    }
  }

  async function handleSave(post) {
    patchPost(post.id, (p) => ({ savedByMe: !p.savedByMe }));
    try {
      const res = await api.post(`/posts/${post.id}/save`);
      toast.success(res.data.saved ? 'Gönderi kaydedildi.' : 'Kayıttan kaldırıldı.');
    } catch (err) {
      patchPost(post.id, () => ({ savedByMe: post.savedByMe }));
      toast.error('İşlem başarısız.');
    }
  }

  function handleCopyLink(post) {
    navigator.clipboard
      .writeText(`${window.location.origin}/feed?post=${post.id}`)
      .then(() => toast.success('Bağlantı kopyalandı.'))
      .catch(() => toast.error('Bağlantı kopyalanamadı.'));
  }

  async function handleDeletePost(post) {
    if (!await confirm('Bu gönderiyi silmek istediğine emin misin? Bu işlem geri alınamaz.')) return;
    const previous = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    try {
      await api.delete(`/posts/${post.id}`);
      toast.success('Gönderi silindi.');
    } catch (err) {
      setPosts(previous);
      toast.error(err.response?.data?.error || 'Gönderi silinemedi.');
    }
  }

  async function handleBlock(post) {
    if (!await confirm(`${post.author.fullName} kullanıcısını engellemek istediğine emin misin?`)) return;
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
    e.target.value = '';
    if (!file) return;
    const edited = await editPhoto(file, { aspects: ['9:16', '4:5', '1:1'], title: 'Hikâye', doneLabel: 'Paylaş' });
    if (!edited) return;
    const formData = new FormData();
    formData.append('photo', await compressImage(edited));
    try {
      await api.post('/stories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Hikayen 12 saat boyunca karşılıklı takipleştiklerine görünür.');
      loadStoriesAndSidebar();
    } catch (err) {
      toast.error('Hikaye paylaşılamadı.');
    } finally {
      e.target.value = '';
    }
  }

  function handleCreated(newPost) {
    // Yeni gönderi "Kampüs" ve "Paylaşımlarım" sekmelerinde en üstte görünür;
    // "Takip" sekmesi yalnızca başkalarının gönderilerini gösterir.
    if (filter !== 'following') setPosts((prev) => [newPost, ...prev]);
  }

  const emptyByTab = {
    campus: { icon: Sprout, title: 'Kampüste henüz paylaşım yok', text: 'İlk gönderiyi sen paylaş; kampüsteki herkes görebilir.' },
    following: { icon: UsersRound, title: 'Takip ettiklerin henüz paylaşmadı', text: 'Kampüsünden yeni kişiler keşfet ve takip etmeye başla.' },
    mine: { icon: PenLine, title: 'Henüz paylaşımın yok', text: 'Paylaştıkların, sen silene kadar burada kalır.' },
  }[filter];

  return (
    <div className="feed-shell">
      <div className="feed-main">
        <PageHeader
          tone="amber"
          icon={LayoutGrid}
          compact
          eyebrow={user?.university?.name || tx("Kampüs")}
          title={tx("Akış")}
          actions={<NotificationBell />}
        />

        {/* Hikayeler: yalnızca karşılıklı takipleştiklerin */}
        <div className="story-bar">
          <div className="story-item">
            <button className="story-add-btn" onClick={() => storyFileRef.current?.click()} aria-label={tx("Hikaye ekle")}>
              <img
                src={user?.photoUrl ? `${API_BASE_URL}${user.photoUrl}` : undefined}
                alt={tx("Sen")}
                className="story-avatar-img"
              />
              <span className="story-add-badge">
                <PlusIcon width={11} height={11} />
              </span>
            </button>
            <span className="story-label">{tx("Hikayen")}</span>
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
                <button className={`story-ring ${allViewed ? 'seen' : ''}`} onClick={() => setActiveStoryGroup(g)}>
                  <img
                    src={g.author.photoUrl ? `${API_BASE_URL}${g.author.photoUrl}` : undefined}
                    alt={g.author.fullName}
                    className="story-avatar-img"
                  />
                </button>
                <span className="story-label">{g.author.id === user?.id ? tx("Sen") : g.author.fullName.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>

        <div className="x-timeline">
          <nav className="x-tabs" role="tablist" aria-label={tx("Akış sekmeleri")}>
            {TABS.map((t) => (
              <button
                key={t.value}
                role="tab"
                aria-selected={filter === t.value}
                className={`x-tab ${filter === t.value ? 'active' : ''}`}
                onClick={() => setFilter(t.value)}
              >
                <span>{tx(t.label)}</span>
              </button>
            ))}
          </nav>

          <Composer user={user} onCreated={handleCreated} />

          {loading && (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          )}

          {!loading && posts.length === 0 && (
            <div className="x-empty">
              <div className="empty-icon is-glyph"><emptyByTab.icon size={26} strokeWidth={1.8} /></div>
              <h3>{tx(emptyByTab.title)}</h3>
              <p className="muted">{tx(emptyByTab.text)}</p>
              {filter === 'following' && (
                <Link to="/discover" className="btn" style={{ width: 'auto', marginTop: 8 }}>
                  {tx("Kişileri keşfet")}
                </Link>
              )}
            </div>
          )}

          {posts.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              onLike={handleLike}
              onSave={handleSave}
              onOpenComments={() => setOpenComments(post.id)}
              onCopyLink={handleCopyLink}
              onReport={() => setReportingPostId(post.id)}
              onBlock={handleBlock}
              onDelete={handleDeletePost}
            />
          ))}

          <div ref={sentinelRef} />
          {loadingMore && <PostSkeleton />}
          {!loading && !hasMore && posts.length > 0 && <p className="feed-end">{tx("Hepsini gördün")}</p>}
        </div>

        {activeStoryGroup && (
          <StoryViewer
            group={activeStoryGroup}
            isOwn={activeStoryGroup.author.id === user?.id}
            onClose={() => { setActiveStoryGroup(null); loadStoriesAndSidebar(); }}
            onReport={(storyId) => { setActiveStoryGroup(null); setReportingStoryId(storyId); }}
          />
        )}

        {openComments && (
          <CommentsModal
            postId={openComments}
            onClose={() => setOpenComments(null)}
            onCommentAdded={() => patchPost(openComments, (p) => ({ commentCount: p.commentCount + 1 }))}
          />
        )}

        {reportingPostId && (
          <ReportModal targetType="post" targetId={reportingPostId} onClose={() => setReportingPostId(null)} />
        )}

        {reportingStoryId && (
          <ReportModal targetType="story" targetId={reportingStoryId} onClose={() => setReportingStoryId(null)} />
        )}
      </div>

      <FeedSidebar sidebar={sidebar} onFollow={handleFollowSuggested} />
    </div>
  );
}

// ---------------------------------------------------------
// Gönderi yazma alanı (Twitter tarzı, sayfa içinde)
// ---------------------------------------------------------
function Composer({ user, onCreated }) {
  const { t: tx } = useI18n();
  const toast = useToast();
  const editPhoto = usePhotoEditor();
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [visibility, setVisibility] = useState('campus');
  const [visMenuOpen, setVisMenuOpen] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const textRef = useRef(null);
  const visRef = useRef(null);

  // Metin alanı içeriğe göre uzasın
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!visMenuOpen) return undefined;
    const close = (e) => visRef.current && !visRef.current.contains(e.target) && setVisMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [visMenuOpen]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function pickFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const f = await editPhoto(picked, { aspects: ['original', '1:1', '4:5'], title: 'Gönderi fotoğrafı' });
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const remaining = CAPTION_MAX - text.length;
  const canPost = (text.trim() || file) && remaining >= 0 && !saving;
  const Vis = VISIBILITY[visibility];

  async function submit(e) {
    e.preventDefault();
    if (!canPost) return;
    setSaving(true);
    const form = new FormData();
    form.append('caption', text);
    form.append('visibility', visibility);
    if (file) form.append('photo', await compressImage(file));
    try {
      const res = await api.post('/posts', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      onCreated(res.data);
      setText('');
      setFile(null);
      setPreview(null);
      setShowEmoji(false);
      toast.success('Paylaşıldı.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gönderi paylaşılamadı.');
    } finally {
      setSaving(false);
    }
  }

  // 280 karakter göstergesi (Twitter'daki halka)
  const ratio = Math.min(text.length / CAPTION_MAX, 1);
  const r = 9;
  const circ = 2 * Math.PI * r;

  return (
    <form className="x-composer" onSubmit={submit}>
      <img
        className="x-avatar"
        src={user?.photoUrl ? `${API_BASE_URL}${user.photoUrl}` : undefined}
        alt={user?.fullName || tx("Sen")}
      />
      <div className="x-composer-body">
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={tx("Neler oluyor?")}
          rows={1}
          aria-label={tx("Gönderi metni")}
        />

        {preview && (
          <div className="x-composer-media">
            <img src={preview} alt={tx("Seçilen fotoğraf")} />
            <button type="button" onClick={() => { setFile(null); setPreview(null); }} aria-label={tx("Fotoğrafı kaldır")}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        <div className="x-visibility" ref={visRef}>
          <button type="button" className="x-visibility-btn" onClick={() => setVisMenuOpen((v) => !v)} aria-expanded={visMenuOpen}>
            <Vis.icon size={14} /> {tx(Vis.label)} <ChevronDown size={14} />
          </button>
          {visMenuOpen && (
            <div className="x-visibility-menu" role="menu">
              <p>{tx("Kimler görebilir?")}</p>
              {Object.entries(VISIBILITY).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={visibility === key}
                  onClick={() => { setVisibility(key); setVisMenuOpen(false); }}
                >
                  <span className="x-visibility-icon">
                    <v.icon size={16} />
                  </span>
                  <span className="x-visibility-text">
                    <strong>{tx(v.label)}</strong>
                    <small>{tx(v.hint)}</small>
                  </span>
                  {visibility === key && <Check size={16} className="x-visibility-check" />}
                </button>
              ))}
              <p className="x-visibility-note">
                <Lock size={12} /> {tx("Yorumları yalnızca karşılıklı takipleştiğin kişiler yazabilir.")}
              </p>
            </div>
          )}
        </div>

        {showEmoji && (
          <div className="emoji-strip">
            {EMOJI_SET.map((em) => (
              <button type="button" key={em} onClick={() => { setText((t) => t + em); textRef.current?.focus(); }}>
                {em}
              </button>
            ))}
          </div>
        )}

        <div className="x-composer-toolbar">
          <button type="button" className="x-tool" onClick={() => fileRef.current?.click()} aria-label={tx("Fotoğraf ekle")}>
            <ImagePlus size={19} />
          </button>
          <button type="button" className="x-tool" onClick={() => setShowEmoji((v) => !v)} aria-label={tx("Emoji")} aria-pressed={showEmoji}>
            <Smile size={19} />
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickFile} />

          <span className="x-composer-spacer" />

          {text.length > 0 && (
            <span className={`x-counter ${remaining < 0 ? 'over' : remaining <= 20 ? 'warn' : ''}`} aria-label={`${remaining} karakter kaldı`}>
              <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r={r} className="x-counter-track" />
                <circle cx="12" cy="12" r={r} className="x-counter-fill" strokeDasharray={circ} strokeDashoffset={circ * (1 - ratio)} />
              </svg>
              {remaining <= 20 && <span>{remaining}</span>}
            </span>
          )}

          <button type="submit" className="x-post-btn" disabled={!canPost}>
            {saving ? tx("Paylaşılıyor…") : tx("Paylaş")}
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------
// Sağ Panel (yalnızca masaüstü)
// ---------------------------------------------------------
function FeedSidebar({ sidebar, onFollow }) {
  const { t: tx } = useI18n();
  if (!sidebar) return <aside className="feed-side" />;

  return (
    <aside className="feed-side">
      <div className="card sidebar-card sidebar-stat">
        <span className="sidebar-stat-icon">
          <Sparkles size={16} />
        </span>
        <div>
          <p className="sidebar-stat-value">{sidebar.newTodayCount}</p>
          <p className="sidebar-stat-label">{tx("bugün katılan yeni öğrenci")}</p>
        </div>
      </div>

      <div className="card sidebar-card">
        <h4 className="sidebar-title">
          <span className="live-dot" /> {tx("Şu an aktif")}
        </h4>
        {sidebar.activeUsers.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{tx("Şu anda aktif kimse yok.")}</p>}
        {sidebar.activeUsers.map((u) => (
          <Link to={`/users/${u.id}`} className="sidebar-user-row" key={u.id}>
            <span className="sidebar-avatar-wrap">
              <img className="sidebar-avatar" src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined} alt={u.fullName} />
              <span className="sidebar-online-dot" />
            </span>
            <span className="sidebar-user-name">{u.fullName}</span>
          </Link>
        ))}
      </div>

      <div className="card sidebar-card">
        <h4 className="sidebar-title">
          <UsersIcon size={13} /> {tx("Tanıyor olabilirsin")}
        </h4>
        {sidebar.suggested.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>{tx("Şu an önerecek kimse yok.")}</p>}
        {sidebar.suggested.map((u) => (
          <div className="sidebar-user-row" key={u.id}>
            <Link to={`/users/${u.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
              <img className="sidebar-avatar" src={u.photoUrl ? `${API_BASE_URL}${u.photoUrl}` : undefined} alt={u.fullName} />
              <span className="sidebar-user-name">{u.fullName}</span>
            </Link>
            <button className="sidebar-follow-btn" onClick={() => onFollow(u.id)}>
              {tx("Takip Et")}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------
// Zaman akışı satırı (Twitter tarzı gönderi)
// ---------------------------------------------------------
function PostRow({ post, onLike, onSave, onOpenComments, onCopyLink, onReport, onBlock, onDelete }) {
  const { t: tx } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const Vis = post.visibility && post.visibility !== 'campus' ? VISIBILITY[post.visibility] : null;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <article className="x-post">
      <Link to={`/users/${post.author.id}`} className="x-avatar-link" aria-label={post.author.fullName}>
        <img className="x-avatar" src={post.author.photoUrl ? `${API_BASE_URL}${post.author.photoUrl}` : undefined} alt="" />
      </Link>

      <div className="x-post-body">
        <header className="x-post-head">
          <Link to={`/users/${post.author.id}`} className="x-name">
            {post.author.fullName}
          </Link>
          {post.author.isVerified && <VerifiedIcon size={15} className="x-verified" aria-label={tx("Doğrulanmış")} />}
          <span className="x-meta">· {tx(timeAgo(post.createdAt))}</span>
          {Vis && (
            <span className="x-vis-tag" title={tx(Vis.label)}>
              <Vis.icon size={12} /> {tx(Vis.short)}
            </span>
          )}

          <div className="x-post-menu" ref={menuRef}>
            <button className="x-icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label={tx("Gönderi seçenekleri")} aria-expanded={menuOpen}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="post-menu-dropdown" role="menu">
                <button role="menuitem" onClick={() => { onSave(post); setMenuOpen(false); }}>
                  <BookmarkIcon width={15} height={15} /> {post.savedByMe ? tx("Kaydı Kaldır") : tx("Kaydet")}
                </button>
                <button role="menuitem" onClick={() => { onCopyLink(post); setMenuOpen(false); }}>
                  <ShareIcon width={15} height={15} /> {tx("Bağlantıyı Kopyala")}
                </button>
                {post.isOwn ? (
                  <button role="menuitem" className="danger" onClick={() => { onDelete(post); setMenuOpen(false); }}>
                    <Trash2 size={15} /> {tx("Gönderiyi Sil")}
                  </button>
                ) : (
                  <>
                    <button role="menuitem" onClick={() => { onReport(); setMenuOpen(false); }}>
                      <Flag size={15} /> {tx("Şikayet Et")}
                    </button>
                    <button role="menuitem" className="danger" onClick={() => { onBlock(post); setMenuOpen(false); }}>
                      <ShieldOff size={15} /> {tx("Engelle")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {post.caption && <p className="x-text">{post.caption}</p>}
        {post.imageUrl && <img className="x-media" src={`${API_BASE_URL}${post.imageUrl}`} alt="" loading="lazy" />}

        <div className="x-actions">
          <button
            className={`x-action reply ${post.canComment ? '' : 'locked'}`}
            onClick={onOpenComments}
            aria-label={post.canComment ? tx("Yorumlar") : tx("Yorumları gör (yorum yazmak için karşılıklı takip gerekir)")}
            title={post.canComment ? tx("Yorum yap") : tx("Yorum yazmak için karşılıklı takipleşmelisiniz")}
          >
            <ChatIcon size={18} />
            <span>{post.commentCount || ''}</span>
          </button>
          <button
            className={`x-action like ${post.likedByMe ? 'active' : ''}`}
            onClick={() => onLike(post)}
            aria-label={post.likedByMe ? tx("Beğenmekten vazgeç") : tx("Beğen")}
            aria-pressed={post.likedByMe}
          >
            <HeartIcon size={18} fill={post.likedByMe ? 'currentColor' : 'none'} />
            <span>{post.likeCount || ''}</span>
          </button>
          <button className="x-action" onClick={() => onCopyLink(post)} aria-label={tx("Bağlantıyı kopyala")}>
            <ShareIcon size={18} />
          </button>
          <button
            className={`x-action save ${post.savedByMe ? 'active' : ''}`}
            onClick={() => onSave(post)}
            aria-label={post.savedByMe ? tx("Kaydı kaldır") : tx("Kaydet")}
            aria-pressed={post.savedByMe}
          >
            <BookmarkIcon size={18} fill={post.savedByMe ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  );
}

function storyAge(dateStr) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (mins < 60) return `${mins || 1} dk`;
  return `${Math.floor(mins / 60)} sa`;
}

function StoryViewer({ group, isOwn, onClose, onReport }) {
  const { t: tx } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [stories, setStories] = useState(group.stories);
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewers, setViewers] = useState(null); // null: kapalı, []: açık liste
  const [busy, setBusy] = useState(false);
  const story = stories[index];
  const paused = menuOpen || viewers !== null || busy;

  useEffect(() => {
    if (!story) return onClose();
    if (paused) return undefined;
    api.post(`/stories/${story.id}/view`).catch(() => {});
    const timer = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
    // onClose parent'tan sabit geliyor; sadece index/story değişince tetiklenmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, story, paused]);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (viewers !== null) setViewers(null);
      else if (menuOpen) setMenuOpen(false);
      else onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [viewers, menuOpen, onClose]);

  async function showViewers() {
    setMenuOpen(false);
    setViewers([]);
    try {
      const res = await api.get(`/stories/${story.id}/viewers`);
      setViewers(res.data);
    } catch (err) {
      setViewers(null);
      toast.error(err.response?.data?.error || 'Görüntüleyenler alınamadı.');
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    setBusy(true);
    if (!await confirm('Bu hikayeyi silmek istediğine emin misin?')) {
      setBusy(false);
      return;
    }
    try {
      await api.delete(`/stories/${story.id}`);
      toast.success('Hikaye silindi.');
      const remaining = stories.filter((st) => st.id !== story.id);
      if (remaining.length === 0) return onClose();
      setStories(remaining);
      setIndex((i) => Math.min(i, remaining.length - 1));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Hikaye silinemedi.');
    } finally {
      setBusy(false);
    }
  }

  if (!story) return null;

  return (
    <div className="story-viewer-overlay" onClick={onClose}>
      <div className="story-progress-row">
        {stories.map((st, i) => (
          <div key={st.id} className="story-progress-track">
            <div className={`story-progress-fill ${i < index ? 'done' : i === index ? (paused ? 'paused' : 'active') : ''}`} />
          </div>
        ))}
      </div>

      <div className="story-viewer-header" onClick={(e) => e.stopPropagation()}>
        <img
          src={group.author.photoUrl ? `${API_BASE_URL}${group.author.photoUrl}` : undefined}
          alt={group.author.fullName}
        />
        <span className="story-viewer-name">
          {group.author.fullName}
          <small>{tx(storyAge(story.createdAt))}</small>
        </span>
      </div>

      <div className="story-viewer-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="story-viewer-icon-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={tx("Hikaye seçenekleri")}
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={20} />
        </button>
        <button className="story-viewer-icon-btn" onClick={onClose} aria-label={tx("Kapat")}>
          <CloseIcon width={20} height={20} />
        </button>

        {menuOpen && (
          <div className="story-menu" role="menu">
            {isOwn ? (
              <>
                <button role="menuitem" onClick={showViewers}>
                  <Eye size={16} /> {tx("Görüntüleyenler")}
                </button>
                <button role="menuitem" className="danger" onClick={handleDelete}>
                  <Trash2 size={16} /> {tx("Hikayeyi sil")}
                </button>
              </>
            ) : (
              <>
                <button role="menuitem" onClick={() => navigate(`/users/${group.author.id}`)}>
                  <UserRound size={16} /> {tx("Profile git")}
                </button>
                <button role="menuitem" className="danger" onClick={() => onReport(story.id)}>
                  <Flag size={16} /> {tx("Şikayet et")}
                </button>
              </>
            )}
            <button role="menuitem" className="story-menu-cancel" onClick={() => setMenuOpen(false)}>
              {tx("Vazgeç")}
            </button>
          </div>
        )}
      </div>

      <img className="story-viewer-image" src={`${API_BASE_URL}${story.imageUrl}`} alt="" onClick={(e) => e.stopPropagation()} />

      {viewers !== null && (
        <div className="story-viewers-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="story-viewers-head">
            <button className="story-viewer-icon-btn" onClick={() => setViewers(null)} aria-label={tx("Geri")}>
              <ChevronLeft size={20} />
            </button>
            <strong>{tx("Görüntüleyenler")}</strong>
            <span>{viewers.length}</span>
          </div>
          {viewers.length === 0 ? (
            <p className="story-viewers-empty">{tx("Henüz kimse görüntülemedi.")}</p>
          ) : (
            <ul>
              {viewers.map((v) => (
                <li key={v.id}>
                  <img src={v.photoUrl ? `${API_BASE_URL}${v.photoUrl}` : undefined} alt={v.fullName} />
                  <span>{v.fullName}</span>
                  <small>{tx(`${storyAge(v.viewedAt)} önce`)}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Yorumlar (üst yorum + tek seviye yanıt). Gönderiyi görebilen herkes okur;
// yalnızca karşılıklı takipleşenler ve gönderi sahibi yazabilir.
// ---------------------------------------------------------
function CommentsModal({ postId, onClose, onCommentAdded }) {
  const { t: tx } = useI18n();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [canComment, setCanComment] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [replyTo, setReplyTo] = useState(null); // { id, name }

  function load() {
    api
      .get(`/posts/${postId}/comments`)
      .then((res) => {
        setComments(res.data.comments);
        setCanComment(res.data.canComment);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        else console.error('Yorumlar alınamadı:', err);
      })
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
      toast.error(err.response?.data?.error || 'Yorum eklenemedi.');
    }
  }

  async function handleCommentLike(comment) {
    const wasLiked = comment.likedByMe;
    const updateTree = (list) =>
      list.map((c) => {
        if (c.id === comment.id) return { ...c, likedByMe: !wasLiked, likeCount: c.likeCount + (wasLiked ? -1 : 1) };
        if (c.replies) return { ...c, replies: updateTree(c.replies) };
        return c;
      });
    setComments((prev) => updateTree(prev));
    try {
      const res = await api.post(`/comments/${comment.id}/like`);
      const apply = (list) =>
        list.map((c) => {
          if (c.id === comment.id) return { ...c, likedByMe: res.data.liked, likeCount: res.data.likeCount };
          if (c.replies) return { ...c, replies: apply(c.replies) };
          return c;
        });
      setComments((prev) => apply(prev));
    } catch (err) {
      setComments((prev) => updateTree(prev)); // hatada geri al
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
            <span className="post-author-name">{c.author.fullName}</span> <span className="comment-text">{c.content}</span>
          </div>
          <div className="comment-row-actions">
            <span>{tx(timeAgo(c.createdAt))}</span>
            {canComment && <button onClick={() => setReplyTo({ id: c.id, name: c.author.fullName })}>{tx("Yanıtla")}</button>}
            {c.likeCount > 0 && <span>{c.likeCount} {tx("beğenme")}</span>}
          </div>
        </div>
        <button
          className={`post-action-btn comment-heart ${c.likedByMe ? 'liked' : ''}`}
          onClick={() => handleCommentLike(c)}
          aria-label={tx("Yorumu beğen")}
        >
          <HeartIcon width={14} height={14} fill={c.likedByMe ? 'currentColor' : 'none'} />
        </button>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '75vh' }}>
        <div className="modal-header">
          <h3>{tx("Yorumlar")}</h3>
          <button className="modal-close" onClick={onClose} aria-label={tx("Kapat")}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {loading && <p className="muted center-text">{tx("Yükleniyor...")}</p>}
        {notFound && <p className="muted center-text">{tx("Bu gönderi artık görüntülenemiyor.")}</p>}
        {!loading && !notFound && comments.length === 0 && <p className="muted center-text">{tx("Henüz yorum yok.")}</p>}

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

        {!loading && !notFound && canComment && (
          <>
            {replyTo && (
              <div className="reply-chip">
                <span>{tx('{name} kullanıcısına yanıt veriyorsun', { name: replyTo.name })}</span>
                <button onClick={() => setReplyTo(null)} aria-label={tx("Yanıtı iptal et")}>
                  <CloseIcon width={12} height={12} />
                </button>
              </div>
            )}
            <form className="chat-input-inner" onSubmit={handleSubmit} style={{ marginTop: 14, maxWidth: '100%' }}>
              <input
                value={text}
                maxLength={CAPTION_MAX}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyTo ? tx('{name} kullanıcısına yanıt yaz...', { name: replyTo.name }) : tx("Yorum yaz...")}
                aria-label={tx("Yorum")}
              />
              <button className={`chat-send-btn ${text.trim() ? 'has-text' : ''}`} type="submit" aria-label={tx("Gönder")}>
                <SendIcon />
              </button>
            </form>
          </>
        )}

        {!loading && !notFound && !canComment && (
          <div className="comment-locked">
            <Lock size={16} />
            <p>
              <strong>{tx("Yorumlar karşılıklı takipleşenlere açık.")}</strong>
              {tx("Bu gönderiye yorum yazabilmek için birbirinizi takip etmeniz gerekiyor.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
