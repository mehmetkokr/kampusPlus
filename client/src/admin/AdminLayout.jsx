import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Layers,
  LogOut,
  Megaphone,
  Menu,
  PanelLeft,
  Search,
  Settings,
  ShieldCheck,
  Users,
  BarChart3,
  Server,
} from 'lucide-react';
import adminApi from './adminApi';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './ui';
import './admin.css';

// Panelin yazı tipi yalnızca panel açıldığında yüklenir
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap';
function useAdminFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

// TailAdmin düzeni: beyaz kenar çubuğu (gruplar, rozetler), üstte arama +
// tema + bildirim + kullanıcı menüsü olan çubuk. Geniş ekranda kenar çubuğu
// simgelere daraltılabilir (tercih hatırlanır); telefonda çekmeceye dönüşür.
const NAV = [
  {
    label: 'Pazarlama',
    items: [
      { to: '/admin', end: true, icon: LayoutDashboard, label: 'Genel Bakış' },
      { to: '/admin/analytics', icon: BarChart3, label: 'Analitik' },
      { to: '/admin/campaigns', icon: Megaphone, label: 'Kampanyalar' },
      { to: '/admin/campuses', icon: GraduationCap, label: 'Kampüsler' },
    ],
  },
  {
    label: 'Topluluk',
    items: [
      { to: '/admin/users', icon: Users, label: 'Kullanıcılar' },
      { to: '/admin/verification-queue', icon: ShieldCheck, label: 'Onay Kuyruğu', badge: 'pendingVerifications' },
      { to: '/admin/reports', icon: Flag, label: 'Şikayetler', badge: 'pendingReports', warn: true },
      { to: '/admin/content', icon: Layers, label: 'İçerik' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { to: '/admin/system', icon: Server, label: 'Sistem' },
      { to: '/admin/settings', icon: Settings, label: 'Ayarlar' },
    ],
  },
];

const COLLAPSE_KEY = 'kp-admin-collapsed';

function Brand() {
  return (
    <Link to="/admin" className="adm-brand" style={{ textDecoration: 'none' }} aria-label="kampüs· yönetim">
      <span className="mark" aria-hidden="true">k</span>
      <span className="txt">
        kampüs<span className="dot">·</span> <small>yönetim</small>
      </span>
    </Link>
  );
}

// Dışına tıklayınca ya da Esc ile kapanan açılır menü
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export default function AdminLayout() {
  useAdminFont();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [counts, setCounts] = useState({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [query, setQuery] = useState('');
  const bell = useDropdown();
  const account = useDropdown();

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
    bell.setOpen(false);
    account.setOpen(false);
    window.addEventListener('adm-counts', refresh);
    const timer = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('adm-counts', refresh);
      clearInterval(timer);
    };
    // açılır menüler sayfa değişince kapanır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleSidebar() {
    // Telefonda çekmece, geniş ekranda daraltma
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setMenuOpen((v) => !v);
      return;
    }
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        // depolama kapalıysa yalnızca bu oturum
      }
      return !v;
    });
  }

  function onSearch(e) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/admin/users?search=${encodeURIComponent(q)}` : '/admin/users');
  }

  const pendingVerifications = counts.pendingVerifications || 0;
  const pendingReports = counts.pendingReports || 0;
  const pendingTotal = pendingVerifications + pendingReports;

  return (
    <div className={`adm ${menuOpen ? 'menu-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
      {menuOpen && <div className="adm-scrim" onClick={() => setMenuOpen(false)} />}

      <aside className="adm-side" aria-label="Yönetim menüsü">
        <Brand />
        {NAV.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <h2 className="adm-group-label">
              <span className="txt">{group.label}</span>
            </h2>
            {group.items.map((item) => {
              const n = item.badge ? counts[item.badge] || 0 : 0;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) => `adm-nav-link ${isActive ? 'active' : ''} ${item.warn ? 'warn' : ''}`}
                >
                  <item.icon aria-hidden="true" />
                  <span className="txt">{item.label}</span>
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
          <div className="adm-side-card">
            <b>Öğrenci uygulaması</b>
            <p>Kampüs· uygulamasını öğrencilerin gördüğü gibi aç.</p>
            <Link to="/discover" className="adm-btn" style={{ width: '100%' }}>
              <ArrowLeft /> Uygulamaya dön
            </Link>
          </div>
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="adm-topbar">
          <button
            type="button"
            className="adm-icon-btn square"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
            aria-expanded={menuOpen || !collapsed}
          >
            <span className="only-mobile" aria-hidden="true">
              <Menu />
            </span>
            <span className="only-desktop" aria-hidden="true">
              <PanelLeft />
            </span>
          </button>

          <form className="adm-topsearch" role="search" onSubmit={onSearch}>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kullanıcı ara: ad ya da e-posta…"
              aria-label="Kullanıcı ara"
            />
          </form>

          <div className="adm-topbar-right">
            <ThemeToggle bare size={20} className="adm-icon-btn" />

            <div className="adm-user" ref={bell.ref}>
              <button
                type="button"
                className="adm-icon-btn"
                onClick={() => bell.setOpen((v) => !v)}
                aria-expanded={bell.open}
                aria-haspopup="menu"
                aria-label={pendingTotal ? `Bekleyen işler: ${pendingTotal}` : 'Bekleyen iş yok'}
              >
                <Bell />
                {pendingTotal > 0 && <span className="dot" aria-hidden="true" />}
              </button>
              {bell.open && (
                <div className="adm-dropdown" role="menu">
                  <div className="adm-dropdown-head">
                    <b>Bekleyen işler</b>
                    <span>{pendingTotal ? `${pendingTotal} iş kararını bekliyor` : 'Şu an bekleyen iş yok'}</span>
                  </div>
                  <Link to="/admin/verification-queue" role="menuitem">
                    <ShieldCheck /> Onay bekleyen belge <span className="count">{pendingVerifications}</span>
                  </Link>
                  <Link to="/admin/reports" role="menuitem">
                    <Flag /> Bekleyen şikayet <span className="count">{pendingReports}</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="adm-user" ref={account.ref}>
              <button
                type="button"
                className="adm-user-btn"
                onClick={() => account.setOpen((v) => !v)}
                aria-expanded={account.open}
                aria-haspopup="menu"
              >
                <Avatar user={user} />
                <span className="name">{user?.fullName?.split(' ')[0] || 'Yönetici'}</span>
                <ChevronDown aria-hidden="true" />
              </button>
              {account.open && (
                <div className="adm-dropdown" role="menu">
                  <div className="adm-dropdown-head">
                    <b>{user?.fullName || 'Yönetici'}</b>
                    <span>{user?.email}</span>
                  </div>
                  <Link to="/admin/settings" role="menuitem">
                    <Settings /> Panel ayarları
                  </Link>
                  <Link to="/discover" role="menuitem">
                    <ArrowLeft /> Uygulamaya dön
                  </Link>
                  <button
                    type="button"
                    className="item"
                    role="menuitem"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    <LogOut /> Çıkış yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
