import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CubeLoader from './CubeLoader';

// Zaten giriş yapmış kullanıcıyı landing/login/register sayfalarından
// doğrudan uygulamaya yönlendirir.
export default function PublicRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return <CubeLoader mode="fullscreen" />;
  if (token) return <Navigate to="/discover" replace />;

  return children;
}
