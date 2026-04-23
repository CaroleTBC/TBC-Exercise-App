import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { UserPlus, Users, Mail, Phone, Calendar, X } from 'lucide-react';

export default function ClientManager({ onStatsChange }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('full_name');
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      setError('Failed to load clients. Please refresh.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(form) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/invite-client`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ full_name: form.full_name, email: form.email }),
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Invite failed');
    await fetchClients();
    onStatsChange?.();
    return result.message;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Clients</h1>
          <p style={styles.pageSubtitle}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="btn btn-primary">
          <UserPlus size={16} /> Invite client
        </button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {clients.length === 0 ? (
        <div className="empty-state">
          <Users size={40} opacity={0.3} />
          <p>No clients yet. Invite your first client to get started.</p>
        </div>
      ) : (
        <div style={styles.clientList}>
          {clients.map(client => (
            <div key={client.id} className="card" style={styles.clientCard}>
              <div style={styles.avatar}>{client.full_name?.charAt(0) || '?'}</div>
              <div style={styles.clientInfo}>
                <div style={styles.clientName}>{client.full_name}</div>
                <div style={styles.clientMeta}>
                  {client.email && (
                    <span style={styles.metaItem}><Mail size={12} />{client.email}</span>
                  )}
                  {client.phone && (
                    <span style={styles.metaItem}><Phone size={12} />{client.phone}</span>
                  )}
                  {client.date_of_birth && (
                    <span style={styles.metaItem}>
                      <Calendar size={12} />
                      {new Date(client.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
              <div style={styles.gdprBadge}>
                {client.gdpr_consent
                  ? <span className="badge badge-navy">Consent given</span>
                  : <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>Pending consent</span>
                }
              </div>
            </div>
          ))}
        </div>
      )}

      {showInviteModal && (
        <InviteModal
          onInvite={handleInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}

function InviteModal({ onInvite, onClose }) {
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const message = await onInvite(form);
      setSuccess(message || 'Client invited successfully.');
    } catch (err) {
      setError(err.message || 'Failed to invite client.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Invite a new client</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <>
            <div className="modal-body">
              <div style={styles.successBox}>{success}</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.7, marginTop: '0.75rem' }}>
                The client has been sent a login invitation. You can now assign them an exercise programme.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7, marginBottom: '1.25rem' }}>
                An invitation email will be sent to the client with a secure link to set up their account.
              </p>
              <div className="form-group">
                <label className="form-label">Full name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.full_name}
                  onChange={e => set('full_name', e.target.value)}
                  placeholder="e.g. Jane Smith"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email address *</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
              {error && <div style={styles.errorBox}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <UserPlus size={15} />}
                {loading ? 'Sending...' : 'Send invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '1.5rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--charcoal)',
    opacity: 0.6,
    marginTop: '0.3rem',
  },
  errorBanner: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  clientList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  clientCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'var(--navy)',
    color: 'var(--cream)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '1rem',
    flexShrink: 0,
    textTransform: 'uppercase',
  },
  clientInfo: {
    flex: 1,
    minWidth: 0,
  },
  clientName: {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: 'var(--navy)',
    marginBottom: '0.3rem',
  },
  clientMeta: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.78rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
  },
  gdprBadge: {
    flexShrink: 0,
  },
  successBox: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
  },
  errorBox: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.9rem',
    fontSize: '0.875rem',
    marginTop: '0.5rem',
  },
};
