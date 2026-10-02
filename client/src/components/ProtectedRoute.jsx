import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CubeLoader from './CubeLoader';

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return <CubeLoader mode="fullscreen" />;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
