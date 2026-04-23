import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ClientDashboard from './components/client/ClientDashboard';
import TherapistDashboard from './components/therapist/TherapistDashboard';
import './styles/globals.css';

function AppRoutes() {
  const { user, profile, loading, needsPasswordReset } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--cream)',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" stroke="#c47a5a" strokeWidth="2"/>
          <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#2f456f" opacity="0.8"/>
        </svg>
        <span className="spinner" />
      </div>
    );
  }

  if (needsPasswordReset) {
    return <ResetPasswordPage />;
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/*"
        element={
          profile.role === 'therapist'
            ? <TherapistDashboard />
            : <ClientDashboard />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
