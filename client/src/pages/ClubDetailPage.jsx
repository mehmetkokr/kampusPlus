import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClubIcon from '../components/ClubIcon';
import { io } from 'socket.io-client';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Users as UsersIcon, Crown as CrownIcon, Shield as ShieldIcon, UserX as UserXIcon, MoreVertical as MoreIcon, X as CloseIcon, Plus as PlusIcon, Calendar as CalendarIcon, MapPin as MapPinIcon, Clock as ClockIcon } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/image';

const TABS = { CHAT: 'chat', EVENTS: 'events', MEMBERS: 'members' };

export default function ClubDetailPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { clubId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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
  const [attendeesOpenFor, setAttendeesOpenFor] = useState(null);

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
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
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
    const socket = io(API_BASE_URL || undefined, { auth: { token } });
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
    formData.append('photo', await compressImage(file));
    try {
      await api.post(`/clubs/${clubId}/messages/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf gönderilemedi.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleJoin() {
    try {
      await api.post(`/clubs/${clubId}/join`);
      loadClub();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Katılınamadı.');
    }
  }

  async function handleLeave() {
    if (!await confirm('Bu kulüpten ayrılmak istediğine emin misin?')) return;
    try {
      await api.post(`/clubs/${clubId}/leave`);
      navigate('/clubs');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ayrılınamadı.');
    }
  }

  async function handleKick(userId) {
    if (!await confirm('Bu üyeyi kulüpten çıkarmak istediğine emin misin?')) return;
    try {
      await api.post(`/clubs/${clubId}/members/${userId}/kick`);
      setMenuFor(null);
      loadClub();
      toast.success('Üye kulüpten çıkarıldı.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function handleBan(userId) {
    if (!await confirm('Bu üyeyi engellemek istediğine emin misin? Tekrar katılamayacak.')) return;
    try {
      await api.post(`/clubs/${clubId}/members/${userId}/ban`);
      setMenuFor(null);
      loadClub();
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function handlePromote(userId) {
    try {
      const res = await api.post(`/clubs/${clubId}/members/${userId}/promote`);
      setMenuFor(null);
      loadClub();
      toast.success(
        res.data.role === 'admin'
          ? 'Üye artık yönetici; etkinlik oluşturabilir ve üyeleri yönetebilir.'
          : 'Yöneticilik yetkisi kaldırıldı.'
      );
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
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
        <ClubIcon value={club.iconEmoji} category={club.category} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-name">
            {club.name}
          </div>
          <div className="chat-header-status">{club.members.length} {t("üye")}</div>
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
          <p>{t("Bu kulübün henüz üyesi değilsin.")}</p>
          <button className="btn btn-like" onClick={handleJoin}>
            {t("Kulübe Katıl")}
          </button>
        </div>
      )}

      {isBanned && (
        <div className="club-join-banner banned">
          <p>{t("Bu kulüpten engellendin, sohbeti göremezsin.")}</p>
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
                  {loadingOlder ? t("Yükleniyor...") : t("Daha eski mesajları yükle")}
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <p className="chat-empty">{t("Henüz mesaj yok. Kulübe ilk mesajı sen at.")}</p>
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
                      alt={t("gönderilen fotoğraf")}
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
                aria-label={t("Fotoğraf gönder")}
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
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Kulübe mesaj yaz...")} />
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
            {/* Etkinlikleri yalnızca başkan (kurucu) ve yöneticiler oluşturur */}
            {canManage ? (
              <button className="btn btn-like" onClick={() => setShowCreateEvent(true)}>
                <PlusIcon width={14} height={14} style={{ marginRight: 6 }} /> {t("Etkinlik Oluştur")}
              </button>
            ) : (
              isMember && (
                <p className="event-role-note">
                  <ShieldIcon width={14} height={14} /> {t("Etkinlikleri kulüp başkanı ve yöneticiler oluşturur.")}
                </p>
              )
            )}
          </div>

          {events.length === 0 && (
            <p className="muted center-text" style={{ marginTop: 20 }}>
              {t("Henüz planlanan bir etkinlik yok.")}
            </p>
          )}

          {events.map((ev) => {
            const date = new Date(ev.startsAt);
            const day = date.toLocaleDateString('tr-TR', { day: '2-digit' });
            const mon = date.toLocaleDateString('tr-TR', { month: 'short' });
            const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={ev.id} className="event-row">
                <div className="event-date">
                  <span className="day">{day}</span>
                  <span className="mon">{mon}</span>
                </div>
                <div className="event-info" style={{ flex: 1 }}>
                  <h4>
                    {t(ev.title)}
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
                </div>
                {/* Kartın tam genişliğinde: katılımcı sayısı ve Katıl yan yana, aynı boyutta;
                    avatarlara dokununca katılanlar açılır */}
                <div className="event-actions">
                  <button
                    type="button"
                    className="event-pill event-attendees"
                    onClick={() => setAttendeesOpenFor(attendeesOpenFor === ev.id ? null : ev.id)}
                    aria-expanded={attendeesOpenFor === ev.id}
                    disabled={ev.goingCount === 0}
                  >
                    {ev.attendees?.length > 0 && (
                      <span className="event-avatars" aria-hidden="true">
                        {ev.attendees.slice(0, 3).map((a) =>
                          a.photoUrl ? (
                            <img key={a.id} src={`${API_BASE_URL}${a.photoUrl}`} alt="" />
                          ) : (
                            <span key={a.id} className="event-avatar-fallback">
                              {a.fullName[0]}
                            </span>
                          )
                        )}
                      </span>
                    )}
                    {t('{n} katılımcı', { n: ev.goingCount })}
                  </button>
                  {isMember && (
                    <button
                      type="button"
                      className={`event-pill event-join ${ev.imGoing ? 'is-going' : ''}`}
                      onClick={() => handleRsvp(ev.id)}
                    >
                      {ev.imGoing ? t("Katılıyorsun") : t("Katıl")}
                    </button>
                  )}
                </div>
                {attendeesOpenFor === ev.id && ev.attendees?.length > 0 && (
                  <ul className="event-attendee-list">
                    {ev.attendees.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => navigate(`/users/${a.id}`)}>
                          <span className="event-attendee-avatar">
                            {a.photoUrl ? <img src={`${API_BASE_URL}${a.photoUrl}`} alt="" /> : a.fullName[0]}
                          </span>
                          <span>{a.fullName}</span>
                          {a.id === ev.creator?.id && <span className="event-attendee-role">{t('Düzenleyen')}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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
                  {m.role === 'owner' && (
                    <span className="role-tag owner">
                      <CrownIcon width={12} height={12} /> {t('Başkan')}
                    </span>
                  )}
                  {m.role === 'admin' && (
                    <span className="role-tag admin">
                      <ShieldIcon width={12} height={12} /> {t('Yönetici')}
                    </span>
                  )}
                </div>
                <div className="member-dept">{m.user.department || t("Bölüm belirtilmemiş")}</div>
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
                          {m.role === 'admin' ? t("Yöneticilikten Al") : t("Yönetici Yap")}
                        </button>
                      )}
                      <button onClick={() => handleKick(m.user.id)}>
                        <UserXIcon width={14} height={14} /> {t("Kulüpten Çıkar")}
                      </button>
                      <button className="danger" onClick={() => handleBan(m.user.id)}>
                        <CloseIcon width={14} height={14} /> {t("Engelle")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isMember && myRole !== 'owner' && (
            <button className="btn btn-pass" style={{ marginTop: 20 }} onClick={handleLeave}>
              {t("Kulüpten Ayrıl")}
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
  const { t } = useI18n();
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
          <h3>{t("Yeni Etkinlik")}</h3>
          <button className="modal-close" onClick={onClose}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>{t("Başlık")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("örn. Haftalık Buluşma")} required />

          <label>{t("Tarih & Saat")}</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />

          <label>{t("Konum (opsiyonel)")}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("örn. Mühendislik Fakültesi, B Blok")} />

          <label>{t("Açıklama (opsiyonel)")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("Etkinlik hakkında kısa bilgi")} />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? t("Oluşturuluyor...") : t("Etkinliği Oluştur")}
          </button>
        </form>
      </div>
    </div>
  );
}
