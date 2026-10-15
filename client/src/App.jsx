import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import AppBackdrop from './components/AppBackdrop';
import AnnouncementBanner from './components/AnnouncementBanner';
import ReverifyBanner, { needsReverify } from './components/ReverifyBanner';
import { useAuth } from './context/AuthContext';
import LogoLoader from './components/LogoLoader';
import PageMeta from './components/PageMeta';
import ErrorBoundary from './components/ErrorBoundary';
import { track } from './lib/telemetry';

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
// Menü (ve onunla gelen gerçek zamanlı bağlantı) yalnızca giriş yapınca yüklenir;
// tanıtım sayfasına gelen ziyaretçi bunları indirmez
const NavBar = lazy(() => import('./components/NavBar'));
// Yönetim paneli (ve stil dosyası, yazı tipi) yalnızca /admin açılınca yüklenir
const AdminProtectedRoute = lazy(() => import('./admin/AdminProtectedRoute'));
const AdminLayout = lazy(() => import('./admin/AdminLayout'));
const AdminOverview = lazy(() => import('./admin/pages/AdminOverview'));
const AdminCampaigns = lazy(() => import('./admin/pages/AdminCampaigns'));
const AdminCampuses = lazy(() => import('./admin/pages/AdminCampuses'));
const AdminContent = lazy(() => import('./admin/pages/AdminContent'));
const AdminUsers = lazy(() => import('./admin/pages/AdminUsers'));
const AdminVerificationQueue = lazy(() => import('./admin/pages/AdminVerificationQueue'));
const AdminReports = lazy(() => import('./admin/pages/AdminReports'));
const AdminSettings = lazy(() => import('./admin/pages/AdminSettings'));
const AdminAnalytics = lazy(() => import('./admin/pages/AdminAnalytics'));
const AdminSystem = lazy(() => import('./admin/pages/AdminSystem'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

// Kalıcı gezinme çubuğunun görüneceği sayfalar (sohbet ekranları tam ekran kalır)
const NAV_PATHS = ['/discover', '/discover/swipe', '/feed', '/clubs', '/matches', '/profile', '/notifications', '/settings'];
const NAV_PREFIXES = ['/discover/', '/users/'];

export default function App() {
  const { token, user } = useAuth();
  const { pathname } = useLocation();
  const isAppRoute = Boolean(token) && !pathname.startsWith('/admin') && pathname !== '/reset-password';
  const showNav =
    isAppRoute &&
    (NAV_PATHS.includes(pathname) || NAV_PREFIXES.some((prefix) => pathname.startsWith(prefix)));

  // Sayfa görüntüleme (yönetim paneli sayılmaz)
  useEffect(() => {
    if (!pathname.startsWith('/admin')) track('page_view');
  }, [pathname]);

  return (
    <>
    {isAppRoute && <AppBackdrop />}
    {isAppRoute && (needsReverify(user) ? <ReverifyBanner /> : <AnnouncementBanner />)}
    <PageMeta />
    <ErrorBoundary resetKey={pathname}>
    <Suspense fallback={<LogoLoader mode="fullscreen" />}>
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
        <Route index element={<AdminOverview />} />
        <Route path="campaigns" element={<AdminCampaigns />} />
        <Route path="campuses" element={<AdminCampuses />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="verification-queue" element={<AdminVerificationQueue />} />
        <Route path="content" element={<AdminContent />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="system" element={<AdminSystem />} />
        {/* Eski adresler yeni bölümlere yönlenir */}
        <Route path="universities" element={<Navigate to="/admin/campuses" replace />} />
        <Route path="departments" element={<Navigate to="/admin/campuses" replace />} />
        <Route path="posts" element={<Navigate to="/admin/content" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route path="/gizlilik" element={<LegalPage doc="gizlilik" />} />
      <Route path="/kullanim-sartlari" element={<LegalPage doc="kullanim-sartlari" />} />
      <Route path="/topluluk-kurallari" element={<LegalPage doc="topluluk-kurallari" />} />
      <Route path="/mesafeli-satis-sozlesmesi" element={<LegalPage doc="mesafeli-satis-sozlesmesi" />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
    {showNav && (
      <Suspense fallback={null}>
        <NavBar />
      </Suspense>
    )}
    </>
  );
}
