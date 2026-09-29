import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass as CompassIcon,
  LayoutGrid as GridIcon,
  Users as UsersIcon,
  MessageCircle as ChatIcon,
  User as UserIcon,
  GraduationCap as GraduationCapIcon,
  EyeOff as EyeOffIcon,
  Bell as BellIcon,
  Settings as SettingsIcon,
  Crown as CrownIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export const NAV_ITEMS = [
  { to: '/discover', label: 'Keşfet', icon: CompassIcon },
  { to: '/feed', label: 'Akış', icon: GridIcon },
  { to: '/clubs', label: 'Kulüpler', icon: UsersIcon },
  { to: '/classmates', label: 'Sınıfım', icon: GraduationCapIcon },
  { to: '/confessions', label: 'İtiraf', icon: EyeOffIcon },
  { to: '/matches', label: 'Sohbet', icon: ChatIcon },
  { to: '/profile', label: 'Profil', icon: UserIcon },
];

const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 };

// Uygulama genelinde tek bir kez (App.jsx içinde) render edilir; sayfalar
// arası geçişte yok olup yeniden oluşmadığı için aktif gösterge kayarak geçer.
// Masaüstünde sol cam kenar çubuğu, mobilde alt yüzen cam dock olarak görünür.
export default function NavBar() {
  return (
    <>
      <SideNav />
      <MobileDock />
    </>
  );
}

function SideNav() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0];

  return (
    <aside className="side-nav" aria-label="Ana menü">
      <Link to="/discover" className="side-nav-brand">
        <span className="side-nav-logo">k</span>
        <span className="side-nav-wordmark">
          kampüs<span className="dot">·</span>
        </span>
        <span className="side-nav-plus">plus</span>
      </Link>

      <div className="side-nav-label">Menü</div>
      <nav className="side-nav-list">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `side-nav-item ${isActive ? 'active' : ''}`}>
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="side-nav-pill" className="side-nav-pill" transition={SPRING} />}
                <span className="side-nav-icon">
                  <Icon size={18} strokeWidth={isActive ? 2.3 : 1.9} />
                </span>
                <span className="side-nav-text">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="side-nav-label">Hesap</div>
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
                <span className="side-nav-text">{label}</span>
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
            <strong>Premium'a geç</strong>
            <small>Tüm kampüslerle tanış</small>
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
            <small>{user.university?.name || 'Kampüs'}</small>
          </span>
        </Link>
      )}
    </aside>
  );
}

function MobileDock() {
  return (
    <nav className="dock" aria-label="Ana menü">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `dock-item ${isActive ? 'active' : ''}`} aria-label={label}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="dock-pill" className="dock-pill" transition={SPRING} />}
              <Icon className="dock-icon" size={19} strokeWidth={isActive ? 2.3 : 1.9} />
              <span className="dock-label">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
