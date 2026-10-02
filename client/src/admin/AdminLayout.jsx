import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import adminApi from './adminApi';
import ThemeToggle from '../components/ThemeToggle';
import './admin.css';

// Kenar çubuğu grupları: pazarlama işleri en üstte, topluluk yönetimi altta
const NAV = [
  {
    label: 'Pazarlama',
    items: [
      { to: '/admin', end: true, icon: LayoutDashboard, label: 'Genel Bakış' },
      { to: '/admin/campaigns', icon: Megaphone, label: 'Kampanyalar' },
      { to: '/admin/campuses', icon: GraduationCap, label: 'Kampüsler' },
    ],
  },
  {
    label: 'Topluluk',
    items: [
      { to: '/admin/users', icon: Users, label: 'Kullanıcılar' },
      { to: '/admin/verification-queue', icon: ShieldCheck, label: 'Onay Kuyruğu', badge: 'pendingVerifications' },
      { to: '/admin/reports', icon: Flag, label: 'Şikayetler', badge: 'pendingReports' },
      { to: '/admin/content', icon: Layers, label: 'İçerik' },
    ],
  },
  {
    label: 'Sistem',
    items: [{ to: '/admin/settings', icon: Settings, label: 'Ayarlar' }],
  },
];

function Brand() {
  return (
    <div className="adm-brand">
      kampüs<span className="dot">·</span> <small>yönetim</small>
    </div>
  );
}

export default function AdminLayout() {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);

  // Bekleyen işler: sayfa değişiminde, bir karar verildiğinde (adm-counts olayı)
  // ve dakikada bir tazelenir
  useEffect(() => {
    const refresh = () =>
      adminApi
        .getStats()
        .then((res) => setCounts(res.data))
        .catch(() => {});
    refresh();
    setMenuOpen(false);
    window.addEventListener('adm-counts', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('adm-counts', refresh);
      clearInterval(timer);
    };
  }, [pathname]);

  return (
    <div className={`adm ${menuOpen ? 'menu-open' : ''}`}>
      {menuOpen && <div className="adm-scrim" onClick={() => setMenuOpen(false)} />}

      <aside className="adm-side" aria-label="Yönetim menüsü">
        <Brand />
        {NAV.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <div className="adm-group-label">{group.label}</div>
            {group.items.map((item) => {
              const n = item.badge ? counts[item.badge] || 0 : 0;
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `adm-nav-link ${isActive ? 'active' : ''}`}>
                  <item.icon aria-hidden="true" /> {item.label}
                  {n > 0 && (
                    <span className="adm-nav-badge" aria-label={`${n} bekleyen`}>
                      {n}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        ))}
        <div className="adm-side-foot">
          <NavLink to="/discover" className="adm-nav-link">
            <ArrowLeft aria-hidden="true" /> Uygulamaya dön
          </NavLink>
          <ThemeToggle />
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <div className="adm-mobilebar">
          <button type="button" className="adm-btn ghost icon" onClick={() => setMenuOpen(true)} aria-label="Menüyü aç">
            <Menu />
          </button>
          <Brand />
          <span style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
          </span>
        </div>
        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
