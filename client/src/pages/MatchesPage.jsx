import React, { useState, useEffect } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { API_BASE_URL } from '../config';
import NotificationBell from '../components/NotificationBell';
import { ChevronRight as ChevronRightIcon, MessageCircle as ChatIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';

// Sohbet: eşleşmelerin listesi. "Seni beğenenler" Kart Modu'nun sekmesidir.
export default function MatchesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
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

  // Eski bağlantılar (bildirimler, yer imleri) yeni yerine gitsin
  if (searchParams.get('tab') === 'likes') return <Navigate to="/discover/swipe?tab=likes" replace />;

  return (
    <div className="container">
      <PageHeader
        tone="teal"
        icon={ChatIcon}
        eyebrow={t("Mesajlar")}
        title={t("Sohbet")}
        subtitle={loading ? t("Sohbetlerin yükleniyor...") : `${matches.length} eşleşme`}
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
        matches.map((m) => (
          <Link key={m.matchId} to={`/chat/${m.matchId}`}>
            <div className="match-row">
              <img
                className="match-avatar"
                src={m.otherUser.photoUrl ? `${API_BASE_URL}${m.otherUser.photoUrl}` : undefined}
                alt={m.otherUser.fullName}
              />
              <div>
                <div className="match-name">{m.otherUser.fullName}</div>
                {m.otherUser.department && <div className="match-sub">{m.otherUser.department}</div>}
              </div>
              <ChevronRightIcon className="match-chevron" />
            </div>
          </Link>
        ))}
    </div>
  );
}
