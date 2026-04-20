import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ClientDashboard from './components/client/ClientDashboard';
import TherapistDashboard from './components/therapist/TherapistDashboard';
import './styles/globals.css';
import { supabase } from './lib/supabase';

function SetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  // Wait for Supabase to process the token from the URL hash
  // This handles Android Chrome where the hash is processed asynchronously
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION')) {
        setSessionReady(true);
      }
    });

    // Also check immediately in case session is already available
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSetPassword() {
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setSaving(false); return; }
    setDone(true);
    setSaving(false);
    setTimeout(() => window.location.href = '/', 2000);
  }

  if (done) {
    return (
      <div style={setupStyles.page}>
        <div style={setupStyles.card}>
          <h2 style={setupStyles.title}>Password set ✓</h2>
          <p style={setupStyles.subtitle}>Taking you to your programme...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={setupStyles.page}>
      <div style={setupStyles.card}>
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none" style={{ marginBottom: '1rem' }}>
          <circle cx="16" cy="16" r="15" stroke="#c47a5a" strokeWidth="2"/>
          <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#2f456f" opacity="0.8"/>
        </svg>
        <h2 style={setupStyles.title}>Welcome to Therapy by Carole</h2>
        <p style={setupStyles.subtitle}>Please set a password to access your exercise programme.</p>

        {!sessionReady && (
          <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <span className="spinner" />
            <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', opacity: 0.6 }}>Setting up your account...</p>
          </div>
        )}

        {error && <p style={setupStyles.error}>{error}</p>}

        <div className="form-group">
          <label className="form-label">New Password</label>
          <input
            type="password"
            className="form-input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={!sessionReady}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            className="form-input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            disabled={!sessionReady}
          />
        </div>
        <button
          onClick={handleSetPassword}
          className="btn btn-primary"
          disabled={saving || !password || !confirm || !sessionReady}
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {saving ? 'Setting password...' : 'Set Password & Continue'}
        </button>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    // Check URL hash for invite or recovery tokens
    // Must check before Supabase clears the hash
    const hash = window.location.hash;
    if (
      hash.includes('access_token') &&
      (hash.includes('type=invite') || hash.includes('type=recovery'))
    ) {
      setNeedsPassword(true);
    }

    // Also listen for auth events — some mobile browsers deliver
    // the token via onAuthStateChange rather than leaving it in the hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') {
        setNeedsPassword(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Show password page as soon as we detect the token —
  // don't wait for user to be set (fixes Android race condition)
  if (needsPassword) {
    return (
      <Routes>
        <Route path="*" element={<SetPasswordPage />} />
      </Routes>
    );
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

const setupStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--cream)',
    padding: '1.5rem',
  },
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.5rem',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 4px 24px rgba(47,69,111,0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.5rem',
    color: 'var(--navy)',
    margin: '0 0 0.5rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
    marginBottom: '1.5rem',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
};
