import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import NotificationBell from '../components/NotificationBell';
import { Plus as PlusIcon, X as CloseIcon, ChevronRight as ChevronRightIcon, Users as UsersIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const CATEGORIES = ['Tümü', 'Teknoloji', 'Spor', 'Sanat', 'Akademik', 'Sosyal', 'Diğer'];
const EMOJI_OPTIONS = ['👥', '🤖', '🎨', '⚽', '📚', '🎸', '📷', '♟️', '💡', '🎤', '🥾', '🏀'];

export default function ClubsPage() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tümü');
  const [showCreate, setShowCreate] = useState(false);

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
        eyebrow="Topluluklar & etkinlikler"
        title="Kulüpler"
        subtitle="İlgi alanına göre kulüplere katıl, etkinlikleri kaçırma ya da kendi kulübünü kur."
        actions={
          <>
            <NotificationBell />
            <button className="icon-btn-amber is-primary" onClick={() => setShowCreate(true)} aria-label="Kulüp oluştur">
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
            {cat}
          </button>
        ))}
      </div>

      {loading && <p className="muted center-text">Yükleniyor...</p>}
      {error && <p className="error-text center-text">{error}</p>}

      {!loading && !error && (
        <>
          {myClubs.length > 0 && (
            <>
              <div className="section-heading">
                <h3>Kulüplerim</h3>
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
            <h3>Kulüpleri Keşfet</h3>
            <span className="count">{discoverClubs.length}</span>
          </div>

          {discoverClubs.length === 0 && myClubs.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon">🏛️</div>
              <p className="muted">Üniversitende henüz kulüp yok. İlk kulübü sen aç!</p>
              <button className="btn" style={{ width: 'auto', marginTop: 6 }} onClick={() => setShowCreate(true)}>
                <PlusIcon width={16} height={16} /> Kulüp Oluştur
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
        <CreateClubModal
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
  const isBanned = club.myMembership?.status === 'banned';
  const isMember = club.myMembership?.status === 'active';

  return (
    <div className="club-card" onClick={onClick} role="button" tabIndex={0}>
      {club.isHighlighted && (
        <span
          className="badge"
          style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, padding: '2px 6px' }}
          title="Öne çıkan kulüp"
        >
          ✨ Öne Çıkan
        </span>
      )}
      <div className="club-icon">{club.iconEmoji}</div>
      <h4>{club.name}</h4>
      <p className="club-meta">{club.memberCount} üye</p>
      {isBanned ? (
        <button className="club-join-btn" disabled style={{ opacity: 0.5 }}>
          Engellendin
        </button>
      ) : isMember ? (
        <button className="club-join-btn joined" onClick={(e) => e.stopPropagation() || onClick()}>
          <ChevronRightIcon width={13} height={13} /> Aç
        </button>
      ) : (
        <button className="club-join-btn" onClick={onJoin}>
          <PlusIcon width={13} height={13} /> Katıl
        </button>
      )}
    </div>
  );
}

function CreateClubModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Sosyal');
  const [iconEmoji, setIconEmoji] = useState('👥');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Kulüp adı gerekli.');
    setSaving(true);
    try {
      const res = await api.post('/clubs', { name, description, category, iconEmoji });
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Kulüp oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Yeni Kulüp Oluştur</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Simge</label>
          <div className="emoji-picker">
            {EMOJI_OPTIONS.map((em) => (
              <button
                type="button"
                key={em}
                className={`emoji-option ${iconEmoji === em ? 'active' : ''}`}
                onClick={() => setIconEmoji(em)}
              >
                {em}
              </button>
            ))}
          </div>

          <label>Kulüp Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Kayak Kulübü" required />

          <label>Kategori</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.filter((c) => c !== 'Tümü').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label>Açıklama (opsiyonel)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bu kulüp ne yapar, kimler katılmalı?"
            rows={3}
          />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Oluşturuluyor...' : 'Kulübü Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}
