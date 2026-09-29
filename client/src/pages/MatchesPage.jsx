import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import NotificationBell from '../components/NotificationBell';
import { ChevronRight as ChevronRightIcon, Plus as PlusIcon, X as CloseIcon, Users as UsersIcon, MessageCircle as ChatIcon } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const TABS = { MATCHES: 'matches', GROUPS: 'groups' };

export default function MatchesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(TABS.MATCHES);
  const [matches, setMatches] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([api.get('/matches'), api.get('/groups')])
      .then(([m, g]) => {
        setMatches(m.data);
        setGroups(g.data);
      })
      .catch((err) => console.error('Eşleşmeler/gruplar alınamadı:', err))
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
        eyebrow="Mesajlar"
        title="Sohbet"
        subtitle={loading ? 'Sohbetlerin yükleniyor...' : `${matches.length} eşleşme · ${groups.length} grup sohbeti`}
        actions={
          <>
            <NotificationBell />
            {tab === TABS.GROUPS && (
              <button className="icon-btn-amber is-primary" onClick={() => setShowCreateGroup(true)} aria-label="Yeni grup">
                <PlusIcon width={18} height={18} />
              </button>
            )}
          </>
        }
      />

      <div className="category-scroll">
        <button
          className={`category-pill ${tab === TABS.MATCHES ? 'active' : ''}`}
          onClick={() => setTab(TABS.MATCHES)}
        >
          Eşleşmeler
        </button>
        <button
          className={`category-pill ${tab === TABS.GROUPS ? 'active' : ''}`}
          onClick={() => setTab(TABS.GROUPS)}
        >
          Gruplar
        </button>
      </div>

      {loading && <p className="muted center-text">Yükleniyor...</p>}

      {!loading && tab === TABS.MATCHES && (
        <>
          {matches.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon">💬</div>
              <p className="muted">Henüz bir eşleşmen yok. Keşfet sekmesinden başla!</p>
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

      {!loading && tab === TABS.GROUPS && (
        <>
          {groups.length === 0 && (
            <div className="card empty-state">
              <div className="empty-icon">👥</div>
              <p className="muted">Henüz bir grup sohbetin yok. Eşleşmelerinden bir grup kur!</p>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.id} className="match-row" onClick={() => navigate(`/group/${g.id}`)} role="button" tabIndex={0}>
              <div className="group-avatar-stack">
                <UsersIcon width={20} height={20} />
              </div>
              <div>
                <div className="match-name">{g.name}</div>
                <div className="match-sub">{g.memberCount} üye</div>
              </div>
              <ChevronRightIcon className="match-chevron" />
            </div>
          ))}
        </>
      )}

      {showCreateGroup && (
        <CreateGroupModal
          matches={matches}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group) => {
            setShowCreateGroup(false);
            navigate(`/group/${group.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateGroupModal({ matches, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(userId) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Grup adı gerekli.');
    if (selected.size === 0) return toast.error('En az bir eşleşme seç.');
    setSaving(true);
    try {
      const res = await api.post('/groups', { name, memberIds: [...selected] });
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Grup oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Yeni Grup Sohbeti</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Grup Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="örn. Final Haftası Ekibi" required />

          <label>Kimleri eklemek istersin?</label>
          {matches.length === 0 && <p className="muted">Henüz eşleşmen yok.</p>}
          <div className="member-picker-list">
            {matches.map((m) => (
              <label key={m.matchId} className="member-picker-row">
                <input
                  type="checkbox"
                  checked={selected.has(m.otherUser.id)}
                  onChange={() => toggle(m.otherUser.id)}
                />
                <img
                  className="member-avatar"
                  style={{ width: 34, height: 34 }}
                  src={m.otherUser.photoUrl ? `${API_BASE_URL}${m.otherUser.photoUrl}` : undefined}
                  alt={m.otherUser.fullName}
                />
                <span>{m.otherUser.fullName}</span>
              </label>
            ))}
          </div>

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}
