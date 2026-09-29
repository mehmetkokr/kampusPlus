import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Mic as MicIcon, Paperclip as PaperclipIcon, File as FileIcon, Users as UsersIcon } from 'lucide-react';
import VoiceMessagePlayer from '../components/VoiceMessagePlayer';

export default function GroupChatPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const skipAutoScrollRef = useRef(false);
  const photoInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    api.get(`/groups/${groupId}`).then((res) => setGroup(res.data)).catch((err) => console.error('Grup alınamadı:', err));
    api.get(`/groups/${groupId}/messages`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMoreMessages(res.data.hasMore);
      })
      .catch((err) => console.error('Grup mesajları alınamadı:', err));
    api.get('/profile/me').then((res) => setMyUserId(res.data.id)).catch((err) => console.error('Profil alınamadı:', err));

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = io(API_BASE_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('join_group', groupId);
    socket.on('new_group_message', (msg) => {
      if (msg.groupId === Number(groupId)) setMessages((prev) => [...prev, msg]);
    });

    return () => socket.disconnect();
  }, [groupId]);

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
      const res = await api.get(`/groups/${groupId}/messages`, { params: { before: oldestId } });
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
    socketRef.current.emit('send_group_message', { groupId, content: text });
    setText('');
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post(`/groups/${groupId}/messages/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Fotoğraf gönderilemedi.');
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
      await api.post(`/groups/${groupId}/messages/file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Dosya gönderilemedi.');
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
          await api.post(`/groups/${groupId}/messages/audio`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (err) {
          alert('Sesli mesaj gönderilemedi.');
        }
      };

      mediaRecorderRef.current = recorder;
      cancelledRef.current = false;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch (err) {
      alert('Mikrofona erişilemedi. Tarayıcı izinlerini kontrol et.');
    }
  }

  function stopRecording(cancel) {
    clearInterval(recordTimerRef.current);
    setRecording(false);
    cancelledRef.current = !!cancel;
    mediaRecorderRef.current?.stop();
  }

  async function handleLeave() {
    if (!window.confirm('Bu gruptan ayrılmak istediğine emin misin?')) return;
    try {
      await api.post(`/groups/${groupId}/leave`);
      navigate('/matches');
    } catch (err) {
      alert('Ayrılınamadı.');
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatRecordTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (!group) return null;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate('/matches')}>
          <ArrowLeftIcon />
        </div>
        <div className="club-header-icon">
          <UsersIcon width={18} height={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-name">{group.name}</div>
          <div className="chat-header-status">{group.members.length} üye</div>
        </div>
        <button className="club-tab-toggle" onClick={() => setShowMembers((v) => !v)}>
          <UsersIcon width={18} height={18} />
        </button>
      </div>

      {showMembers && (
        <div className="container" style={{ paddingTop: 0, paddingBottom: 12 }}>
          {group.members.map((m) => (
            <div key={m.id} className="member-row">
              <img
                className="member-avatar"
                src={m.photoUrl ? buildFileUrl(m.photoUrl) : undefined}
                alt={m.fullName}
              />
              <div className="member-info">
                <div className="member-name">{m.fullName}</div>
              </div>
            </div>
          ))}
          <button className="btn btn-pass" style={{ marginTop: 14 }} onClick={handleLeave}>
            Gruptan Ayrıl
          </button>
        </div>
      )}

      {!showMembers && (
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
            {messages.length === 0 && <p className="chat-empty">Henüz mesaj yok. İlk mesajı sen at 👋</p>}
            {messages.map((m) => {
              const mine = m.senderId === myUserId;
              return (
                <div key={m.id} className={`msg-row ${mine ? 'mine' : 'theirs'}`}>
                  {!mine && <div className="msg-sender-name">{m.sender?.fullName}</div>}
                  {m.photoUrl && (
                    <img
                      className={`message-photo ${mine ? 'message-mine' : 'message-theirs'}`}
                      src={buildFileUrl(m.photoUrl)}
                      alt="gönderilen fotoğraf"
                    />
                  )}
                  {m.audioUrl && <VoiceMessagePlayer src={buildFileUrl(m.audioUrl)} mine={mine} />}
                  {m.fileUrl && (
                    <a
                      href={buildFileUrl(m.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className={`file-bubble ${mine ? 'message-mine' : 'message-theirs'}`}
                    >
                      <FileIcon width={18} height={18} />
                      <span>{m.fileName || 'Dosya'}</span>
                    </a>
                  )}
                  {m.content && (
                    <div className={`message-bubble ${mine ? 'message-mine' : 'message-theirs'}`}>{m.content}</div>
                  )}
                  <div className="message-time">{formatTime(m.createdAt)}</div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-bar">
            {recording ? (
              <div className="recording-bar">
                <span className="recording-dot" />
                <span>Kaydediliyor... {formatRecordTime(recordSeconds)}</span>
                <button type="button" className="recording-cancel" onClick={() => stopRecording(true)}>
                  İptal
                </button>
                <button type="button" className="recording-send" onClick={() => stopRecording(false)}>
                  <SendIcon width={16} height={16} />
                </button>
              </div>
            ) : (
              <form className="chat-input-inner" onSubmit={sendMessage}>
                <button type="button" className="chat-attach-btn" onClick={() => photoInputRef.current?.click()}>
                  <ImageIcon width={19} height={19} />
                </button>
                <button type="button" className="chat-attach-btn" onClick={() => fileInputRef.current?.click()}>
                  <PaperclipIcon width={19} height={19} />
                </button>
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileSelect} />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Gruba mesaj yaz..." />
                {text.trim() ? (
                  <button className="chat-send-btn has-text" type="submit">
                    <SendIcon />
                  </button>
                ) : (
                  <button type="button" className="chat-send-btn" onClick={startRecording}>
                    <MicIcon width={18} height={18} />
                  </button>
                )}
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
