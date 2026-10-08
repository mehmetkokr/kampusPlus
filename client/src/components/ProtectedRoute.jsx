import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { needsBasics, useAuth } from '../context/AuthContext';
import CubeLoader from './CubeLoader';

export default function ProtectedRoute({ children }) {
  const { token, user, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return <CubeLoader mode="fullscreen" />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Temel bilgileri eksik yeni hesap önce başlangıç adımını tamamlar
  if (needsBasics(user) && pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return children;
}
