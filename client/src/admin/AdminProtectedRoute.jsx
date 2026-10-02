import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CubeLoader from '../components/CubeLoader';
import './admin.css';

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
      <div className="adm-denied">
        <div>
          <h2>Erişim yok</h2>
          <p>Bu sayfa yalnızca yöneticilere açık.</p>
          <Link to="/discover" className="adm-btn">Uygulamaya dön</Link>
        </div>
      </div>
    );
  }

  return children;
}
