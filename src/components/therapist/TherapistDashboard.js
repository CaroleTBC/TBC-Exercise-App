import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ExerciseLibrary from './ExerciseLibrary';
import ClientManager from './ClientManager';
import InformationManager from './InformationManager';
import {
  Users, BookOpen, LogOut, Activity, ChevronRight, FileText, Palmtree, X
} from 'lucide-react';

const TABS = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'library', label: 'Exercise Library', icon: BookOpen },
  { id: 'information', label: 'Information', icon: FileText },
];

function SidebarContent({ profile, stats, activeTab, onTabChange, signOut, availability, awayExpanded, setAwayExpanded, awayForm, setAwayForm, saveAvailability, awaySaving }) {
  return (
    <>
      <div style={styles.sidebarLogo}>
        <div style={styles.logoMark}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="15" stroke="#c47a5a" strokeWidth="2"/>
            <path d="M10 16 Q16 8 22 16 Q16 24 10 16Z" fill="rgba(239,231,220,0.8)"/>
          </svg>
        </div>
        <div>
          <div style={styles.sidebarTitle}>Therapy by Carole</div>
          <div style={styles.sidebarSub}>Therapist Portal</div>
        </div>
      </div>

      <div style={styles.sidebarUser}>
        <div style={styles.avatar}>{profile?.full_name?.charAt(0) || 'C'}</div>
        <div>
          <div style={styles.userName}>{profile?.full_name}</div>
          <div style={styles.userRole}>Therapist</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                ...styles.navItem,
                ...(activeTab === tab.id ? styles.navItemActive : {}),
              }}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
              {activeTab !== tab.id && <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
            </button>
          );
        })}
      </nav>

      <div style={styles.statsBox}>
        <div style={styles.statRow}><Users size={13} /><span>{stats.clients} clients</span></div>
        <div style={styles.statRow}><BookOpen size={13} /><span>{stats.exercises} exercises</span></div>
        <div style={styles.statRow}><Activity size={13} /><span>{stats.activeProgrammes} active programmes</span></div>
      </div>

      {/* Away mode */}
      <div style={styles.awaySection}>
        {availability?.away_mode ? (
          <>
            <div style={styles.awayActiveBanner}>
              <span>🌴 Away mode on</span>
              <button
                onClick={() => saveAvailability(false)}
                disabled={awaySaving}
                style={{ background: 'none', border: 'none', color: 'var(--terracotta)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
              >
                {awaySaving ? '…' : 'Turn off'}
              </button>
            </div>
            {availability.return_date && (
              <p style={{ fontSize: '0.72rem', color: 'rgba(239,231,220,0.5)', margin: '0.3rem 0 0', paddingLeft: '0.25rem' }}>
                Returning {new Date(availability.return_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </p>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setAwayExpanded(v => !v)}
              style={styles.awayToggleBtn}
            >
              <Palmtree size={14} />
              {awayExpanded ? 'Cancel' : 'Set away message'}
            </button>
            {awayExpanded && (
              <div style={styles.awayForm}>
                <textarea
                  placeholder="e.g. I'm on annual leave and will reply on my return."
                  value={awayForm.away_message}
                  onChange={e => setAwayForm(f => ({ ...f, away_message: e.target.value }))}
                  rows={3}
                  style={styles.awayTextarea}
                />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={awayForm.return_date}
                    onChange={e => setAwayForm(f => ({ ...f, return_date: e.target.value }))}
                    style={{ ...styles.awayTextarea, flex: 1 }}
                  />
                  <button
                    onClick={() => saveAvailability(true)}
                    disabled={awaySaving}
                    className="btn btn-primary"
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', whiteSpace: 'nowrap' }}
                  >
                    {awaySaving ? '…' : 'Go away 🌴'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <button onClick={signOut} className="btn btn-ghost" style={styles.signOutBtn}>
        <LogOut size={15} /> Sign out
      </button>
    </>
  );
}

export default function TherapistDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('clients');
  const [stats, setStats] = useState({ clients: 0, exercises: 0, activeProgrammes: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [awayExpanded, setAwayExpanded] = useState(false);
  const [awayForm, setAwayForm] = useState({ away_message: '', return_date: '' });
  const [awaySaving, setAwaySaving] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchAvailability();
  }, []);

  async function fetchAvailability() {
    const { data } = await supabase
      .from('therapist_availability')
      .select('*')
      .eq('therapist_id', profile.id)
      .maybeSingle();
    if (data) {
      setAvailability(data);
      setAwayForm({ away_message: data.away_message || '', return_date: data.return_date || '' });
    }
  }

  async function saveAvailability(away_mode) {
    setAwaySaving(true);
    try {
      const payload = {
        therapist_id: profile.id,
        away_mode,
        away_message: awayForm.away_message || null,
        return_date: awayForm.return_date || null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('therapist_availability')
        .upsert(payload, { onConflict: 'therapist_id' })
        .select()
        .single();
      if (error) throw error;
      setAvailability(data);
      if (!away_mode) setAwayExpanded(false);
    } catch {
      alert('Failed to save availability. Please try again.');
    } finally {
      setAwaySaving(false);
    }
  }

  async function fetchStats() {
    try {
      const [{ count: clients }, { count: exercises }, { count: progs }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('exercises').select('*', { count: 'exact', head: true }),
        supabase.from('client_programmes').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setStats({ clients: clients || 0, exercises: exercises || 0, activeProgrammes: progs || 0 });
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  function handleTabChange(tabId) {
    setActiveTab(tabId);
    setSidebarOpen(false);
  }

  return (
    <div style={styles.layout}>
      {/* Desktop Sidebar */}
      <aside className="th-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <SidebarContent profile={profile} stats={stats} activeTab={activeTab} onTabChange={handleTabChange} signOut={signOut} availability={availability} awayExpanded={awayExpanded} setAwayExpanded={setAwayExpanded} awayForm={awayForm} setAwayForm={setAwayForm} saveAvailability={saveAvailability} awaySaving={awaySaving} />
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div style={styles.mobileOverlay} onClick={() => setSidebarOpen(false)}>
          <div style={styles.mobileSidebar} onClick={e => e.stopPropagation()}>
            <SidebarContent profile={profile} stats={stats} activeTab={activeTab} onTabChange={handleTabChange} signOut={signOut} availability={availability} awayExpanded={awayExpanded} setAwayExpanded={setAwayExpanded} awayForm={awayForm} setAwayForm={setAwayForm} saveAvailability={saveAvailability} awaySaving={awaySaving} />
          </div>
        </div>
      )}

      <div className="th-main-wrapper">
        {/* Mobile top bar */}
        <header className="th-mobile-bar">
          <button
            onClick={() => setSidebarOpen(true)}
            style={styles.menuBtn}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="var(--cream)" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <span style={styles.mobileTitle}>Therapy by Carole</span>
          <button onClick={signOut} style={styles.mobileSignOut}>
            <LogOut size={16} color="rgba(239,231,220,0.7)" />
          </button>
        </header>

        {/* Mobile tab bar */}
        <div className="th-mobile-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.mobileTab,
                  ...(activeTab === tab.id ? styles.mobileTabActive : {}),
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <main style={styles.main}>
          {activeTab === 'clients' && <ClientManager onStatsChange={fetchStats} />}
          {activeTab === 'library' && <ExerciseLibrary onStatsChange={fetchStats} />}
          {activeTab === 'information' && <InformationManager />}
        </main>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '260px',
    background: 'var(--navy)',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem',
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 200,
    overflowY: 'auto',
  },
  mobileOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(47,69,111,0.5)',
    zIndex: 300,
    backdropFilter: 'blur(3px)',
  },
  mobileSidebar: {
    width: '260px',
    height: '100%',
    background: 'var(--navy)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1.5rem',
    overflowY: 'auto',
    animation: 'slideUp 0.25s ease',
  },
  sidebarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '2rem',
    paddingBottom: '1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  logoMark: { flexShrink: 0 },
  sidebarTitle: {
    fontFamily: 'var(--font-serif)',
    color: 'var(--cream)',
    fontSize: '1rem',
    fontWeight: 400,
  },
  sidebarSub: {
    fontSize: '0.65rem',
    color: 'rgba(239,231,220,0.45)',
    marginTop: '0.1rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  sidebarUser: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--terracotta)',
    color: 'var(--white)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  userName: {
    color: 'var(--cream)',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  userRole: {
    color: 'rgba(239,231,220,0.45)',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.7rem 0.9rem',
    borderRadius: 'var(--radius-md)',
    background: 'transparent',
    border: 'none',
    color: 'rgba(239,231,220,0.6)',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
  },
  navItemActive: {
    background: 'rgba(255,255,255,0.1)',
    color: 'var(--cream)',
  },
  statsBox: {
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    color: 'rgba(239,231,220,0.4)',
    fontSize: '0.75rem',
  },
  signOutBtn: {
    color: 'rgba(239,231,220,0.45)',
    marginTop: '0.5rem',
    justifyContent: 'flex-start',
    gap: '0.6rem',
    padding: '0.5rem 0.25rem',
    width: '100%',
    fontSize: '0.85rem',
  },
  awaySection: {
    marginTop: 'auto',
    paddingTop: '1rem',
    borderTop: '1px solid rgba(239,231,220,0.1)',
  },
  awayActiveBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(196,122,90,0.2)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--cream)',
    fontWeight: 600,
  },
  awayToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'none',
    border: '1px solid rgba(239,231,220,0.2)',
    borderRadius: '6px',
    color: 'rgba(239,231,220,0.55)',
    cursor: 'pointer',
    fontSize: '0.78rem',
    padding: '0.4rem 0.75rem',
    width: '100%',
  },
  awayForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  awayTextarea: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(239,231,220,0.2)',
    borderRadius: '6px',
    color: 'var(--cream)',
    fontSize: '0.8rem',
    padding: '0.5rem 0.65rem',
    fontFamily: 'inherit',
    resize: 'vertical',
    width: '100%',
  },
  mainWrapper: {
    flex: 1,
    marginLeft: '260px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--off-white)',
  },
  mobileBar: {
    display: 'none',
    background: 'var(--navy)',
    padding: '0.75rem 1rem',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 100,
    boxShadow: 'var(--shadow-md)',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  mobileTitle: {
    fontFamily: 'var(--font-serif)',
    color: 'var(--cream)',
    fontSize: '1rem',
  },
  mobileSignOut: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  mobileTabs: {
    display: 'none',
    background: 'var(--navy)',
    padding: '0 0.5rem',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  mobileTab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.65rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(239,231,220,0.5)',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  mobileTabActive: {
    color: 'var(--cream)',
    borderBottomColor: 'var(--terracotta)',
  },
  main: {
    flex: 1,
  },
};
