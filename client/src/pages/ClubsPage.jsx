import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import NotificationBell from '../components/NotificationBell';
import { Plus as PlusIcon, ChevronRight as ChevronRightIcon, Users as UsersIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import CreateClubSheet from '../components/CreateClubSheet';
import ClubIcon from '../components/ClubIcon';
import { useI18n } from '../i18n';
import { Landmark } from 'lucide-react';

const CATEGORIES = ['Tümü', 'Teknoloji', 'Spor', 'Sanat', 'Akademik', 'Sosyal', 'Diğer'];

export default function ClubsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tümü');
  // /clubs?new=1 (ör. Keşfet'teki "ilk kulübü sen kur" kartı) oluşturma sayfasını açar
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(() => searchParams.get('new') === '1');

  useEffect(() => {
    if (searchParams.get('new') === '1') setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function loadClubs() {
    setLoading(true);
    api
      .get('/clubs')
      .then((res) => setClubs(res.data))
      .catch(() => setError('Kulüpler yüklenemedi.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadClubs();
  }, []);

  async function handleJoin(clubId, e) {
    e.stopPropagation();
    try {
      await api.post(`/clubs/${clubId}/join`);
      loadClubs();
    } catch (err) {
      alert(err.response?.data?.error || 'Kulübe katılınamadı.');
    }
  }

  const filtered =
    activeCategory === 'Tümü' ? clubs : clubs.filter((c) => c.category === activeCategory);

  const myClubs = filtered.filter((c) => c.myMembership && c.myMembership.status === 'active');
  const discoverClubs = filtered.filter((c) => !c.myMembership || c.myMembership.status !== 'active');

  return (
    <div className="container">
      <PageHeader
        tone="violet"
        icon={UsersIcon}
        eyebrow={t("Topluluklar & etkinlikler")}
        title={t("Kulüpler")}
        subtitle={t("İlgi alanına göre kulüplere katıl, etkinlikleri kaçırma ya da kendi kulübünü kur.")}
        actions={
          <>
            <NotificationBell />
            <button className="icon-btn-amber is-primary" onClick={() => setShowCreate(true)} aria-label={t("Kulüp oluştur")}>
              <PlusIcon width={18} height={18} />
            </button>
          </>
        }
      />

      <div className="category-scroll">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {t(cat)}
          </button>
        ))}
      </div>

      {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}
      {error && <p className="error-text center-text">{error}</p>}

      {!loading && !error && (
        <>
          {myClubs.length > 0 && (
            <>
              <div className="section-heading">
                <h3>{t("Kulüplerim")}</h3>
                <span className="count">{myClubs.length}</span>
              </div>
              <div className="club-grid">
                {myClubs.map((club) => (
                  <ClubCard key={club.id} club={club} onClick={() => navigate(`/clubs/${club.id}`)} />
                ))}
              </div>
            </>
          )}

          <div className="section-heading">
            <h3>{t("Kulüpleri Keşfet")}</h3>
            <span className="count">{discoverClubs.length}</span>
          </div>

          {discoverClubs.length === 0 && myClubs.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon is-glyph"><Landmark size={26} strokeWidth={1.8} /></div>
              <p className="muted">{t("Üniversitende henüz kulüp yok. İlk kulübü sen aç!")}</p>
              <button className="btn" style={{ width: 'auto', marginTop: 6 }} onClick={() => setShowCreate(true)}>
                <PlusIcon width={16} height={16} /> {t("Kulüp Oluştur")}
              </button>
            </div>
          )}

          <div className="club-grid">
            {discoverClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onClick={() => navigate(`/clubs/${club.id}`)}
                onJoin={(e) => handleJoin(club.id, e)}
              />
            ))}
          </div>
        </>
      )}

      {showCreate && (
        <CreateClubSheet
          onClose={() => setShowCreate(false)}
          onCreated={(club) => {
            setShowCreate(false);
            navigate(`/clubs/${club.id}`);
          }}
        />
      )}
    </div>
  );
}

function ClubCard({ club, onClick, onJoin }) {
  const { t } = useI18n();
  const isBanned = club.myMembership?.status === 'banned';
  const isMember = club.myMembership?.status === 'active';

  return (
    <div className="club-card" onClick={onClick} role="button" tabIndex={0}>
      <ClubIcon value={club.iconEmoji} category={club.category} size={44} className="club-icon-new" />
      <h4>{club.name}</h4>
      <p className="club-meta">{club.memberCount} {t("üye")}</p>
      {isBanned ? (
        <button className="club-join-btn" disabled style={{ opacity: 0.5 }}>
          {t("Engellendin")}
        </button>
      ) : isMember ? (
        <button className="club-join-btn joined" onClick={(e) => e.stopPropagation() || onClick()}>
          <ChevronRightIcon width={13} height={13} /> {t("Aç")}
        </button>
      ) : (
        <button className="club-join-btn" onClick={onJoin}>
          <PlusIcon width={13} height={13} /> {t("Katıl")}
        </button>
      )}
    </div>
  );
}
