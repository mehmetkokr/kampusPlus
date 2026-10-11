import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../lib/socket';
import { useI18n } from '../i18n';

// Ayarlar ikonunun yanında/pencerenin üstünde tekrar kullanılan küçük bildirim
// zili: okunmamış sayısını rozet olarak gösterir, tıklanınca Bildirim Merkezi'ne
// götürür. Paylaşılan gerçek zamanlı bağlantıyı dinler, ayrıca yedek olarak
// periyodik yoklama yapar.
export default function NotificationBell() {
  const { t } = useI18n();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const socket = useSocket();

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
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!socket) return undefined;
    const bump = () => setUnreadCount((c) => c + 1);
    socket.on('new_notification', bump);
    return () => socket.off('new_notification', bump);
  }, [socket]);

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
