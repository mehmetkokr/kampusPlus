import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ClubIcon from '../components/ClubIcon';
import { io } from 'socket.io-client';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import {
  ArrowLeft as ArrowLeftIcon,
  BarChart3 as PollIcon,
  BellOff as MuteIcon,
  Calendar as CalendarIcon,
  Check as CheckIcon,
  Clock as ClockIcon,
  Crown as CrownIcon,
  Image as ImageIcon,
  Lock as LockIcon,
  MapPin as MapPinIcon,
  Megaphone as MegaphoneIcon,
  MoreHorizontal as DotsIcon,
  MoreVertical as MoreIcon,
  Pin as PinIcon,
  PinOff as UnpinIcon,
  Plus as PlusIcon,
  Send as SendIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Trash2 as TrashIcon,
  UserCheck as UnbanIcon,
  UserX as UserXIcon,
  Users as UsersIcon,
  X as CloseIcon,
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { compressImage } from '../utils/image';
import { usePhotoEditor } from '../context/PhotoEditorContext';
import { unsendSecondsLeft, useUnsendClock } from '../utils/unsend';

const TABS = { CHAT: 'chat', EVENTS: 'events', MEMBERS: 'members' };

const MUTE_OPTIONS = [
  { minutes: 60, label: '1 saat sustur' },
  { minutes: 1440, label: '1 gün sustur' },
  { minutes: 10080, label: '1 hafta sustur' },
];

const SLOW_MODE = [
  { value: 0, label: 'Kapalı' },
  { value: 10, label: '10 sn' },
  { value: 30, label: '30 sn' },
  { value: 60, label: '1 dk' },
  { value: 300, label: '5 dk' },
];

const isMuted = (m) => !!m?.mutedUntil && new Date(m.mutedUntil) > new Date();

export default function ClubDetailPage() {
  const { t } = useI18n();
  const confirm = useConfirm();
  const { clubId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editPhoto = usePhotoEditor();

  const [club, setClub] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(TABS.CHAT);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const [menuFor, setMenuFor] = useState(null); // hangi üye için işlem menüsü açık
  const [msgMenuFor, setMsgMenuFor] = useState(null); // hangi mesaj için menü açık
  const [attachOpen, setAttachOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [attendeesOpenFor, setAttendeesOpenFor] = useState(null);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const skipAutoScrollRef = useRef(false);
  const fileInputRef = useRef(null);

  function loadClub() {
    return api
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
    api
      .get(`/clubs/${clubId}/messages`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMoreMessages(res.data.hasMore);
      })
      .catch(() => {});

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = io(API_BASE_URL || undefined, { auth: { token } });
    socketRef.current = socket;
    const id = Number(clubId);

    socket.emit('join_club', clubId);
    socket.on('new_club_message', (msg) => {
      if (msg.clubId === id) setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    socket.on('club_message_deleted', ({ clubId: c, messageId, unpinned }) => {
      if (c !== id) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (unpinned) setClub((cl) => (cl ? { ...cl, pinnedMessage: null } : cl));
    });
    socket.on('club_poll_updated', ({ clubId: c, poll }) => {
      if (c !== id) return;
      setMessages((prev) => prev.map((m) => (m.poll?.id === poll.id ? { ...m, poll } : m)));
    });
    socket.on('club_pinned', ({ clubId: c, message }) => {
      if (c === id) setClub((cl) => (cl ? { ...cl, pinnedMessage: message } : cl));
    });
    socket.on('club_updated', ({ clubId: c, ...rest }) => {
      if (c === id) setClub((cl) => (cl ? { ...cl, ...rest } : cl));
    });
    socket.on('club_muted', ({ clubId: c, mutedUntil }) => {
      if (c === id) setClub((cl) => (cl ? { ...cl, myMembership: { ...cl.myMembership, mutedUntil } } : cl));
    });
    socket.on('club_closed', ({ clubId: c }) => {
      if (c !== id) return;
      toast.error('Bu kulüp başkanı tarafından kapatıldı.');
      navigate('/clubs');
    });
    // Sunucu bir mesajı reddederse (duyuru modu, susturma, yavaş mod) nedenini göster
    socket.on('error_message', (msg) => toast.error(msg));

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
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const file = await editPhoto(picked, { aspects: ['original', '1:1', '4:5'], doneLabel: 'Gönder' });
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
    if (!(await confirm('Bu kulüpten ayrılmak istediğine emin misin?'))) return;
    try {
      await api.post(`/clubs/${clubId}/leave`);
      navigate('/clubs');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ayrılınamadı.');
    }
  }

  // Üye işlemleri (çıkar, engelle, yönetici yap, sustur) tek yerden
  async function memberAction(userId, action, body, { confirmText, success } = {}) {
    if (confirmText && !(await confirm(confirmText))) return;
    try {
      const res = await api.post(`/clubs/${clubId}/members/${userId}/${action}`, body);
      setMenuFor(null);
      await loadClub();
      if (typeof success === 'function') toast.success(success(res.data));
      else if (success) toast.success(success);
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function deleteMessage(m, quick = false) {
    setMsgMenuFor(null);
    if (!quick && !(await confirm({ title: 'Mesaj silinsin mi?', message: 'Mesaj herkes için silinir.', confirmLabel: 'Sil', danger: true }))) return;
    try {
      await api.delete(`/clubs/${clubId}/messages/${m.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Mesaj silinemedi.');
    }
  }

  async function pinMessage(messageId) {
    setMsgMenuFor(null);
    try {
      await api.post(`/clubs/${clubId}/pin`, { messageId });
      toast.success(messageId ? 'Mesaj sohbetin üstüne sabitlendi.' : 'Sabitleme kaldırıldı.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'İşlem başarısız.');
    }
  }

  async function vote(poll, optionId) {
    if (poll.closed) return;
    let next;
    if (poll.multiple) next = poll.myVotes.includes(optionId) ? poll.myVotes.filter((x) => x !== optionId) : [...poll.myVotes, optionId];
    else next = poll.myVotes.includes(optionId) ? [] : [optionId];
    try {
      const res = await api.post(`/clubs/${clubId}/polls/${poll.id}/vote`, { optionIds: next });
      setMessages((prev) => prev.map((m) => (m.poll?.id === poll.id ? { ...m, poll: res.data.poll } : m)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Oy verilemedi.');
    }
  }

  async function closePoll(poll) {
    if (!(await confirm({ title: 'Anket bitirilsin mi?', message: 'Oy verme kapanır, sonuçlar sohbette kalır.', confirmLabel: 'Bitir' }))) return;
    try {
      await api.post(`/clubs/${clubId}/polls/${poll.id}/close`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Anket kapatılamadı.');
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  const now = useUnsendClock(messages, myUserId);

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
  const canManage = isMember && (myRole === 'owner' || myRole === 'admin');
  const iAmMuted = isMuted(club.myMembership);
  // Yazamama nedeni (yöneticiler her zaman yazabilir)
  const postBlock = canManage
    ? null
    : club.chatMode === 'admins'
      ? t('Duyuru modu: bu kulüpte şu an yalnızca başkan ve yöneticiler yazabiliyor.')
      : iAmMuted
        ? t('Kulüp yönetimi seni {date} tarihine kadar susturdu.', {
            date: new Date(club.myMembership.mutedUntil).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
          })
        : null;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate('/clubs')}>
          <ArrowLeftIcon />
        </div>
        <ClubIcon value={club.iconEmoji} category={club.category} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-name">{club.name}</div>
          <div className="chat-header-status">
            {club.members.length} {t('üye')}
            {club.chatMode === 'admins' && <span className="club-mode-tag"> · {t('Duyuru modu')}</span>}
            {club.slowModeSeconds > 0 && <span className="club-mode-tag"> · {t('Yavaş mod')}</span>}
          </div>
        </div>
        <button className="club-tab-toggle" onClick={() => setTab(TABS.EVENTS)} aria-label={t('Etkinlikler')} style={{ marginRight: 4 }}>
          <CalendarIcon width={18} height={18} />
        </button>
        <button className="club-tab-toggle" onClick={() => setTab(tab === TABS.MEMBERS ? TABS.CHAT : TABS.MEMBERS)} aria-label={t('Üyeler')} style={{ marginRight: canManage ? 4 : 0 }}>
          <UsersIcon width={18} height={18} />
        </button>
        {canManage && (
          <button className="club-tab-toggle" onClick={() => setShowManage(true)} aria-label={t('Kulüp yönetimi')}>
            <SettingsIcon width={18} height={18} />
          </button>
        )}
      </div>

      {!isMember && !isBanned && (
        <div className="club-join-banner">
          <p>{t('Bu kulübün henüz üyesi değilsin.')}</p>
          <button className="btn btn-like" onClick={handleJoin}>
            {t('Kulübe Katıl')}
          </button>
        </div>
      )}

      {isBanned && (
        <div className="club-join-banner banned">
          <p>{t('Bu kulüpten engellendin, sohbeti göremezsin.')}</p>
        </div>
      )}

      {tab === TABS.CHAT && isMember && (
        <>
          {club.pinnedMessage && (
            <div className="club-pinned">
              <PinIcon width={15} height={15} aria-hidden="true" />
              <div className="club-pinned-text">
                <span>{t('Sabitlenmiş duyuru')}</span>
                <p>{club.pinnedMessage.content || t('Fotoğraf')}</p>
              </div>
              {canManage && (
                <button type="button" onClick={() => pinMessage(null)} aria-label={t('Sabitlemeyi kaldır')}>
                  <UnpinIcon width={15} height={15} />
                </button>
              )}
            </div>
          )}

          <div className="chat-messages" ref={messagesContainerRef}>
            {hasMoreMessages && (
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <button type="button" className="btn-secondary" onClick={loadOlderMessages} disabled={loadingOlder} style={{ fontSize: 13, padding: '6px 14px' }}>
                  {loadingOlder ? t('Yükleniyor...') : t('Daha eski mesajları yükle')}
                </button>
              </div>
            )}
            {messages.length === 0 && <p className="chat-empty">{t('Henüz mesaj yok. Kulübe ilk mesajı sen at.')}</p>}
            {messages.map((m) => {
              const mine = m.senderId === myUserId;
              const unsendLeft = mine ? unsendSecondsLeft(m.createdAt, now) : 0;
              // Üye kendi mesajını ilk 1 dk geri alabilir; yönetici her mesajı siler
              const canDelete = canManage || unsendLeft > 0;
              return (
                <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                  {!mine && <div className="msg-sender-name">{m.sender?.fullName}</div>}
                  <div className="club-msg-line">
                    {m.poll ? (
                      <PollCard poll={m.poll} canManage={canManage} onVote={(optionId) => vote(m.poll, optionId)} onClose={() => closePoll(m.poll)} />
                    ) : m.photoUrl ? (
                      <img className={`message-photo ${mine ? 'message-mine' : 'message-theirs'}`} src={buildFileUrl(m.photoUrl)} alt={t('gönderilen fotoğraf')} />
                    ) : (
                      <div className={`message-bubble ${mine ? 'message-mine' : 'message-theirs'}`}>{m.content}</div>
                    )}
                    {(canDelete || canManage) && (
                      <div className="club-msg-menu-wrap">
                        <button type="button" className="club-msg-menu-btn" onClick={() => setMsgMenuFor(msgMenuFor === m.id ? null : m.id)} aria-label={t('Mesaj seçenekleri')}>
                          <DotsIcon width={16} height={16} />
                        </button>
                        {msgMenuFor === m.id && (
                          <div className={`member-menu club-msg-menu ${mine ? 'align-end' : ''}`}>
                            {canManage && !m.poll && (
                              <button onClick={() => pinMessage(m.id)}>
                                <PinIcon width={14} height={14} /> {t('Üste sabitle')}
                              </button>
                            )}
                            {canDelete && (
                              <button className="danger" onClick={() => deleteMessage(m)}>
                                <TrashIcon width={14} height={14} /> {t('Mesajı sil')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="message-meta">
                    {unsendLeft > 0 && !canManage && (
                      <button type="button" className="unsend-btn" onClick={() => deleteMessage(m, true)} aria-label={t('Mesajı geri al, {n} saniye kaldı', { n: unsendLeft })}>
                        {t('Geri al')} · {unsendLeft} {t('sn')}
                      </button>
                    )}
                    <div className="message-time">{formatTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-bar">
            {postBlock ? (
              <div className="club-post-block" role="status">
                {club.chatMode === 'admins' ? <MegaphoneIcon width={16} height={16} /> : <LockIcon width={16} height={16} />}
                <span>{postBlock}</span>
              </div>
            ) : (
              <form className="chat-input-inner" onSubmit={sendMessage}>
                <div className="club-attach-wrap">
                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={() => (canManage ? setAttachOpen((v) => !v) : fileInputRef.current?.click())}
                    aria-label={canManage ? t('Ekle') : t('Fotoğraf gönder')}
                    aria-expanded={canManage ? attachOpen : undefined}
                  >
                    {canManage ? <PlusIcon width={19} height={19} /> : <ImageIcon width={19} height={19} />}
                  </button>
                  {attachOpen && (
                    <div className="member-menu club-attach-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setAttachOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <ImageIcon width={14} height={14} /> {t('Fotoğraf')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachOpen(false);
                          setShowPoll(true);
                        }}
                      >
                        <PollIcon width={14} height={14} /> {t('Anket')}
                      </button>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Kulübe mesaj yaz...')} maxLength={2000} />
                <button className={`chat-send-btn ${text.trim() ? 'has-text' : ''}`} type="submit" aria-label={t('Gönder')}>
                  <SendIcon />
                </button>
              </form>
            )}
          </div>
        </>
      )}

      {tab === TABS.EVENTS && (
        <div className="container" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {/* Etkinlikleri yalnızca başkan (kurucu) ve yöneticiler oluşturur */}
            {canManage ? (
              <button className="btn btn-like" onClick={() => setShowCreateEvent(true)}>
                <PlusIcon width={14} height={14} style={{ marginRight: 6 }} /> {t('Etkinlik Oluştur')}
              </button>
            ) : (
              isMember && (
                <p className="event-role-note">
                  <ShieldIcon width={14} height={14} /> {t('Etkinlikleri kulüp başkanı ve yöneticiler oluşturur.')}
                </p>
              )
            )}
          </div>

          {events.length === 0 && (
            <p className="muted center-text" style={{ marginTop: 20 }}>
              {t('Henüz planlanan bir etkinlik yok.')}
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
                  <h4>{t(ev.title)}</h4>
                  {ev.description && (
                    <p className="muted" style={{ fontSize: 12.5, margin: '2px 0 4px' }}>
                      {ev.description}
                    </p>
                  )}
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
                    <button type="button" className={`event-pill event-join ${ev.imGoing ? 'is-going' : ''}`} onClick={() => handleRsvp(ev.id)}>
                      {ev.imGoing ? t('Katılıyorsun') : t('Katıl')}
                    </button>
                  )}
                </div>
                {attendeesOpenFor === ev.id && ev.attendees?.length > 0 && (
                  <ul className="event-attendee-list">
                    {ev.attendees.map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => navigate(`/users/${a.id}`)}>
                          <span className="event-attendee-avatar">{a.photoUrl ? <img src={`${API_BASE_URL}${a.photoUrl}`} alt="" /> : a.fullName[0]}</span>
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
              <img className="member-avatar" src={m.user.photoUrl ? `${API_BASE_URL}${m.user.photoUrl}` : undefined} alt={m.user.fullName} />
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
                  {canManage && isMuted(m) && (
                    <span className="role-tag muted">
                      <MuteIcon width={12} height={12} /> {t('Susturuldu')}
                    </span>
                  )}
                </div>
                <div className="member-dept">{m.user.department || t('Bölüm belirtilmemiş')}</div>
              </div>

              {canManage && m.user.id !== myUserId && m.role !== 'owner' && (myRole === 'owner' || m.role !== 'admin') && (
                <div className="member-menu-wrap">
                  <button className="member-menu-btn" onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} aria-label={t('Üye seçenekleri')}>
                    <MoreIcon width={18} height={18} />
                  </button>
                  {menuFor === m.id && (
                    <div className="member-menu">
                      {myRole === 'owner' && (
                        <button
                          onClick={() =>
                            memberAction(m.user.id, 'promote', null, {
                              success: (d) => (d.role === 'admin' ? 'Üye artık yönetici; etkinlik açabilir ve sohbeti yönetebilir.' : 'Yöneticilik yetkisi kaldırıldı.'),
                            })
                          }
                        >
                          <ShieldIcon width={14} height={14} />
                          {m.role === 'admin' ? t('Yöneticilikten Al') : t('Yönetici Yap')}
                        </button>
                      )}
                      {isMuted(m) ? (
                        <button onClick={() => memberAction(m.user.id, 'mute', { minutes: 0 }, { success: 'Susturma kaldırıldı.' })}>
                          <MuteIcon width={14} height={14} /> {t('Susturmayı kaldır')}
                        </button>
                      ) : (
                        MUTE_OPTIONS.map((o) => (
                          <button key={o.minutes} onClick={() => memberAction(m.user.id, 'mute', { minutes: o.minutes }, { success: 'Üye susturuldu; bu sürede sohbete yazamaz.' })}>
                            <MuteIcon width={14} height={14} /> {t(o.label)}
                          </button>
                        ))
                      )}
                      <button onClick={() => memberAction(m.user.id, 'kick', null, { confirmText: 'Bu üyeyi kulüpten çıkarmak istediğine emin misin?', success: 'Üye kulüpten çıkarıldı.' })}>
                        <UserXIcon width={14} height={14} /> {t('Kulüpten Çıkar')}
                      </button>
                      <button
                        className="danger"
                        onClick={() => memberAction(m.user.id, 'ban', null, { confirmText: 'Bu üyeyi engellemek istediğine emin misin? Tekrar katılamayacak.', success: 'Üye engellendi.' })}
                      >
                        <CloseIcon width={14} height={14} /> {t('Engelle')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isMember && myRole !== 'owner' && (
            <button className="btn btn-pass" style={{ marginTop: 20 }} onClick={handleLeave}>
              {t('Kulüpten Ayrıl')}
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

      {showPoll && <CreatePollModal clubId={clubId} onClose={() => setShowPoll(false)} onCreated={() => setShowPoll(false)} />}

      {showManage && (
        <ManageClubSheet
          club={club}
          isOwner={myRole === 'owner'}
          onClose={() => setShowManage(false)}
          onChanged={(patch) => setClub((c) => ({ ...c, ...patch }))}
          onReload={loadClub}
          onClosed={() => navigate('/clubs')}
        />
      )}
    </div>
  );
}

// Sohbetteki anket kartı: seçeneğe dokununca oy verilir, sonuçlar canlı güncellenir
function PollCard({ poll, canManage, onVote, onClose }) {
  const { t } = useI18n();
  const total = poll.options.reduce((s, o) => s + o.votes, 0);
  const voted = poll.myVotes.length > 0;
  return (
    <div className="club-poll" role="group" aria-label={t('Anket')}>
      <div className="club-poll-head">
        <PollIcon width={14} height={14} aria-hidden="true" />
        <span>{poll.closed ? t('Anket bitti') : poll.multiple ? t('Anket · birden fazla seçebilirsin') : t('Anket')}</span>
      </div>
      <p className="club-poll-question">{poll.question}</p>
      <div className="club-poll-options">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.myVotes.includes(o.id);
          // Yöneticiler sonuçları oy vermeden de görür
          const showResult = voted || poll.closed || canManage;
          return (
            <button
              key={o.id}
              type="button"
              className={`club-poll-option ${mine ? 'is-mine' : ''}`}
              onClick={() => onVote(o.id)}
              disabled={poll.closed}
              aria-pressed={mine}
            >
              {showResult && <span className="club-poll-bar" style={{ width: `${pct}%` }} aria-hidden="true" />}
              <span className="club-poll-label">
                {mine && <CheckIcon width={13} height={13} aria-hidden="true" />}
                {o.text}
              </span>
              {showResult && <span className="club-poll-pct">%{pct}</span>}
            </button>
          );
        })}
      </div>
      <div className="club-poll-foot">
        <span>{t('{n} kişi oy verdi', { n: poll.totalVoters })}</span>
        {canManage && !poll.closed && (
          <button type="button" onClick={onClose}>
            {t('Anketi bitir')}
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePollModal({ clubId, onClose, onCreated }) {
  const { t } = useI18n();
  const toast = useToast();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filled = options.map((o) => o.trim()).filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (question.trim().length < 3) return setError(t('Soruyu yaz (en az 3 karakter).'));
    if (filled.length < 2) return setError(t('En az 2 seçenek gir.'));
    setSaving(true);
    try {
      await api.post(`/clubs/${clubId}/polls`, { question, options: filled, multiple });
      toast.success(t('Anket sohbete gönderildi.'));
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || t('Anket gönderilemedi.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('Yeni anket')}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="poll-q">{t('Soru')}</label>
          <input id="poll-q" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder={t('örn. Bir sonraki buluşma hangi gün olsun?')} />

          <label>{t('Seçenekler')}</label>
          {options.map((o, i) => (
            <div key={i} className="poll-option-input">
              <input
                value={o}
                onChange={(e) => setOptions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                maxLength={80}
                placeholder={t('{n}. seçenek', { n: i + 1 })}
                aria-label={t('{n}. seçenek', { n: i + 1 })}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))} aria-label={t('Seçeneği kaldır')}>
                  <CloseIcon width={16} height={16} />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button type="button" className="btn-secondary poll-add-option" onClick={() => setOptions((prev) => [...prev, ''])}>
              <PlusIcon width={14} height={14} /> {t('Seçenek ekle')}
            </button>
          )}

          <label className="poll-multiple">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            <span>{t('Birden fazla seçeneğe oy verilebilsin')}</span>
          </label>

          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? t('Gönderiliyor...') : t('Anketi gönder')}
          </button>
        </form>
      </div>
    </div>
  );
}

// Kulüp yönetimi: sohbet kuralları, engellenenler, (başkan) bilgiler ve kapatma
function ManageClubSheet({ club, isOwner, onClose, onChanged, onReload, onClosed }) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description || '');
  const [saving, setSaving] = useState(false);

  async function save(patch, success) {
    try {
      const res = await api.patch(`/clubs/${club.id}/settings`, patch);
      onChanged(res.data);
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kaydedilemedi.');
    }
  }

  async function saveInfo(e) {
    e.preventDefault();
    setSaving(true);
    await save({ name, description }, t('Kulüp bilgileri güncellendi.'));
    setSaving(false);
  }

  async function unban(userId) {
    try {
      await api.post(`/clubs/${club.id}/members/${userId}/unban`);
      toast.success(t('Engel kaldırıldı; isterse yeniden katılabilir.'));
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Engel kaldırılamadı.');
    }
  }

  async function closeClub() {
    const ok = await confirm({
      title: t('{name} kapatılsın mı?', { name: club.name }),
      message: t('Sohbet, etkinlikler ve üyelikler kalıcı olarak silinir. Bu işlem geri alınamaz.'),
      confirmLabel: t('Kulübü kapat'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/clubs/${club.id}`);
      toast.success(t('Kulüp kapatıldı.'));
      onClosed();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Kulüp kapatılamadı.');
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet club-manage" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('Kulüp yönetimi')}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <section className="club-manage-section">
          <h4>{t('Sohbette kim yazabilir?')}</h4>
          <div className="segmented" role="radiogroup" aria-label={t('Sohbet modu')}>
            {[
              { value: 'everyone', label: t('Tüm üyeler') },
              { value: 'admins', label: t('Yalnızca yöneticiler') },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={club.chatMode === o.value}
                className={`segmented-item ${club.chatMode === o.value ? 'active' : ''}`}
                onClick={() => save({ chatMode: o.value }, o.value === 'admins' ? t('Duyuru modu açık: yalnızca yöneticiler yazabilir.') : t('Tüm üyeler yeniden yazabilir.'))}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="field-hint">{t('Duyuru modunda üyeler mesajları okur ve anketlere oy verir, ama yazamaz.')}</p>
        </section>

        <section className="club-manage-section">
          <h4>{t('Yavaş mod')}</h4>
          <div className="segmented" role="radiogroup" aria-label={t('Yavaş mod')}>
            {SLOW_MODE.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={club.slowModeSeconds === o.value}
                className={`segmented-item ${club.slowModeSeconds === o.value ? 'active' : ''}`}
                onClick={() => save({ slowModeSeconds: o.value }, o.value ? t('Yavaş mod açıldı.') : t('Yavaş mod kapatıldı.'))}
              >
                {t(o.label)}
              </button>
            ))}
          </div>
          <p className="field-hint">{t('Üyeler iki mesaj arasında bu kadar beklemek zorunda kalır. Yöneticiler etkilenmez.')}</p>
        </section>

        <section className="club-manage-section">
          <h4>{t('Engellenen üyeler')}</h4>
          {club.banned?.length ? (
            club.banned.map((b) => (
              <div key={b.id} className="member-row compact">
                <img className="member-avatar" src={b.user.photoUrl ? `${API_BASE_URL}${b.user.photoUrl}` : undefined} alt={b.user.fullName} />
                <div className="member-info">
                  <div className="member-name">{b.user.fullName}</div>
                </div>
                <button type="button" className="btn-secondary" onClick={() => unban(b.user.id)}>
                  <UnbanIcon width={14} height={14} /> {t('Engeli kaldır')}
                </button>
              </div>
            ))
          ) : (
            <p className="muted">{t('Engellenen üye yok.')}</p>
          )}
        </section>

        {isOwner && (
          <>
            <section className="club-manage-section">
              <h4>{t('Kulüp bilgileri')}</h4>
              <form onSubmit={saveInfo}>
                <label htmlFor="club-name">{t('Kulüp adı')}</label>
                <input id="club-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
                <label htmlFor="club-desc">{t('Açıklama')}</label>
                <textarea id="club-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
                <button className="btn btn-like" type="submit" disabled={saving}>
                  {saving ? t('Kaydediliyor...') : t('Kaydet')}
                </button>
              </form>
            </section>

            <section className="club-manage-section danger-zone">
              <h4>{t('Kulübü kapat')}</h4>
              <p className="field-hint">{t('Kulüp, sohbet geçmişi ve etkinlikleriyle birlikte kalıcı olarak silinir.')}</p>
              <button type="button" className="btn btn-pass" onClick={closeClub}>
                <TrashIcon width={15} height={15} style={{ marginRight: 6 }} /> {t('Kulübü kapat')}
              </button>
            </section>
          </>
        )}
      </div>
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
          <h3>{t('Yeni Etkinlik')}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('Kapat')}>
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label>{t('Başlık')}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('örn. Haftalık Buluşma')} required />

          <label>{t('Tarih & Saat')}</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />

          <label>{t('Konum (opsiyonel)')}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('örn. Mühendislik Fakültesi, B Blok')} />

          <label>{t('Açıklama (opsiyonel)')}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t('Etkinlik hakkında kısa bilgi')} />

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-like" type="submit" disabled={saving} style={{ marginTop: 10 }}>
            {saving ? t('Oluşturuluyor...') : t('Etkinliği Oluştur')}
          </button>
        </form>
      </div>
    </div>
  );
}
