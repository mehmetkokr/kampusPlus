import React, { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { API_BASE_URL } from '../config';
import NotificationBell from '../components/NotificationBell';
import { ChevronRight as ChevronRightIcon, MessageCircle as ChatIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../lib/socket';
import '../styles/matches-list.css';

// Ek mesajlarının önizlemesi çevrilir; kullanıcı mesajları olduğu gibi kalır
const MEDIA_PREVIEWS = new Set(['📷 Fotoğraf', '🎤 Sesli mesaj']);

// Son mesaj zamanı: bugün saat, dün "Dün", bu hafta gün adı, daha eskiyse tarih
function shortTime(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const locale = lang === 'en' ? 'en-GB' : 'tr-TR';
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return lang === 'en' ? 'Yesterday' : 'Dün';
  if (days < 7) return d.toLocaleDateString(locale, { weekday: 'short' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

// Sohbet: eşleşmelerin listesi. "Seni beğenenler" Kart Modu'nun sekmesidir.
export default function MatchesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const socket = useSocket();
  const swipeOn = user?.swipeEnabled !== false;
  const [searchParams] = useSearchParams();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/matches')
      .then((res) => setMatches(res.data))
      .catch((err) => console.error('Eşleşmeler alınamadı:', err))
      .finally(() => setLoading(false));
  }, []);

  // Yeni mesaj gelince ya da okununca liste anında güncellenir
  useEffect(() => {
    if (!socket) return undefined;
    const onActivity = ({ matchId, lastMessage }) => {
      setMatches((prev) => {
        const idx = prev.findIndex((m) => m.matchId === matchId);
        if (idx === -1) {
          // Yeni eşleşmeden ilk mesaj: listeyi tazele
          api.get('/matches').then((res) => setMatches(res.data)).catch(() => {});
          return prev;
        }
        const incoming = lastMessage && lastMessage.senderId !== user?.id && lastMessage.id !== prev[idx].lastMessage?.id;
        const updated = { ...prev[idx], lastMessage, unreadCount: prev[idx].unreadCount + (incoming ? 1 : 0) };
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest].sort(
          (a, b) => new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt)
        );
      });
    };
    const onRead = ({ matchId }) => setMatches((prev) => prev.map((m) => (m.matchId === matchId ? { ...m, unreadCount: 0 } : m)));
    const onRemoved = ({ matchId }) => setMatches((prev) => prev.filter((m) => m.matchId !== matchId));
    socket.on('chat_activity', onActivity);
    socket.on('chat_read', onRead);
    socket.on('match_removed', onRemoved);
    return () => {
      socket.off('chat_activity', onActivity);
      socket.off('chat_read', onRead);
      socket.off('match_removed', onRemoved);
    };
  }, [socket, user?.id]);

  // Eski bağlantılar (bildirimler, yer imleri) yeni yerine gitsin
  if (searchParams.get('tab') === 'likes') return <Navigate to="/discover/swipe?tab=likes" replace />;

  return (
    <div className="container">
      <PageHeader
        tone="teal"
        icon={ChatIcon}
        eyebrow={t("Mesajlar")}
        title={t("Sohbet")}
        subtitle={loading ? t("Sohbetlerin yükleniyor...") : t('{n} eşleşme', { n: matches.length })}
        actions={<NotificationBell />}
      />

      {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}

      {!loading && matches.length === 0 && (
        <div className="card empty-state">
          <div className="empty-icon is-glyph"><ChatIcon size={26} strokeWidth={1.8} /></div>
          {swipeOn ? (
            <>
              <p className="muted">{t("Henüz bir eşleşmen yok. Kart Modu'nda beğendiğin biri seni de beğenirse sohbet burada açılır.")}</p>
              <Link to="/discover/swipe" className="btn" style={{ width: 'auto', marginTop: 6 }}>
                {t("Kart Moduna Git")}
              </Link>
            </>
          ) : (
            <p className="muted">{t("Özel sohbetler Kart Modu eşleşmeleriyle açılır. Kart Modu şu an kapalı; kulüp sohbetlerini kullanabilirsin.")}</p>
          )}
        </div>
      )}

      {!loading &&
        matches.map((m) => {
          const unread = m.unreadCount > 0;
          const last = m.lastMessage;
          const preview = last
            ? `${last.senderId === user?.id ? t('Sen: ') : ''}${MEDIA_PREVIEWS.has(last.preview) ? t(last.preview) : last.preview}`
            : t('Yeni eşleşme · İlk mesajı sen gönder');
          return (
            <Link
              key={m.matchId}
              to={`/chat/${m.matchId}`}
              className="match-link"
              aria-label={unread ? t('{name}, {n} okunmamış mesaj', { name: m.otherUser.fullName, n: m.unreadCount }) : m.otherUser.fullName}
            >
              <div className={`match-row ${unread ? 'is-unread' : ''}`}>
                <img
                  className="match-avatar"
                  src={m.otherUser.photoUrl ? `${API_BASE_URL}${m.otherUser.photoUrl}` : undefined}
                  alt=""
                />
                <div className="match-body">
                  <div className="match-top">
                    <span className="match-name">{m.otherUser.fullName}</span>
                    <span className="match-time">{shortTime(last?.createdAt || m.createdAt, lang)}</span>
                  </div>
                  <div className="match-bottom">
                    <span className={`match-preview ${last ? '' : 'is-new'}`}>{preview}</span>
                    {unread && <span className="match-unread" aria-hidden="true">{m.unreadCount > 99 ? '99+' : m.unreadCount}</span>}
                  </div>
                </div>
                <ChevronRightIcon className="match-chevron" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
    </div>
  );
}
