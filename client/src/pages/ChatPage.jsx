import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Smile } from 'lucide-react';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Mic as MicIcon, Paperclip as PaperclipIcon, File as FileIcon } from 'lucide-react';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';
import { useI18n } from '../i18n';
import { compressImage } from '../utils/image';

const EMOJI_LIST = [
  '😀', '😂', '🥰', '😍', '😘', '😎', '🤔', '😅', '😢', '😭',
  '😡', '😴', '🥳', '😇', '🙃', '😉', '😊', '🤗', '🤩', '😜',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '✌️', '🤝', '👋', '🫶',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💯', '🔥',
  '🎉', '✨', '⭐', '🎓', '📚', '☕', '🍕', '⚽', '🎵', '📸',
];

export default function ChatPage() {
  const { t: tx } = useI18n();
  const { matchId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

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

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
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

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = io(API_BASE_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('join_match', matchId);
    socket.emit('mark_read', { matchId });

    socket.on('new_message', (msg) => {
      if (msg.matchId === Number(matchId)) {
        setMessages((prev) => [...prev, msg]);
        if (msg.senderId !== myUserIdRef.current) {
          socket.emit('mark_read', { matchId });
        }
      }
    });

    socket.on('messages_read', ({ matchId: readMatchId }) => {
      if (String(readMatchId) === String(matchId)) {
        setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      }
    });

    socket.on('typing', ({ matchId: typingMatchId, userId, isTyping }) => {
      if (String(typingMatchId) === String(matchId) && userId === otherUserIdRef.current) {
        setIsOtherTyping(isTyping);
      }
    });

    socket.on('presence_state', ({ userId, online, lastSeenAt }) => {
      if (userId === otherUserIdRef.current) {
        setPresence({ online, lastSeenAt });
      }
    });

    socket.on('presence_update', ({ userId, online, lastSeenAt }) => {
      if (userId === otherUserIdRef.current) {
        setPresence({ online, lastSeenAt: lastSeenAt ?? null });
      }
    });

    socket.on('connect_error', () => {
      navigate('/login');
    });

    return () => {
      socket.disconnect();
    };
    // navigate referansı react-router tarafından sabit tutulur, dep listesine eklemeye gerek yok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    socketRef.current?.emit('typing', { matchId, isTyping: true });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { matchId, isTyping: false });
    }, 1500);
  }

  function insertEmoji(emoji) {
    setText((prev) => prev + emoji);
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    socketRef.current.emit('send_message', { matchId, content: text });
    setText('');
    setShowEmojiPicker(false);
    clearTimeout(typingTimeoutRef.current);
    socketRef.current?.emit('typing', { matchId, isTyping: false });
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
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

  const lastMineIndex = [...messages].map((m) => m.senderId === myUserId).lastIndexOf(true);

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate('/matches')}>
          <ArrowLeftIcon />
        </div>
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
      </div>

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
              {loadingOlder ? tx("Yükleniyor...") : tx("Daha eski mesajları yükle")}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="chat-empty">{tx("Henüz mesaj yok. İlk mesajı sen gönder.")}</p>
        )}

        {messages.map((m, i) => {
          const mine = m.senderId === myUserId;
          return (
            <React.Fragment key={m.id}>
              <div className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
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
                <div className="message-time">{formatTime(m.createdAt)}</div>
              </div>
              {mine && i === lastMineIndex && m.isRead && (
                <div className="message-seen">{tx("Görüldü")}</div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar" style={{ position: 'relative' }}>
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

            <input value={text} onChange={handleTextChange} placeholder={tx("Mesaj yaz...")} />

            {text.trim() ? (
              <button className="chat-send-btn has-text" type="submit">
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
    </div>
  );
}
