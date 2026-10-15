import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass as CompassIcon,
  LayoutGrid as GridIcon,
  Users as UsersIcon,
  MessageCircle as ChatIcon,
  User as UserIcon,
  Bell as BellIcon,
  Settings as SettingsIcon,
  Layers as LayersIcon,
  Crown as CrownIcon,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { useI18n } from '../i18n';
import ThemeToggle from './ThemeToggle';
import { useChatUnread } from '../hooks/useChatUnread';
import BrandMark from './BrandMark';

// Kart Modu'nu kapatan kullanıcı menüde onu görmez
export function navItemsFor(user) {
  return user?.swipeEnabled === false ? NAV_ITEMS.filter((i) => i.to !== '/discover/swipe') : NAV_ITEMS;
}

export const NAV_ITEMS = [
  { to: '/discover', label: 'Keşfet', icon: CompassIcon, end: true },
  { to: '/discover/swipe', label: 'Kart Modu', icon: LayersIcon },
  { to: '/feed', label: 'Akış', icon: GridIcon },
  { to: '/clubs', label: 'Kulüpler', icon: UsersIcon },
  { to: '/matches', label: 'Sohbet', icon: ChatIcon },
  { to: '/profile', label: 'Profil', icon: UserIcon },
];

const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 };

// Uygulama genelinde tek bir kez (App.jsx içinde) render edilir; sayfalar
// arası geçişte yok olup yeniden oluşmadığı için aktif gösterge kayarak geçer.
// Masaüstünde sol cam kenar çubuğu, mobilde alt yüzen cam dock olarak görünür.
export default function NavBar() {
  // Okunmamış mesajı olan sohbet sayısı: "Sohbet" sekmesinde rozet
  const chatUnread = useChatUnread();
  return (
    <>
      <SideNav chatUnread={chatUnread} />
      <MobileDock chatUnread={chatUnread} />
    </>
  );
}

function UnreadBadge({ to, count, className }) {
  if (to !== '/matches' || !count) return null;
  return (
    <span className={className} aria-hidden="true">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SideNav({ chatUnread }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0];

  return (
    <aside className="side-nav" aria-label={t("Ana menü")}>
      <Link to="/discover" className="side-nav-brand">
        <BrandMark className="side-nav-logo" size={36} />
        <span className="side-nav-wordmark">
          {t("kampüs")}<span className="dot">·</span>
        </span>
        <span className="side-nav-plus">{t("plus")}</span>
      </Link>

      <div className="side-nav-label">{t("Menü")}</div>
      <nav className="side-nav-list">
        {navItemsFor(user).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-nav-pill" className="side-nav-pill" transition={SPRING} />}
                <span className="side-nav-icon">
                  <Icon size={18} strokeWidth={isActive ? 2.3 : 1.9} />
                </span>
                <span className="side-nav-text">{t(label)}</span>
                <UnreadBadge to={to} count={chatUnread} className="nav-unread side" />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="side-nav-label side-nav-label-row">
        {t("Hesap")}
        <ThemeToggle className="side-nav-theme" />
      </div>
      <nav className="side-nav-list">
        {[
          { to: '/notifications', label: 'Bildirimler', icon: BellIcon },
          { to: '/settings', label: 'Ayarlar', icon: SettingsIcon },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-nav-pill" className="side-nav-pill" transition={SPRING} />}
                <span className="side-nav-icon">
                  <Icon size={18} strokeWidth={isActive ? 2.3 : 1.9} />
                </span>
                <span className="side-nav-text">{t(label)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="side-nav-spacer" />

      {user && !user.isPremium && (
        <Link to="/settings" className="side-nav-upsell">
          <span className="side-nav-upsell-icon">
            <CrownIcon size={16} />
          </span>
          <span>
            <strong>{t("Premium'a geç")}</strong>
            <small>{t("Tüm kampüslerle tanış")}</small>
          </span>
        </Link>
      )}

      {user && (
        <Link to="/profile" className="side-nav-user">
          <span className="side-nav-avatar-ring">
            {user.photoUrl ? (
              <img src={`${API_BASE_URL}${user.photoUrl}`} alt={user.fullName} />
            ) : (
              <span className="side-nav-avatar-fallback">{firstName?.[0] || '?'}</span>
            )}
          </span>
          <span className="side-nav-user-text">
            <strong>
              {user.fullName}
              {user.isPremium && <CrownIcon size={13} className="side-nav-crown" />}
            </strong>
            <small>{user.university?.name || t("Kampüs")}</small>
          </span>
        </Link>
      )}
    </aside>
  );
}

function MobileDock({ chatUnread }) {
  const { user } = useAuth();
  const { t } = useI18n();
  return (
    <nav className="dock" aria-label={t("Ana menü")}>
      {navItemsFor(user).map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`}
          aria-label={to === '/matches' && chatUnread ? t('{label}, {n} okunmamış sohbet', { label: t(label), n: chatUnread }) : t(label)}
        >
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="dock-pill" className="dock-pill" transition={SPRING} />}
              <Icon className="dock-icon" size={19} strokeWidth={isActive ? 2.3 : 1.9} />
              <UnreadBadge to={to} count={chatUnread} className="nav-unread dock" />
              <span className="dock-label">{t(label)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
