import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api';
import { API_BASE_URL } from '../config';
import NotificationBell from '../components/NotificationBell';
import { ChevronRight as ChevronRightIcon, MessageCircle as ChatIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import LikesReceived from '../components/LikesReceived';
import SegmentedControl from '../components/SegmentedControl';
import { useI18n } from '../i18n';
import { useAuth } from '../context/AuthContext';

const TABS = { MATCHES: 'matches', LIKES: 'likes' };

export default function MatchesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const swipeOn = user?.swipeEnabled !== false;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = Object.values(TABS).includes(searchParams.get('tab')) ? searchParams.get('tab') : TABS.MATCHES;
  const setTab = (next) => setSearchParams(next === TABS.MATCHES ? {} : { tab: next }, { replace: true });
  const [matches, setMatches] = useState([]);
  const [likes, setLikes] = useState(null);
  const [loading, setLoading] = useState(true);

  function loadAll() {
    setLoading(true);
    Promise.all([api.get('/matches'), api.get('/matches/likes-received').catch(() => ({ data: null }))])
      .then(([m, l]) => {
        setMatches(m.data);
        setLikes(l.data);
      })
      .catch((err) => console.error('Eşleşmeler alınamadı:', err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll();
  }, []);

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

      <SegmentedControl
        ariaLabel="Sohbet sekmeleri"
        value={tab}
        onChange={setTab}
        options={[
          { value: TABS.MATCHES, label: 'Eşleşmeler' },
          { value: TABS.LIKES, label: 'Beğenenler', badge: likes?.count > 0 ? (likes.count > 99 ? '99+' : likes.count) : null },
        ]}
      />

      {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}

      {!loading && tab === TABS.MATCHES && (
        <>
          {matches.length === 0 && (
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

          {matches.map((m) => (
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
        </>
      )}

      {!loading && tab === TABS.LIKES && <LikesReceived data={likes} onChanged={loadAll} />}
    </div>
  );
}
