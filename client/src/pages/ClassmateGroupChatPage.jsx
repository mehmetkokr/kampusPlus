import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { buildFileUrl } from '../api';
import { API_BASE_URL } from '../config';
import { ArrowLeft as ArrowLeftIcon, Send as SendIcon, Image as ImageIcon, Users as UsersIcon } from 'lucide-react';

export default function ClassmateGroupChatPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const skipAutoScrollRef = useRef(false);
  const photoInputRef = useRef(null);

  useEffect(() => {
    api.get(`/classmates/groups/${groupId}`).then((res) => setGroup(res.data)).catch(() => navigate('/classmates'));
    api
      .get(`/classmates/groups/${groupId}/messages`)
      .then((res) => {
        setMessages(res.data.messages);
        setHasMoreMessages(res.data.hasMore);
      })
      .catch((err) => console.error('Mesajlar alınamadı:', err));
    api.get('/profile/me').then((res) => setMyUserId(res.data.id)).catch((err) => console.error('Profil alınamadı:', err));

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const socket = io(API_BASE_URL, { auth: { token } });
    socketRef.current = socket;

    socket.emit('join_classmate_group', groupId);
    socket.on('new_classmate_message', (msg) => {
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
      const res = await api.get(`/classmates/groups/${groupId}/messages`, { params: { before: oldestId } });
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
    if (!text.trim() || group?.isArchived) return;
    socketRef.current.emit('send_classmate_message', { groupId, content: text });
    setText('');
  }

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post(`/classmates/groups/${groupId}/messages/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      alert(err.response?.data?.error || 'Fotoğraf gönderilemedi.');
    } finally {
      e.target.value = '';
    }
  }

  function formatTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  if (!group) return null;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-back" onClick={() => navigate('/classmates')}>
          <ArrowLeftIcon />
        </div>
        <div className="club-header-icon">
          <UsersIcon width={18} height={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="chat-header-name">{group.name}</div>
          <div className="chat-header-status">
            {group.memberCount} üye{group.isArchived ? ' · Geçmiş dönem (salt-okunur)' : ''}
          </div>
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
            {messages.length === 0 && <p className="chat-empty">Henüz mesaj yok. Sınıf arkadaşlarına ilk mesajı sen at 👋</p>}
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
            {group.isArchived ? (
              <p className="muted center-text" style={{ padding: '10px 0' }}>
                Bu dönem sona erdi, bu grup artık salt-okunur.
              </p>
            ) : (
              <form className="chat-input-inner" onSubmit={sendMessage}>
                <button type="button" className="chat-attach-btn" onClick={() => photoInputRef.current?.click()}>
                  <ImageIcon width={19} height={19} />
                </button>
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Gruba mesaj yaz..." />
                <button className="chat-send-btn has-text" type="submit" disabled={!text.trim()}>
                  <SendIcon />
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
