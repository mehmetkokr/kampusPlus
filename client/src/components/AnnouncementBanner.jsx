import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Megaphone, X } from 'lucide-react';
import api from '../api';
import { useI18n } from '../i18n';

// Yönetim panelinden "duyuru bandı" kanalıyla gönderilen kampanya.
// Öğrenci kapatınca bir daha gösterilmez (kapatılanlar tarayıcıda tutulur).
const KEY = 'kp-dismissed-banners';

function dismissedIds() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export default function AnnouncementBanner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [banner, setBanner] = useState(null);

  // Sayfa değiştikçe tazelenir; böylece yeni duyuru yenileme gerektirmeden görünür
  useEffect(() => {
    let alive = true;
    api
      .get('/announcements/active')
      .then((res) => {
        if (!alive) return;
        const b = res.data;
        setBanner(b && !dismissedIds().includes(b.id) ? b : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  if (!banner || pathname.startsWith('/chat/')) return null;

  function dismiss(e) {
    e?.stopPropagation();
    try {
      localStorage.setItem(KEY, JSON.stringify([...dismissedIds(), banner.id].slice(-50)));
    } catch {
      // depolama kapalıysa yalnızca bu oturumda gizlenir
    }
    setBanner(null);
  }

  function open() {
    if (!banner.link) return;
    if (banner.link.startsWith('https://')) window.open(banner.link, '_blank', 'noopener,noreferrer');
    else navigate(banner.link);
    dismiss();
  }

  const Tag = banner.link ? 'button' : 'div';
  return (
    <aside className="announcement-banner" role="status" aria-live="polite">
      <Tag type={banner.link ? 'button' : undefined} className="announcement-main" onClick={banner.link ? open : undefined}>
        <span className="announcement-icon" aria-hidden="true">
          <Megaphone size={17} />
        </span>
        <span className="announcement-text">
          <b>{banner.title}</b>
          <span>{banner.body}</span>
        </span>
        {banner.link && <ChevronRight size={18} className="announcement-chev" aria-hidden="true" />}
      </Tag>
      <button type="button" className="announcement-close" onClick={dismiss} aria-label={t('Duyuruyu kapat')}>
        <X size={16} />
      </button>
    </aside>
  );
}
