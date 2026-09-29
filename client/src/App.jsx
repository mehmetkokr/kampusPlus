import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RegisterPage from './pages/RegisterPage';
import DiscoverPage from './pages/DiscoverPage';
import SwipeDiscoverPage from './pages/SwipeDiscoverPage';
import FeedPage from './pages/FeedPage';
import ClubsPage from './pages/ClubsPage';
import ClubDetailPage from './pages/ClubDetailPage';
import MatchesPage from './pages/MatchesPage';
import GroupChatPage from './pages/GroupChatPage';
import ClassmatesPage from './pages/ClassmatesPage';
import ClassmateGroupChatPage from './pages/ClassmateGroupChatPage';
import ConfessionsPage from './pages/ConfessionsPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import UserProfileViewPage from './pages/UserProfileViewPage';
import UniversityStudentsPage from './pages/UniversityStudentsPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
import NavBar, { NAV_ITEMS } from './components/NavBar';
import AppBackdrop from './components/AppBackdrop';
import { useAuth } from './context/AuthContext';
import AdminLayout from './admin/AdminLayout';
import AdminProtectedRoute from './admin/AdminProtectedRoute';
import AdminDashboard from './admin/pages/AdminDashboard';
import AdminUsers from './admin/pages/AdminUsers';
import AdminVerificationQueue from './admin/pages/AdminVerificationQueue';
import AdminUniversities from './admin/pages/AdminUniversities';
import AdminDepartments from './admin/pages/AdminDepartments';
import AdminPosts from './admin/pages/AdminPosts';
import AdminReports from './admin/pages/AdminReports';
import AdminConfessions from './admin/pages/AdminConfessions';
import AdminSettings from './admin/pages/AdminSettings';

// Kalıcı gezinme çubuğunun görüneceği sayfalar (sohbet ekranları tam ekran kalır)
const NAV_PATHS = [...NAV_ITEMS.map((i) => i.to), '/notifications', '/settings'];
const NAV_PREFIXES = ['/discover/', '/users/', '/universities/'];

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
        path="/group/:groupId"
        element={
          <ProtectedRoute>
            <GroupChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/classmates"
        element={
          <ProtectedRoute>
            <ClassmatesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/classmates/:groupId"
        element={
          <ProtectedRoute>
            <ClassmateGroupChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/confessions"
        element={
          <ProtectedRoute>
            <ConfessionsPage />
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
        path="/universities/:universityId"
        element={
          <ProtectedRoute>
            <UniversityStudentsPage />
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
        <Route path="confessions" element={<AdminConfessions />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    {showNav && <NavBar />}
    </>
  );
}
