import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Zaten giriş yapmış kullanıcıyı landing/login/register sayfalarından
// doğrudan uygulamaya yönlendirir.
export default function PublicRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return null;
  if (token) return <Navigate to="/discover" replace />;

  return children;
}
