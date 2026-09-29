import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <p className="muted center-text" style={{ marginTop: 40 }}>Yükleniyor...</p>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
