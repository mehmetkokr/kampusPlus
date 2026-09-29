import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Users as UsersIcon, Crown as CrownIcon, Shield as ShieldIcon, UserX as UserXIcon, MoreVertical as MoreIcon, X as CloseIcon, Plus as PlusIcon, Calendar as CalendarIcon, MapPin as MapPinIcon, Clock as ClockIcon, Sparkles as SparklesIcon } from 'lucide-react';

const TABS = { CHAT: 'chat', EVENTS: 'events', MEMBERS: 'members' };

export default function ClubDetailPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS.CHAT);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const [menuFor, setMenuFor] = useState(null); // hangi üye için işlem menüsü açık
  const [events, setEvents] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [highlighting, setHighlighting] = useState(false);
  const [highlightingEventId, setHighlightingEventId] = useState(null);

  async function handleHighlightClub() {
    setHighlighting(true);
    try {
      await api.post(`/monetization/clubs/${clubId}/highlight`, { planKey: 'club_highlight_7d' });
      loadClub();
    } catch (err) {
      alert(err.response?.data?.error || 'Kulüp öne çıkarılamadı.');
    } finally {
      setHighlighting(false);
    }
  }

  async function handleHighlightEvent(eventId) {
    setHighlightingEventId(eventId);
    try {
      await api.post(`/monetization/events/${eventId}/highlight`, { planKey: 'event_highlight_3d' });
      loadEvents();
    } catch (err) {
      alert(err.response?.data?.error || 'Etkinlik öne çıkarılamadı.');
    } finally {
      setHighlightingEventId(null);
    }
  }

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const skipAutoScrollRef = useRef(false);
  const fileInputRef = useRef(null);

  function loadClub() {
    api
      .get(`/clubs/${clubId}`)
      .then((res) => setClub(res.data))
      .catch(() => setError('Kulüp bulunamadı ya da erişim yetkin yok.'));
  }

  function loadEvents() {
    api
      .get(`/clubs/${clubId}/events`)
      .then((res) => setEvents(res.data))
      .catch(() => {});
  }

  async function handleRsvp(eventId) {
    try {
      await api.post(`/clubs/${clubId}/events/${eventId}/rsvp`);
      loadEvents();
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  useEffect(() => {
    loadClub();
    loadEvents();
    api.get('/profile/me').then((res) => setMyUserId(res.data.id)).catch((err) => console.error('Profil alınamadı:', err));
    api.get(`/clubs/${clubId}/messages`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMoreMessages(res.data.hasMore);
      })
      .catch((err) => console.error('Kulüp mesajları alınamadı:', err));

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = io(API_BASE_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('join_club', clubId);
    socket.on('new_club_message', (msg) => {
      if (msg.clubId === Number(clubId)) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    return () => socket.disconnect();
    // loadClub/loadEvents her render'da yeniden oluşuyor; sadece clubId değişince
    // yeniden çalışması amaçlandığı için dep listesine eklenmiyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (tab === TABS.CHAT) {
      if (skipAutoScrollRef.current) {
        skipAutoScrollRef.current = false;
        return;
      }
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, tab]);

  async function loadOlderMessages() {
    if (loadingOlder || !hasMoreMessages || messages.length === 0) return;
    const oldestId = messages[0].id;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    setLoadingOlder(true);
    try {
      const res = await api.get(`/clubs/${clubId}/messages`, { params: { before: oldestId } });
      skipAutoScrollRef.current = true;
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMoreMessages(res.data.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
      });
    } catch (err) {
      console.error('Eski mesajlar alınamadı:', err);
    } finally {
      setLoadingOlder(false);
    }
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current.emit('send_club_message', { clubId, content: text });
    setText('');
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post(`/clubs/${clubId}/messages/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Fotoğraf gönderilemedi.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleJoin() {
    try {
      await api.post(`/clubs/${clubId}/join`);
      loadClub();
    } catch (err) {
      alert(err.response?.data?.error || 'Katılınamadı.');
    }
  }

  async function handleLeave() {
    if (!window.confirm('Bu kulüpten ayrılmak istediğine emin misin?')) return;
    try {
      await api.post(`/clubs/${clubId}/leave`);
      navigate('/clubs');
    } catch (err) {
      alert(err.response?.data?.error || 'Ayrılınamadı.');
    }
  }

  async function handleKick(userId) {
    if (!window.confirm('Bu üyeyi kulüpten çıkarmak istediğine emin misin?')) return;
    try {
      await api.post(`/clubs/${clubId}/members/${userId}/kick`);
      setMenuFor(null);
      loadClub();
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function handleBan(userId) {
    if (!window.confirm('Bu üyeyi engellemek istediğine emin misin? Tekrar katılamayacak.')) return;
    try {
      await api.post(`/clubs/${clubId}/members/${userId}/ban`);
      setMenuFor(null);
      loadClub();
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function handlePromote(userId) {
    try {
      await api.post(`/clubs/${clubId}/members/${userId}/promote`);
      setMenuFor(null);
      loadClub();
    } catch (err) {
      alert(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  if (error) {
    return (
      <div className="container">
        <div className="chat-header">
          <div className="chat-back" onClick={() => navigate('/clubs')}>
            <ArrowLeftIcon />
          </div>
        </div>
        <p className="error-text center-text">{error}</p>
      </div>
    );
  }

  if (!club) return null;

  const myRole = club.myMembership?.role;
  const isMember = club.myMembership?.status === 'active';
  const isBanned = club.myMembership?.status === 'banned';
  const canManage = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate('/clubs')}>
          <ArrowLeftIcon />
        </div>
        <div className="club-header-icon">{club.iconEmoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-name">
            {club.name}
            {club.isHighlighted && (
              <span className="badge" style={{ marginLeft: 8, fontSize: 11 }} title="Öne çıkan kulüp">
                <SparklesIcon width={11} height={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                Öne Çıkan
              </span>
            )}
          </div>
          <div className="chat-header-status">{club.members.length} üye</div>
        </div>
        <button className="club-tab-toggle" onClick={() => setTab(TABS.EVENTS)} style={{ marginRight: 4 }}>
          <CalendarIcon width={18} height={18} />
        </button>
        <button className="club-tab-toggle" onClick={() => setTab(tab === TABS.MEMBERS ? TABS.CHAT : TABS.MEMBERS)}>
          <UsersIcon width={18} height={18} />
        </button>
      </div>

      {!isMember && !isBanned && (
        <div className="club-join-banner">
          <p>Bu kulübün henüz üyesi değilsin.</p>
          <button className="btn btn-like" onClick={handleJoin}>
            Kulübe Katıl
          </button>
        </div>
      )}

      {isBanned && (
        <div className="club-join-banner banned">
          <p>Bu kulüpten engellendin, sohbeti göremezsin.</p>
        </div>
      )}

      {tab === TABS.CHAT && isMember && (
        <>
          <div className="chat-messages" ref={messagesContainerRef}>
            {hasMoreMessages && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={loadOlderMessages}
                  disabled={loadingOlder}
                  style={{ fontSize: 13, padding: '6px 14px' }}
                >
                  {loadingOlder ? 'Yükleniyor...' : 'Daha eski mesajları yükle'}
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="chat-empty">Henüz mesaj yok. Kulübe ilk mesajı sen at 👋</p>
            )}
            {messages.map((m) => {
              const mine = m.senderId === myUserId;
              return (
                <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                  {!mine && <div className="msg-sender-name">{m.sender?.fullName}</div>}
                  {m.photoUrl ? (
                    <img
                      className={`message-photo ${mine ? 'message-mine' : 'message-theirs'}`}
                      src={buildFileUrl(m.photoUrl)}
                      alt="gönderilen fotoğraf"
                    />
                  ) : (
                    <div className={`message-bubble ${mine ? 'message-mine' : 'message-theirs'}`}>
                      {m.content}
                    </div>
                  )}
                  <div className="message-time">{formatTime(m.createdAt)}</div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-bar">
            <form className="chat-input-inner" onSubmit={sendMessage}>
              <button
                type="button"
                className="chat-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Fotoğraf gönder"
              >
                <ImageIcon width={19} height={19} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Kulübe mesaj yaz..." />
              <button className={`chat-send-btn ${text.trim() ? 'has-text' : ''}`} type="submit">
                <SendIcon />
              </button>
            </form>
          </div>
        </>
      )}

      {tab === TABS.EVENTS && (
        <div className="container" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {isMember && (
              <button className="btn btn-like" onClick={() => setShowCreateEvent(true)}>
                <PlusIcon width={14} height={14} style={{ marginRight: 6 }} /> Etkinlik Oluştur
              </button>
            )}
            {canManage && !club.isHighlighted && (
              <button className="btn btn-secondary" disabled={highlighting} onClick={handleHighlightClub}>
                <SparklesIcon width={14} height={14} style={{ marginRight: 6 }} />
                {highlighting ? 'Başlatılıyor...' : "Kulübü Öne Çıkar (7 gün · ₺79,90)"}
              </button>
            )}
          </div>

          {events.length === 0 && (
            <p className="muted center-text" style={{ marginTop: 20 }}>
              Henüz planlanan bir etkinlik yok.
            </p>
          )}

          {events.map((ev) => {
            const date = new Date(ev.startsAt);
            const day = date.toLocaleDateString('tr-TR', { day: '2-digit' });
            const mon = date.toLocaleDateString('tr-TR', { month: 'short' });
            const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            const canHighlightEvent = canManage || ev.creator?.id === myUserId;
            return (
              <div key={ev.id} className="event-row">
                <div className="event-date">
                  <span className="day">{day}</span>
                  <span className="mon">{mon}</span>
                </div>
                <div className="event-info" style={{ flex: 1 }}>
                  <h4>
                    {ev.title}
                    {ev.isHighlighted && (
                      <span className="badge" style={{ marginLeft: 6, fontSize: 11 }} title="Öne çıkan etkinlik">
                        <SparklesIcon width={11} height={11} style={{ marginRight: 3, verticalAlign: -1 }} />
                        Öne Çıkan
                      </span>
                    )}
                  </h4>
                  {ev.description && <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 4px' }}>{ev.description}</p>}
                  <div className="event-detail-row">
                    <ClockIcon /> {time}
                  </div>
                  {ev.location && (
                    <div className="event-detail-row">
                      <MapPinIcon /> {ev.location}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="event-club-tag">{ev.goingCount} katılımcı</span>
                    {isMember && (
                      <button
                        className={`club-join-btn ${ev.imGoing ? 'joined' : ''}`}
                        style={{ width: 'auto', padding: '5px 12px' }}
                        onClick={() => handleRsvp(ev.id)}
                      >
                        {ev.imGoing ? 'Katılıyorsun' : 'Katıl'}
                      </button>
                    )}
                    {canHighlightEvent && !ev.isHighlighted && (
                      <button
                        className="club-join-btn"
                        style={{ width: 'auto', padding: '5px 12px' }}
                        disabled={highlightingEventId === ev.id}
                        onClick={() => handleHighlightEvent(ev.id)}
                      >
                        <SparklesIcon width={12} height={12} style={{ marginRight: 4 }} />
                        {highlightingEventId === ev.id ? '...' : 'Öne Çıkar (₺39,90)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === TABS.MEMBERS && (
        <div className="container" style={{ paddingTop: 0 }}>
          {club.members.map((m) => (
            <div key={m.id} className="member-row">
              <img
                className="member-avatar"
                src={m.user.photoUrl ? `${API_BASE_URL}${m.user.photoUrl}` : undefined}
                alt={m.user.fullName}
              />
              <div className="member-info">
                <div className="member-name">
                  {m.user.fullName}
                  {m.role === 'owner' && <CrownIcon className="role-icon owner" width={14} height={14} />}
                  {m.role === 'admin' && <ShieldIcon className="role-icon admin" width={14} height={14} />}
                </div>
                <div className="member-dept">{m.user.department || 'Bölüm belirtilmemiş'}</div>
              </div>

              {canManage && m.user.id !== myUserId && m.role !== 'owner' && (
                <div className="member-menu-wrap">
                  <button className="member-menu-btn" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}>
                    <MoreIcon width={18} height={18} />
                  </button>
                  {menuFor === m.id && (
                    <div className="member-menu">
                      {myRole === 'owner' && (
                        <button onClick={() => handlePromote(m.user.id)}>
                          <ShieldIcon width={14} height={14} />
                          {m.role === 'admin' ? 'Yöneticilikten Al' : 'Yönetici Yap'}
                        </button>
                      )}
                      <button onClick={() => handleKick(m.user.id)}>
                        <UserXIcon width={14} height={14} /> Kulüpten Çıkar
                      </button>
                      <button className="danger" onClick={() => handleBan(m.user.id)}>
                        <CloseIcon width={14} height={14} /> Engelle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isMember && myRole !== 'owner' && (
            <button className="btn btn-pass" style={{ marginTop: 20 }} onClick={handleLeave}>
              Kulüpten Ayrıl
            </button>
          )}
        </div>
      )}

      {showCreateEvent && (
        <CreateEventModal
          onClose={() => setShowCreateEvent(false)}
          onCreated={() => {
            setShowCreateEvent(false);
            loadEvents();
          }}
          clubId={clubId}
        />
      )}
    </div>
  );
}

function CreateEventModal({ clubId, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('Etkinlik başlığı gerekli.');
    if (!startsAt) return setError('Tarih ve saat seç.');
    setSaving(true);
    try {
      await api.post(`/clubs/${clubId}/events`, { title, description, location, startsAt });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Etkinlik oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Yeni Etkinlik</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>Başlık</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="örn. Haftalık Buluşma" required />

          <label>Tarih & Saat</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />

          <label>Konum (opsiyonel)</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="örn. Mühendislik Fakültesi, B Blok" />

          <label>Açıklama (opsiyonel)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Etkinlik hakkında kısa bilgi" />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? 'Oluşturuluyor...' : 'Etkinliği Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
}
