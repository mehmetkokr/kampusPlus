import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  FileText,
  Flag,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import adminApi from './adminApi';
import './admin.css';

export default function AdminLayout() {
  const [pendingReports, setPendingReports] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);

  useEffect(() => {
    adminApi
      .getStats()
      .then((res) => {
        setPendingReports(res.data.pendingReports || 0);
        setPendingVerifications(res.data.pendingVerifications || 0);
      })
      .catch((err) => console.error('Admin istatistikleri alınamadı:', err));
  }, []);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          kampüs<span>· admin</span>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>
            <LayoutDashboard /> Dashboard
          </NavLink>
          <NavLink to="/admin/users" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Users /> Kullanıcılar
          </NavLink>
          <NavLink to="/admin/verification-queue" className={({ isActive }) => (isActive ? 'active' : '')}>
            <ShieldCheck /> Onay/Red Kuyruğu
            {pendingVerifications > 0 && <span className="admin-nav-badge">{pendingVerifications}</span>}
          </NavLink>
          <NavLink to="/admin/universities" className={({ isActive }) => (isActive ? 'active' : '')}>
            <GraduationCap /> Üniversiteler
          </NavLink>
          <NavLink to="/admin/departments" className={({ isActive }) => (isActive ? 'active' : '')}>
            <BookOpen /> Bölümler
          </NavLink>
          <NavLink to="/admin/posts" className={({ isActive }) => (isActive ? 'active' : '')}>
            <FileText /> İlanlar
          </NavLink>
          <NavLink to="/admin/reports" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Flag /> Şikayetler
            {pendingReports > 0 && <span className="admin-nav-badge">{pendingReports}</span>}
          </NavLink>
          <NavLink to="/admin/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            <Settings /> Ayarlar
          </NavLink>
        </nav>
        <div className="admin-back-link">
          <NavLink to="/discover">
            <ArrowLeft /> Uygulamaya dön
          </NavLink>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
