import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Bell } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';

// Ayarlar ikonunun yanında/pencerenin üstünde tekrar kullanılan küçük bildirim
// zili: okunmamış sayısını rozet olarak gösterir, tıklanınca Bildirim Merkezi'ne
// götürür. Gerçek zamanlı güncelleme için kendi soket bağlantısını açar, ayrıca
// yedek olarak periyodik yoklama yapar.
export default function NotificationBell() {
  const { t } = useI18n();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  async function loadUnreadCount() {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.count);
    } catch {
      // sessizce geç - bildirim rozeti kritik değil
    }
  }

  useEffect(() => {
    if (!token) return;
    loadUnreadCount();

    const interval = setInterval(loadUnreadCount, 30000);

    const socket = io(API_BASE_URL || undefined, { auth: { token } });
    socketRef.current = socket;
    socket.on('new_notification', () => {
      setUnreadCount((c) => c + 1);
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, [token]);

  return (
    <button
      className="icon-btn-amber notification-bell-btn"
      aria-label={t("Bildirimler")}
      onClick={() => navigate('/notifications')}
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}
    </button>
  );
}
