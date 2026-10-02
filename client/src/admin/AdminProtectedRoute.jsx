import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CubeLoader from '../components/CubeLoader';

export default function AdminProtectedRoute({ children }) {
  const { token, user, loading } = useAuth();

  if (loading) {
    return <CubeLoader mode="fullscreen" />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isAdmin) {
    return (
      <div className="admin-denied">
        <h2>Erişim yok</h2>
        <p>Bu sayfayı görüntülemek için admin yetkisi gerekiyor.</p>
      </div>
    );
  }

  return children;
}
