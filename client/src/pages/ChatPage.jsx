import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Ban, CornerUpLeft, Flag, HeartOff, MoreHorizontal, Smile, UserRound, X as XIcon } from 'lucide-react';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Mic as MicIcon, Paperclip as PaperclipIcon, File as FileIcon } from 'lucide-react';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import ReportModal from '../components/ReportModal';
import { useI18n } from '../i18n';
import { compressImage } from '../utils/image';
import { usePhotoEditor } from '../context/PhotoEditorContext';
import { unsendSecondsLeft, useUnsendClock } from '../utils/unsend';
import { onEveryConnect, useSocket } from '../lib/socket';
import '../styles/chat-actions.css';

const EMOJI_LIST = [
  '😀', '😂', '🥰', '😍', '😘', '😎', '🤔', '😅', '😢', '😭',
  '😡', '😴', '🥳', '😇', '🙃', '😉', '😊', '🤗', '🤩', '😜',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '✌️', '🤝', '👋', '🫶',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '🔥',
  '🎉', '✨', '⭐', '🎓', '📚', '☕', '🍕', '⚽', '🎵', '📸',
];

// Mesaja bırakılabilecek tepkiler (sunucudaki liste: server/src/lib/chat.js)
const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const MESSAGE_MAX = 2000;

// Yanıtlanan mesajın kısa özeti
function quoteText(m, tx) {
  if (!m) return tx('Bu mesaj silindi.');
  if (m.content) return m.content.length > 120 ? `${m.content.slice(0, 120)}…` : m.content;
  if (m.photoUrl) return `📷 ${tx('Fotoğraf')}`;
  if (m.audioUrl) return `🎤 ${tx('Sesli mesaj')}`;
  if (m.fileUrl) return `📎 ${m.fileName || tx('Dosya')}`;
  return '';
}

