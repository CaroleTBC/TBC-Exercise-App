import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ExerciseLibrary from './ExerciseLibrary';
import ClientManager from './ClientManager';
import {
  Users, BookOpen, LogOut, Activity, ChevronRight
} from 'lucide-react';

const TABS = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'library', label: 'Exercise Library', icon: BookOpen },
];

export default function TherapistDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('clients');
  const [stats, setStats] = useState({ clients: 0, exercises: 0, activeProgrammes: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    const [{ count: clients }, { count: exercises }, { count: progs }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      supabase.from('exercises').select('*', { count: 'exact', head: true }),
      supabase.from('client_programmes').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    setStats({ clients: clients || 0, exercises: exercises || 0, activeProgrammes: progs || 0 });
  }

  const SidebarContent = () => (
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
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
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

      <button onClick={signOut} className="btn btn-ghost" style={styles.signOutBtn}>
        <LogOut size={15} /> Sign out
      </button>
    </>
  );

  return (
    <div style={styles.layout}>
      {/* Desktop Sidebar */}
      <aside className="th-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div style={styles.mobileOverlay} onClick={() => setSidebarOpen(false)}>
          <div style={styles.mobileSidebar} onClick={e => e.stopPropagation()}>
            <SidebarContent />
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
    marginTop: '1rem',
    justifyContent: 'flex-start',
    gap: '0.6rem',
    padding: '0.5rem 0.25rem',
    width: '100%',
    fontSize: '0.85rem',
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
