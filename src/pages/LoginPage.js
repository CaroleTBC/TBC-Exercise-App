import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!gdprAccepted) {
      setError('Please accept the privacy notice to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.background} />

      <div style={styles.container}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.logoMark}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="15" stroke="#c47a5a" strokeWidth="2"/>
                <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="#2f456f" opacity="0.8"/>
              </svg>
            </div>
            <h1 style={styles.title}>Therapy by Carole</h1>
            <p style={styles.subtitle}>
              {mode === 'login' ? 'Your personal exercise programme' : 'Reset your password'}
            </p>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} style={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <div style={styles.inputWrapper}>
                  <Mail size={16} style={styles.inputIcon} />
                  <input
                    id="email"
                    type="email"
                    className="form-input"
                    style={styles.iconInput}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div style={styles.inputWrapper}>
                  <Lock size={16} style={styles.inputIcon} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ ...styles.iconInput, paddingRight: '2.75rem' }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
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

              {/* GDPR Consent */}
              <div style={styles.gdprBox}>
                <label style={styles.gdprLabel}>
                  <input
                    type="checkbox"
                    checked={gdprAccepted}
                    onChange={e => setGdprAccepted(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={styles.gdprText}>
                    I understand that Therapy by Carole will store my personal health information
                    and exercise data to deliver my programme. This data is held securely and
                    processed in line with GDPR. I can request deletion of my data at any time
                    by emailing{' '}
                    <a href="mailto:info@therapybycarole.co.uk">info@therapybycarole.co.uk</a>.
                  </span>
                </label>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <button
                type="submit"
                className="btn btn-primary"
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : null}
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                style={styles.forgotBtn}
              >
                Forgot your password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} style={styles.form}>
              {resetSent ? (
                <div style={styles.successBox}>
                  <p>Check your email — we've sent a password reset link.</p>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => { setMode('login'); setResetSent(false); }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-email">Your email address</label>
                    <input
                      id="reset-email"
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  {error && <div style={styles.error}>{error}</div>}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={styles.submitBtn}
                    disabled={loading}
                  >
                    {loading ? 'Sending...' : 'Send reset link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    style={styles.forgotBtn}
                  >
                    Back to sign in
                  </button>
                </>
              )}
            </form>
          )}
        </div>

        <p style={styles.footer}>
          © {new Date().getFullYear()} Therapy by Carole ·{' '}
          <a href="https://therapybycarole.co.uk" target="_blank" rel="noreferrer">
            therapybycarole.co.uk
          </a>
        </p>
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
    position: 'relative',
    padding: '1rem',
    background: 'var(--cream)',
  },
  background: {
    position: 'fixed',
    inset: 0,
    background: `
      radial-gradient(ellipse 60% 50% at 20% 20%, rgba(47,69,111,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 80%, rgba(196,122,90,0.1) 0%, transparent 60%)
    `,
    zIndex: 0,
  },
  container: {
    width: '100%',
    maxWidth: '420px',
    position: 'relative',
    zIndex: 1,
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
  form: {
    padding: '1.75rem 1.75rem 1.25rem',
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
  iconInput: {
    paddingLeft: '2.4rem',
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
  gdprBox: {
    background: 'var(--cream)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    marginBottom: '1.25rem',
  },
  gdprLabel: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: '3px',
    width: '16px',
    height: '16px',
    flexShrink: 0,
    accentColor: 'var(--navy)',
  },
  gdprText: {
    fontSize: '0.8rem',
    color: 'var(--charcoal)',
    lineHeight: 1.55,
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
  },
  submitBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '0.8rem',
    fontSize: '1rem',
    gap: '0.5rem',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--terracotta)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'block',
    margin: '0.75rem auto 0',
    padding: '0.25rem',
  },
  footer: {
    textAlign: 'center',
    marginTop: '1.25rem',
    fontSize: '0.8rem',
    color: 'var(--navy)',
    opacity: 0.6,
  },
};
