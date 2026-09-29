import React, { useState, useEffect, useCallback } from 'react';
import { Send as SendIcon, Flag as FlagIcon, Trash2 as TrashIcon, EyeOff as EyeOffIcon } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';
import NotificationBell from '../components/NotificationBell';
import PageHeader from '../components/PageHeader';
import ReportModal from '../components/ReportModal';

const MAX_LENGTH = 500;
const REACTIONS = [
  { type: 'heart', emoji: '❤️' },
  { type: 'laugh', emoji: '😂' },
  { type: 'sad', emoji: '😢' },
  { type: 'support', emoji: '🤗' },
];

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'şimdi';
  if (min < 60) return `${min} dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa önce`;
  const day = Math.floor(hr / 24);
  return `${day} gün önce`;
}

export default function ConfessionsPage() {
  const toast = useToast();
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const [reportTarget, setReportTarget] = useState(null);

  const load = useCallback((before) => {
    const setBusy = before ? setLoadingMore : setLoading;
    setBusy(true);
    api
      .get('/confessions', { params: before ? { before } : {} })
      .then((res) => {
        setConfessions((prev) => (before ? [...prev, ...res.data.confessions] : res.data.confessions));
        setHasMore(res.data.hasMore);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.error || 'İtiraflar yüklenemedi.'))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePost(e) {
    e.preventDefault();
    setPostError('');
    const trimmed = content.trim();
    if (trimmed.length < 3) return setPostError('İtiraf çok kısa.');
    if (trimmed.length > MAX_LENGTH) return setPostError(`En fazla ${MAX_LENGTH} karakter.`);

    setPosting(true);
    try {
      const res = await api.post('/confessions', { content: trimmed });
      setConfessions((prev) => [res.data, ...prev]);
      setContent('');
    } catch (err) {
      setPostError(err.response?.data?.error || 'İtiraf paylaşılamadı.');
    } finally {
      setPosting(false);
    }
  }

  async function handleReact(id, type) {
    // İyimser güncelleme: sunucuyu beklemeden arayüzü güncelle, hata olursa geri al.
    const prevState = confessions;
    try {
      const res = await api.post(`/confessions/${id}/react`, { type });
      setConfessions((prev) => prev.map((c) => (c.id === id ? res.data : c)));
    } catch (err) {
      setConfessions(prevState);
      toast.error(err.response?.data?.error || 'Tepki kaydedilemedi.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Bu itirafı kaldırmak istediğine emin misin?')) return;
    try {
      await api.delete(`/confessions/${id}`);
      setConfessions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kaldırılamadı.');
    }
  }

  return (
    <div className="container">
      <PageHeader
        tone="rose"
        icon={EyeOffIcon}
        eyebrow="%100 anonim"
        title="İtiraf Kutusu"
        subtitle="Kimse kim yazdığını göremez — ama kurallara uymayan içerikler moderasyon tarafından kaldırılır."
        actions={<NotificationBell />}
      />

      <form onSubmit={handlePost} className="card confession-composer">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Kampüsteki kimseye söyleyemediğin bir şey mi var? Anonim olarak paylaş..."
          rows={3}
          maxLength={MAX_LENGTH}
          style={{ width: '100%', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            {content.length}/{MAX_LENGTH}
          </span>
          <button className="btn btn-like" type="submit" disabled={posting || !content.trim()} style={{ width: 'auto' }}>
            <SendIcon width={14} height={14} /> {posting ? 'Paylaşılıyor...' : 'Anonim Paylaş'}
          </button>
        </div>
        {postError && <p className="error-text" style={{ marginTop: 6 }}>{postError}</p>}
      </form>

      {loading && <p className="muted center-text">Yükleniyor...</p>}
      {error && <p className="error-text center-text">{error}</p>}

      {!loading && !error && confessions.length === 0 && (
        <p className="muted center-text" style={{ marginTop: 24 }}>
          Henüz hiç itiraf yok. İlkini sen paylaş!
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {confessions.map((c) => (
          <div key={c.id} className="card confession-card">
            <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                {c.isMine ? 'Sen (anonim)' : 'Anonim'} · {timeAgo(c.createdAt)}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    onClick={() => handleReact(c.id, r.type)}
                    title={r.type}
                    className={`reaction-btn ${c.myReaction === r.type ? 'active' : ''}`}
                  >
                    {r.emoji} {c.reactionCounts[r.type] > 0 ? c.reactionCounts[r.type] : ''}
                  </button>
                ))}
                {c.isMine ? (
                  <button
                    className="icon-btn-amber"
                    onClick={() => handleDelete(c.id)}
                    title="Kaldır"
                    style={{ width: 28, height: 28 }}
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                ) : (
                  <button
                    className="icon-btn-amber"
                    onClick={() => setReportTarget(c.id)}
                    title="Şikayet et"
                    style={{ width: 28, height: 28 }}
                  >
                    <FlagIcon width={14} height={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && !loading && confessions.length > 0 && (
        <button
          className="btn"
          onClick={() => load(confessions[confessions.length - 1].id)}
          disabled={loadingMore}
          style={{ margin: '16px auto', display: 'block' }}
        >
          {loadingMore ? 'Yükleniyor...' : 'Daha Fazla Yükle'}
        </button>
      )}

      {reportTarget && (
        <ReportModal targetType="confession" targetId={reportTarget} onClose={() => setReportTarget(null)} />
      )}
    </div>
  );
}
