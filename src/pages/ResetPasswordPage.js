import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Lock, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const { clearPasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => clearPasswordReset(), 1500);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.logoMark}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="#c47a5a" strokeWidth="2"/>
                <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#2f456f" opacity="0.8"/>
              </svg>
            </div>
            <h1 style={styles.title}>Therapy by Carole</h1>
            <p style={styles.subtitle}>Set your new password</p>
          </div>

          <div style={styles.body}>
            {done ? (
              <div style={styles.successBox}>
                Password updated — redirecting you now…
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-password">New password</label>
                  <div style={styles.inputWrapper}>
                    <Lock size={16} style={styles.inputIcon} />
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingLeft: '2.4rem', paddingRight: '2.75rem' }}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={styles.eyeBtn}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-password">Confirm password</label>
                  <div style={styles.inputWrapper}>
                    <Lock size={16} style={styles.inputIcon} />
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingLeft: '2.4rem' }}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Repeat your password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={styles.submitBtn}
                  disabled={loading}
                >
                  {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : null}
                  {loading ? 'Updating…' : 'Set new password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--cream)',
    padding: '1rem',
  },
  container: {
    width: '100%',
    maxWidth: '420px',
  },
  card: {
    background: 'var(--white)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid rgba(47,69,111,0.08)',
    overflow: 'hidden',
  },
  header: {
    background: 'var(--navy)',
    padding: '2rem 2rem 1.5rem',
    textAlign: 'center',
  },
  logoMark: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  title: {
    color: 'var(--cream)',
    fontFamily: 'var(--font-serif)',
    fontSize: '1.6rem',
    fontWeight: 400,
    margin: 0,
  },
  subtitle: {
    color: 'rgba(239,231,220,0.7)',
    fontSize: '0.875rem',
    marginTop: '0.4rem',
  },
  body: {
    padding: '1.75rem',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--navy)',
    opacity: 0.5,
    pointerEvents: 'none',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--navy)',
    opacity: 0.5,
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem',
  },
  error: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.9rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  successBox: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    fontSize: '0.9rem',
    textAlign: 'center',
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '0.8rem',
    fontSize: '1rem',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
};
