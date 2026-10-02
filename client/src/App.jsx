import React, { Suspense, lazy } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import NavBar, { NAV_ITEMS } from './components/NavBar';
import AppBackdrop from './components/AppBackdrop';
import { useAuth } from './context/AuthContext';
import AdminProtectedRoute from './admin/AdminProtectedRoute';
import CubeLoader from './components/CubeLoader';
import PageMeta from './components/PageMeta';

// Sayfalar ayrı parçalar halinde, ihtiyaç olunca yüklenir (ilk açılış hızlanır;
// tanıtım sayfasına gelen ziyaretçi uygulama ve yönetim ekranlarını indirmez).
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const SwipeDiscoverPage = lazy(() => import('./pages/SwipeDiscoverPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const ClubDetailPage = lazy(() => import('./pages/ClubDetailPage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const UserProfileViewPage = lazy(() => import('./pages/UserProfileViewPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./admin/pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./admin/pages/AdminUsers'));
const AdminVerificationQueue = lazy(() => import('./admin/pages/AdminVerificationQueue'));
const AdminUniversities = lazy(() => import('./admin/pages/AdminUniversities'));
const AdminDepartments = lazy(() => import('./admin/pages/AdminDepartments'));
const AdminPosts = lazy(() => import('./admin/pages/AdminPosts'));
const AdminReports = lazy(() => import('./admin/pages/AdminReports'));
const AdminSettings = lazy(() => import('./admin/pages/AdminSettings'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

// Kalıcı gezinme çubuğunun görüneceği sayfalar (sohbet ekranları tam ekran kalır)
const NAV_PATHS = [...NAV_ITEMS.map((i) => i.to), '/notifications', '/settings'];
const NAV_PREFIXES = ['/discover/', '/users/'];

export default function App() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const isAppRoute = Boolean(token) && !pathname.startsWith('/admin') && pathname !== '/reset-password';
  const showNav =
    isAppRoute &&
    (NAV_PATHS.includes(pathname) || NAV_PREFIXES.some((prefix) => pathname.startsWith(prefix)));

  return (
    <>
    {isAppRoute && <AppBackdrop />}
    <PageMeta />
    <Suspense fallback={<CubeLoader mode="fullscreen" />}>
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPasswordPage />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <WelcomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/discover"
        element={
          <ProtectedRoute>
            <DiscoverPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/discover/swipe"
        element={
          <ProtectedRoute>
            <SwipeDiscoverPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clubs"
        element={
          <ProtectedRoute>
            <ClubsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clubs/:clubId"
        element={
          <ProtectedRoute>
            <ClubDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <MatchesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:matchId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:userId"
        element={
          <ProtectedRoute>
            <UserProfileViewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="verification-queue" element={<AdminVerificationQueue />} />
        <Route path="universities" element={<AdminUniversities />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="/gizlilik" element={<LegalPage doc="gizlilik" />} />
      <Route path="/kullanim-sartlari" element={<LegalPage doc="kullanim-sartlari" />} />
      <Route path="/topluluk-kurallari" element={<LegalPage doc="topluluk-kurallari" />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    {showNav && <NavBar />}
    </>
  );
}