// Tepkileri emojiye göre grupla: [{ emoji, count, mine }]
function groupReactions(reactions = [], myUserId) {
  const map = new Map();
  for (const r of reactions) {
    const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (r.userId === myUserId) g.mine = true;
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

export default function ChatPage() {
  const { t: tx } = useI18n();
  const { matchId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const editPhoto = usePhotoEditor();
  const confirm = useConfirm();
  const socket = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const unmatchingRef = useRef(false); // kendi kaldırdığımızda canlı bildirim ikinci kez uyarmasın

  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [presence, setPresence] = useState({ online: false, lastSeenAt: null });
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unsending, setUnsending] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [activeId, setActiveId] = useState(null); // eylem çubuğu açık mesaj
  const [report, setReport] = useState(null); // { targetType, targetId }

  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const cancelledRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const otherUserIdRef = useRef(null);
  const myUserIdRef = useRef(null);
  const skipAutoScrollRef = useRef(false);

  useEffect(() => {
    myUserIdRef.current = myUserId;
  }, [myUserId]);

  useEffect(() => {
    api.get(`/messages/${matchId}`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMoreMessages(res.data.hasMore);
      })
      .catch((err) => console.error('Mesajlar alınamadı:', err));
    api.get('/profile/me').then((res) => setMyUserId(res.data.id)).catch((err) => console.error('Profil alınamadı:', err));
    api.get('/matches').then((res) => {
      const m = res.data.find((x) => String(x.matchId) === String(matchId));
      if (m) {
        setOtherUser(m.otherUser);
        otherUserIdRef.current = m.otherUser.id;
      }
    }).catch((err) => console.error('Eşleşmeler alınamadı:', err));
    setReplyTo(null);
    setActiveId(null);
  }, [matchId]);

  // Paylaşılan gerçek zamanlı bağlantı: bu ekran yalnızca dinleyici ekler/kaldırır
  useEffect(() => {
    if (!socket) return undefined;
    const sameMatch = (id) => String(id) === String(matchId);

    // Bağlantı her (yeniden) kurulduğunda sohbet odasına katıl
    const stopJoin = onEveryConnect(socket, () => {
      socket.emit('join_match', matchId);
      socket.emit('mark_read', { matchId });
    });

    const onNew = (msg) => {
      if (!sameMatch(msg.matchId)) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== myUserIdRef.current) socket.emit('mark_read', { matchId });
    };
    const onRemoved = ({ matchId: removedId }) => {
      if (sameMatch(removedId) && !unmatchingRef.current) {
        toast.info('Bu eşleşme kaldırıldı.');
        navigate('/matches', { replace: true });
      }
    };
    const onDeleted = ({ matchId: delMatchId, messageId }) => {
      if (!sameMatch(delMatchId)) return;
      // Silinen mesaja verilen yanıtların alıntısı boşalır
      setMessages((prev) => prev.filter((m) => m.id !== messageId).map((m) => (m.replyToId === messageId ? { ...m, replyTo: null } : m)));
    };
    const onRead = ({ matchId: readMatchId }) => {
      if (sameMatch(readMatchId)) setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
    };
    const onReaction = ({ matchId: rid, messageId, reactions }) => {
      if (sameMatch(rid)) setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    };
    const onTyping = ({ matchId: typingMatchId, userId, isTyping }) => {
      if (sameMatch(typingMatchId) && userId === otherUserIdRef.current) setIsOtherTyping(isTyping);
    };
    const onPresenceState = ({ userId, online, lastSeenAt }) => {
      if (userId === otherUserIdRef.current) setPresence({ online, lastSeenAt });
    };
    const onPresence = ({ userId, online, lastSeenAt }) => {
      if (userId === otherUserIdRef.current) setPresence({ online, lastSeenAt: lastSeenAt ?? null });
    };
    // Sunucu mesajı reddederse (çok uzun, hız sınırı, engel) nedenini göster
    const onError = (msg) => toast.error(msg);

    const handlers = {
      new_message: onNew,
      match_removed: onRemoved,
      message_deleted: onDeleted,
      messages_read: onRead,
      message_reaction: onReaction,
      typing: onTyping,
      presence_state: onPresenceState,
      presence_update: onPresence,
      error_message: onError,
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => {
      stopJoin();
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
    };
    // navigate ve toast sabit; yalnızca sohbet ya da bağlantı değişince yeniden kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, socket]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function loadOlderMessages() {
    if (loadingOlder || !hasMoreMessages || messages.length === 0) return;
    const oldestId = messages[0].id;
    const container = messagesContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    setLoadingOlder(true);
    try {
      const res = await api.get(`/messages/${matchId}`, { params: { before: oldestId } });
      skipAutoScrollRef.current = true;
      setMessages((prev) => [...res.data.messages, ...prev]);
      setHasMoreMessages(res.data.hasMore);

      // Yeni mesajlar üste eklendiğinde scroll pozisyonu sıçramasın diye,
      // eklenen içeriğin yüksekliği kadar scroll konumunu geri kaydırıyoruz.
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    } catch (err) {
      console.error('Eski mesajlar alınamadı:', err);
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleTextChange(e) {
    setText(e.target.value);
    socket?.emit('typing', { matchId, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing', { matchId, isTyping: false });
    }, 1500);
  }

  function insertEmoji(emoji) {
    setText((prev) => prev + emoji);
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !socket) return;
    socket.emit('send_message', { matchId, content: text, replyToId: replyTo?.id || null });
    setText('');
    setReplyTo(null);
    setShowEmojiPicker(false);
    clearTimeout(typingTimeoutRef.current);
    socket.emit('typing', { matchId, isTyping: false });
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
      await api.post(`/messages/${matchId}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Fotoğraf gönderilemedi.');
    } finally {
      e.target.value = '';
    }
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/messages/${matchId}/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Dosya gönderilemedi.');
    } finally {
      e.target.value = '';
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (cancelledRef.current) {
          cancelledRef.current = false;
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice-message.webm');
        try {
          await api.post(`/messages/${matchId}/audio`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (err) {
          toast.error('Sesli mesaj gönderilemedi.');
        }
      };

      mediaRecorderRef.current = recorder;
      cancelledRef.current = false;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast.error('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.');
    }
  }

  function stopRecording(cancel) {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    cancelledRef.current = !!cancel;
    mediaRecorderRef.current?.stop();
  }

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Mesaj eylem çubuğu Esc ile kapanır
  useEffect(() => {
    if (!activeId) return undefined;
    const onKey = (e) => e.key === 'Escape' && setActiveId(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeId]);

  async function unmatch() {
    setMenuOpen(false);
    const name = otherUser?.fullName?.split(' ')[0] || '';
    const ok = await confirm({
      title: 'Eşleşme kaldırılsın mı?',
      message: tx('{name} ile sohbetiniz ikiniz için de silinir ve birbirinizin Kart Modu destesinde tekrar görünmezsiniz. Bu işlem geri alınamaz.', { name }),
      confirmLabel: 'Eşleşmeyi kaldır',
      danger: true,
    });
    if (!ok) return;
    unmatchingRef.current = true;
    try {
      await api.delete(`/matches/${matchId}`);
      toast.success('Eşleşme kaldırıldı.');
      navigate('/matches', { replace: true });
    } catch (err) {
      unmatchingRef.current = false;
      toast.error(err.response?.data?.error || 'Eşleşme kaldırılamadı.');
    }
  }

  async function blockUser() {
    setMenuOpen(false);
    if (!otherUser?.id) return;
    const name = otherUser.fullName?.split(' ')[0] || '';
    const ok = await confirm({
      title: tx('{name} engellensin mi?', { name }),
      message: tx('Birbirinizi göremez ve mesajlaşamazsınız. Bu sohbet listenden kalkar. Engeli Ayarlar’dan kaldırabilirsin.'),
      confirmLabel: 'Engelle',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/users/${otherUser.id}/block`);
      toast.success('Kullanıcı engellendi.');
      navigate('/matches', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Engellenemedi.');
    }
  }

  async function unsendMessage(m) {
    setUnsending(m.id);
    try {
      await api.delete(`/messages/${matchId}/${m.id}`);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Mesaj silinemedi.');
    } finally {
      setUnsending(null);
    }
  }

  async function react(m, emoji) {
    setActiveId(null);
    try {
      const res = await api.post(`/messages/${matchId}/${m.id}/reactions`, { emoji });
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions: res.data.reactions } : x)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Tepki gönderilemedi.');
    }
  }

  function startReply(m) {
    setActiveId(null);
    setReplyTo(m);
    inputRef.current?.focus();
  }

  function jumpTo(id) {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg-flash');
    setTimeout(() => el.classList.remove('msg-flash'), 1200);
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRecordTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatLastSeen(iso) {
    if (!iso) return 'çevrimdışı';
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'az önce görüldü';
    if (diffMin < 60) return `${diffMin} dk önce görüldü`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} sa önce görüldü`;
    return `son görülme: ${d.toLocaleDateString('tr-TR')}`;
  }

  const now = useUnsendClock(messages, myUserId);
  const lastMineIndex = [...messages].map((m) => m.senderId === myUserId).lastIndexOf(true);
  const otherFirstName = otherUser?.fullName?.split(' ')[0] || '';

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button type="button" className="chat-back" onClick={() => navigate('/matches')} aria-label={tx('Geri')}>
          <ArrowLeftIcon />
        </button>
        <img
          src={otherUser?.photoUrl ? `${API_BASE_URL}${otherUser.photoUrl}` : undefined}
          alt={otherUser?.fullName || ''}
        />
        <div>
          <div className="chat-header-name">{otherUser?.fullName || tx("Sohbet")}</div>
          {isOtherTyping ? (
            <div className="chat-header-status typing">
              {tx("Yazıyor")}
              <span className="typing-dots"><span /><span /><span /></span>
            </div>
          ) : presence.online ? (
            <div className="chat-header-status online">{tx("çevrimiçi")}</div>
          ) : (
            <div className="chat-header-status">{tx(formatLastSeen(presence.lastSeenAt))}</div>
          )}
        </div>
        <div className="member-menu-wrap chat-header-menu" ref={menuRef}>
          <button
            type="button"
            className="member-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={tx('Sohbet seçenekleri')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <div className="member-menu" role="menu">
              {otherUser?.id && (
                <button type="button" role="menuitem" onClick={() => navigate(`/users/${otherUser.id}`)}>
                  <UserRound size={15} /> {tx('Profili gör')}
                </button>
              )}
              {otherUser?.id && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setReport({ targetType: 'user', targetId: otherUser.id });
                  }}
                >
                  <Flag size={15} /> {tx('Şikayet et')}
                </button>
              )}
              <button type="button" role="menuitem" className="danger" onClick={unmatch}>
                <HeartOff size={15} /> {tx('Eşleşmeyi kaldır')}
              </button>
              {otherUser?.id && (
                <button type="button" role="menuitem" className="danger" onClick={blockUser}>
                  <Ban size={15} /> {tx('Engelle')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="chat-messages" ref={messagesContainerRef} onClick={(e) => e.target === e.currentTarget && setActiveId(null)}>
        {hasMoreMessages && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              style={{ fontSize: 13, padding: '6px 14px' }}
            >
              {loadingOlder ? tx("Yükleniyor...") : tx("Daha eski mesajları yükle")}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="chat-empty">{tx("Henüz mesaj yok. İlk mesajı sen gönder.")}</p>
        )}

        {messages.map((m, i) => {
          const mine = m.senderId === myUserId;
          const active = activeId === m.id;
          const groups = groupReactions(m.reactions, myUserId);
          const quoted = m.replyToId ? m.replyTo : null;
          return (
            <React.Fragment key={m.id}>
              <div id={`msg-${m.id}`} className={`msg-row ${mine ? 'mine' : 'theirs'} ${active ? 'is-active' : ''}`}>
                <div
                  className="msg-tap"
                  role="button"
                  tabIndex={0}
                  aria-label={tx('Mesaj seçenekleri')}
                  aria-expanded={active}
                  onClick={() => setActiveId(active ? null : m.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveId(active ? null : m.id);
                    }
                  }}
                >
                  {m.replyToId && (
                    <button
                      type="button"
                      className={`msg-quote ${mine ? 'mine' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (quoted) jumpTo(m.replyToId);
                      }}
                      disabled={!quoted}
                    >
                      <strong>{quoted ? (quoted.senderId === myUserId ? tx('Sen') : quoted.sender?.fullName?.split(' ')[0] || otherFirstName) : ''}</strong>
                      <span>{quoteText(quoted, tx)}</span>
                    </button>
                  )}
                  {m.photoUrl && (
                    <img
                      className={`message-photo ${mine ? 'message-mine' : 'message-theirs'}`}
                      src={buildFileUrl(m.photoUrl)}
                      alt={tx("gönderilen fotoğraf")}
                    />
                  )}
                  {m.audioUrl && (
                    <VoiceMessagePlayer src={buildFileUrl(m.audioUrl)} mine={mine} />
                  )}
                  {m.fileUrl && (
                    <a
                      href={buildFileUrl(m.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className={`file-bubble ${mine ? 'message-mine' : 'message-theirs'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileIcon width={18} height={18} />
                      <span>{m.fileName || tx("Dosya")}</span>
                    </a>
                  )}
                  {m.content && (
                    <div className={`message-bubble ${mine ? 'message-mine' : 'message-theirs'}`}>
                      {m.content}
                    </div>
                  )}
                </div>

                {groups.length > 0 && (
                  <div className="msg-reactions">
                    {groups.map((g) => (
                      <button
                        key={g.emoji}
                        type="button"
                        className={`msg-reaction ${g.mine ? 'mine' : ''}`}
                        onClick={() => react(m, g.emoji)}
                        aria-pressed={g.mine}
                        aria-label={tx('{emoji} tepkisi, {n} kişi', { emoji: g.emoji, n: g.count })}
                      >
                        {g.emoji}
                        {g.count > 1 && <span>{g.count}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {active && (
                  <div className="msg-actions" role="toolbar" aria-label={tx('Mesaj seçenekleri')}>
                    <div className="msg-actions-emoji">
                      {REACTIONS.map((emoji) => (
                        <button key={emoji} type="button" onClick={() => react(m, emoji)} aria-label={tx('{emoji} ile tepki ver', { emoji })}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className="msg-actions-row">
                      <button type="button" onClick={() => startReply(m)}>
                        <CornerUpLeft size={15} aria-hidden="true" /> {tx('Yanıtla')}
                      </button>
                      {!mine && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setActiveId(null);
                            setReport({ targetType: 'message', targetId: m.id });
                          }}
                        >
                          <Flag size={15} aria-hidden="true" /> {tx('Şikayet et')}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="message-meta">
                  {mine && unsendSecondsLeft(m.createdAt, now) > 0 && (
                    <button
                      type="button"
                      className="unsend-btn"
                      onClick={() => unsendMessage(m)}
                      disabled={unsending === m.id}
                      aria-label={tx('Mesajı geri al, {n} saniye kaldı', { n: unsendSecondsLeft(m.createdAt, now) })}
                    >
                      {tx('Geri al')} · {unsendSecondsLeft(m.createdAt, now)} {tx('sn')}
                    </button>
                  )}
                  <div className="message-time">{formatTime(m.createdAt)}</div>
                </div>
              </div>
              {mine && i === lastMineIndex && m.isRead && (
                <div className="message-seen">{tx("Görüldü")}</div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        {showEmojiPicker && (
          <div className="emoji-picker-popover">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-picker-btn"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {replyTo && !recording && (
          <div className="reply-bar">
            <CornerUpLeft size={16} aria-hidden="true" />
            <div className="reply-bar-text">
              <strong>{replyTo.senderId === myUserId ? tx('Kendine yanıt veriyorsun') : tx('{name} adlı kişiye yanıt', { name: otherFirstName })}</strong>
              <span>{quoteText(replyTo, tx)}</span>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label={tx('Yanıtı iptal et')}>
              <XIcon size={16} />
            </button>
          </div>
        )}

        {recording ? (
          <div className="recording-bar">
            <span className="recording-dot" />
            <span>{tx("Kaydediliyor...")} {formatRecordTime(recordSeconds)}</span>
            <button type="button" className="recording-cancel" onClick={() => stopRecording(true)}>
              {tx("İptal")}
            </button>
            <button type="button" className="recording-send" onClick={() => stopRecording(false)}>
              <SendIcon width={16} height={16} />
            </button>
          </div>
        ) : (
          <form className="chat-input-inner" onSubmit={sendMessage}>
            <button type="button" className="chat-attach-btn" onClick={() => photoInputRef.current?.click()} aria-label={tx("Fotoğraf")}>
              <ImageIcon width={19} height={19} />
            </button>
            <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()} aria-label={tx("Dosya")}>
              <PaperclipIcon width={19} height={19} />
            </button>
            <button
              type="button"
              className="chat-attach-btn"
              onClick={() => setShowEmojiPicker((v) => !v)}
              aria-label={tx("Emoji")}
            >
              <Smile size={19} />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />

            <input ref={inputRef} value={text} onChange={handleTextChange} placeholder={tx("Mesaj yaz...")} maxLength={MESSAGE_MAX} aria-label={tx('Mesaj')} />

            {text.trim() ? (
              <button className="chat-send-btn has-text" type="submit" aria-label={tx('Gönder')}>
                <SendIcon />
              </button>
            ) : (
              <button type="button" className="chat-send-btn" onClick={startRecording} aria-label={tx("Sesli mesaj kaydet")}>
                <MicIcon width={18} height={18} />
              </button>
            )}
          </form>
        )}
      </div>

      {report && <ReportModal targetType={report.targetType} targetId={report.targetId} onClose={() => setReport(null)} />}
    </div>
  );
}
