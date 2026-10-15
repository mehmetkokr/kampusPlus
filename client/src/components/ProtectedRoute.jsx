import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { needsBasics, useAuth } from '../context/AuthContext';
import LogoLoader from './LogoLoader';
import ConsentGate from './ConsentGate';

export default function ProtectedRoute({ children }) {
  const { token, user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <LogoLoader mode="fullscreen" />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Temel bilgileri eksik yeni hesap önce başlangıç adımını tamamlar
  if (needsBasics(user) && pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  // Güncellenen şartlar ve KVKK onayı alınana kadar onay penceresi üstte durur
  return (
    <>
      {children}
      <ConsentGate />
    </>
  );
}
