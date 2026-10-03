import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, UserPlus, Users, Bell, Trash2, BadgeCheck, FileX, CalendarPlus, Megaphone } from 'lucide-react';
import api from '../api';
import { API_BASE_URL } from '../config';
import { useToast } from '../context/ToastContext';
import { formatNotification } from '../constants/notifications';
import PageHeader from '../components/PageHeader';
import { useI18n } from '../i18n';

const TYPE_ICON = {
  announcement: Megaphone,
  follow: UserPlus,
  message: MessageCircle,
  match: Heart,
  club_join: Users,
  like: Heart,
  comment: MessageCircle,
  comment_like: Heart,
  badge_approved: BadgeCheck,
  badge_rejected: FileX,
  club_event: CalendarPlus,
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün önce`;
  return new Date(dateStr).toLocaleDateString('tr-TR');
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
      // Sayfa açıldığında hepsini okundu say (rozet sıfırlansın)
      api.put('/notifications/read-all').catch(() => {});
    } catch (err) {
      toast.error('Bildirimler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick(n) {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      api.put(`/notifications/${n.id}/read`).catch(() => {});
    }
    const { link } = formatNotification(n);
    if (!link) return;
    // Duyurularda dış bağlantı (https://) da olabilir
    if (link.startsWith('https://')) window.open(link, '_blank', 'noopener,noreferrer');
    else navigate(link);
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch {
      toast.error('Bildirim silinemedi.');
      load();
    }
  }

  return (
    <div className="container">
      <PageHeader
        compact
        tone="amber"
        icon={Bell}
        eyebrow={t("Son hareketler")}
        title={t("Bildirimler")}
        onBack={() => navigate(-1)}
      />

      {loading && <p className="muted center-text">{t("Yükleniyor...")}</p>}

      {!loading && notifications.length === 0 && (
        <div className="card center-text">
          <p className="muted">{t("Henüz hiç bildirimin yok.")}</p>
        </div>
      )}

      {!loading && notifications.length > 0 && (
        <div className="notification-list">
          {notifications.map((n) => {
            const { text, detail } = formatNotification(n, t);
            const Icon = TYPE_ICON[n.type] || Bell;
            return (
              <div
                key={n.id}
                className={`notification-row ${n.isRead ? '' : 'unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className="notification-avatar-wrap">
                  {n.actor?.photoUrl ? (
                    <img
                      className="notification-avatar"
                      src={`${API_BASE_URL}${n.actor.photoUrl}`}
                      alt={n.actor.fullName}
                    />
                  ) : (
                    <div className="notification-avatar notification-avatar-fallback">
                      <Icon size={16} />
                    </div>
                  )}
                </div>
                <div className="notification-body">
                  <div className="notification-text">{n.type === 'announcement' ? <strong>{text}</strong> : text}</div>
                  {detail && <div className="notification-detail">{detail}</div>}
                  <div className="notification-time">{t(timeAgo(n.createdAt))}</div>
                </div>
                {!n.isRead && <span className="notification-dot" />}
                <button
                  className="notification-delete-btn"
                  aria-label={t("Bildirimi sil")}
                  onClick={(e) => handleDelete(e, n.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
