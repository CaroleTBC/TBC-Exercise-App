import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ComplianceTracker from './ComplianceTracker';
import VideoPlayer from '../shared/VideoPlayer';
import LogSessionModal from './LogSessionModal';
import {
  LogOut, Dumbbell, BookOpen, BarChart2,
  ChevronDown, ChevronUp, Clock, RotateCcw,
  Info, Calendar
} from 'lucide-react';

const TABS = [
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'information', label: 'Information', icon: BookOpen },
  { id: 'progress', label: 'Progress', icon: BarChart2 },
];

export default function ClientDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('exercises');
  const [programme, setProgramme] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [information, setInformation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const headerRef = useRef(null);
  const tabRef = useRef(null);

  useEffect(() => {
    fetchProgramme();
  }, []);

  async function fetchProgramme() {
    setLoading(true);
    try {
      const { data: programmes } = await supabase
        .from('client_programmes')
        .select('*')
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!programmes?.length) { setLoading(false); return; }
      const prog = programmes[0];
      setProgramme(prog);

      const { data: progExercises } = await supabase
        .from('programme_exercises')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('programme_id', prog.id)
        .eq('is_active', true)
        .order('sort_order');

      const { data: info } = await supabase
        .from('client_information')
        .select('*')
        .eq('client_id', profile.id)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      setExercises(progExercises || []);
      setInformation(info || []);
    } finally {
      setLoading(false);
    }
  }

  function toggleExercise(id) {
    setExpandedExercise(prev => prev === id ? null : id);
  }

  function onSessionLogged() {
    setRefreshTrigger(t => t + 1);
    setShowLogModal(false);
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <span className="spinner" />
        <p style={{ marginTop: '1rem', color: 'var(--navy)', opacity: 0.6 }}>Loading your programme...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Sticky Header */}
      <header ref={headerRef} style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.headerTitle}>Therapy by Carole</div>
            <div style={styles.headerSub}>
              {programme?.name || `Hi ${firstName}`}
            </div>
          </div>
          <button
            onClick={signOut}
            className="btn btn-ghost"
            style={{ color: 'rgba(239,231,220,0.8)' }}
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Sticky Tabs */}
        <nav ref={tabRef} style={styles.tabs}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab.id ? styles.tabActive : {}),
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Content */}
      <main style={styles.main}>
        {activeTab === 'exercises' && (
          <div className="fade-in">
            {!programme ? (
              <div className="empty-state">
                <Dumbbell size={40} opacity={0.3} />
                <p>Your programme is being set up.<br />You'll see your exercises here once they're ready.</p>
              </div>
            ) : exercises.length === 0 ? (
              <div className="empty-state">
                <Dumbbell size={40} opacity={0.3} />
                <p>No exercises assigned yet.</p>
              </div>
            ) : (
              <div style={styles.exerciseList}>
                <div style={styles.sectionHeader}>
                  <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                  {programme.review_date && (
                    <span style={styles.reviewDate}>
                      <Calendar size={12} />
                      Review: {new Date(programme.review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>

                {exercises.map((pe, idx) => {
                  const ex = pe.exercise;
                  const isExpanded = expandedExercise === pe.id;
                  const sets = pe.sets || ex?.default_sets;
                  const reps = pe.reps || ex?.default_reps;
                  const hold = pe.hold_seconds || ex?.default_hold_seconds;
                  const rest = pe.rest_seconds || ex?.default_rest_seconds;

                  return (
                    <div
                      key={pe.id}
                      className="card"
                      style={{
                        ...styles.exerciseCard,
                        animationDelay: `${idx * 0.05}s`,
                      }}
                    >
                      <button
                        onClick={() => toggleExercise(pe.id)}
                        style={styles.exerciseHeader}
                        aria-expanded={isExpanded}
                      >
                        <div style={styles.exerciseHeaderLeft}>
                          <div style={styles.exerciseNumber}>{idx + 1}</div>
                          <div>
                            <div style={styles.exerciseName}>{ex?.name}</div>
                            <div style={styles.exerciseMeta}>
                              <span className="badge badge-navy">{ex?.category}</span>
                              {sets && <span style={styles.metaItem}><RotateCcw size={11} /> {sets} sets</span>}
                              {reps && <span style={styles.metaItem}>× {reps}</span>}
                              {hold && <span style={styles.metaItem}><Clock size={11} /> {hold}s hold</span>}
                            </div>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} color="var(--navy)" /> : <ChevronDown size={18} color="var(--navy)" />}
                      </button>

                      {isExpanded && (
                        <div style={styles.exerciseBody} className="slide-up">
                          {ex?.video_url && (
                            <VideoPlayer url={ex.video_url} type={ex.video_type} title={ex.name} />
                          )}

                          <div style={styles.exerciseParams}>
                            {sets && <div style={styles.param}><span style={styles.paramLabel}>Sets</span><span style={styles.paramValue}>{sets}</span></div>}
                            {reps && <div style={styles.param}><span style={styles.paramLabel}>Reps</span><span style={styles.paramValue}>{reps}</span></div>}
                            {hold && <div style={styles.param}><span style={styles.paramLabel}>Hold</span><span style={styles.paramValue}>{hold}s</span></div>}
                            {rest && <div style={styles.param}><span style={styles.paramLabel}>Rest</span><span style={styles.paramValue}>{rest}s</span></div>}
                          </div>

                          {ex?.description && (
                            <div style={styles.description}>
                              <p>{ex.description}</p>
                            </div>
                          )}

                          {pe.client_notes && (
                            <div style={styles.clientNotes}>
                              <Info size={13} />
                              <p>{pe.client_notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={() => setShowLogModal(true)}
                  className="btn btn-secondary"
                  style={styles.logFloatBtn}
                >
                  <BarChart2 size={16} />
                  Log today's session
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'information' && (
          <div className="fade-in">
            {information.length === 0 ? (
              <div className="empty-state">
                <BookOpen size={40} opacity={0.3} />
                <p>No articles or notes yet.<br />Check back after your next appointment.</p>
              </div>
            ) : (
              <div style={styles.infoList}>
                {information.map(item => (
                  <div key={item.id} className="card" style={styles.infoCard}>
                    {item.is_pinned && (
                      <div style={styles.pinnedBar}>📌 Pinned</div>
                    )}
                    <div style={styles.infoContent}>
                      <div style={styles.infoCategory}>{item.category}</div>
                      <h3 style={styles.infoTitle}>{item.title}</h3>
                      <div style={styles.infoText}>
                        {item.content.split('\n').map((para, i) => (
                          para.trim() ? <p key={i}>{para}</p> : <br key={i} />
                        ))}
                      </div>
                      <div style={styles.infoDate}>
                        {new Date(item.updated_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <div className="fade-in">
            <div className="card" style={styles.progressCard}>
              <div style={styles.progressHeader}>
                <h2 style={{ fontSize: '1.25rem' }}>Your Progress</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7, marginTop: '0.25rem' }}>
                  Every session counts — even a partial one.
                </p>
              </div>
              {programme ? (
                <ComplianceTracker
                  key={refreshTrigger}
                  programmeId={programme.id}
                  onLogToday={() => setShowLogModal(true)}
                />
              ) : (
                <div className="empty-state">
                  <p>Progress tracking will appear once your programme is set up.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Log Session Modal */}
      {showLogModal && programme && (
        <LogSessionModal
          programme={programme}
          exercises={exercises}
          onClose={() => setShowLogModal(false)}
          onLogged={onSessionLogged}
        />
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--off-white)',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'var(--navy)',
    boxShadow: 'var(--shadow-md)',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem 0.5rem',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
  },
  headerTitle: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.15rem',
    color: 'var(--cream)',
    fontWeight: 500,
  },
  headerSub: {
    fontSize: '0.75rem',
    color: 'rgba(239,231,220,0.65)',
    marginTop: '0.1rem',
  },
  tabs: {
    display: 'flex',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    padding: '0 0.5rem',
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.7rem 0.5rem',
    background: 'transparent',
    border: 'none',
    color: 'rgba(239,231,220,0.6)',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-sans)',
    fontWeight: 400,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: 'var(--cream)',
    borderBottomColor: 'var(--terracotta)',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
    padding: '1rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.8rem',
    color: 'var(--navy)',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
    padding: '0 0.25rem',
  },
  reviewDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  exerciseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    paddingBottom: '5rem',
  },
  exerciseCard: {
    animation: 'fadeIn 0.3s ease forwards',
    opacity: 0,
  },
  exerciseHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  exerciseHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flex: 1,
    minWidth: 0,
  },
  exerciseNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--navy)',
    color: 'var(--cream)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    flexShrink: 0,
  },
  exerciseName: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.05rem',
    color: 'var(--navy)',
    fontWeight: 500,
    marginBottom: '0.25rem',
  },
  exerciseMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.2rem',
    fontSize: '0.75rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
  },
  exerciseBody: {
    padding: '0 1rem 1rem',
    borderTop: '1px solid var(--cream-dark)',
    marginTop: '0',
  },
  exerciseParams: {
    display: 'flex',
    gap: '0.75rem',
    margin: '1rem 0',
    flexWrap: 'wrap',
  },
  param: {
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--cream)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.5rem 0.75rem',
    minWidth: '60px',
    alignItems: 'center',
  },
  paramLabel: {
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--navy)',
    opacity: 0.6,
  },
  paramValue: {
    fontSize: '1rem',
    fontFamily: 'var(--font-serif)',
    fontWeight: 600,
    color: 'var(--navy)',
    marginTop: '0.1rem',
  },
  description: {
    fontSize: '0.9rem',
    lineHeight: 1.7,
    color: 'var(--charcoal)',
  },
  clientNotes: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    background: 'rgba(196,122,90,0.08)',
    borderLeft: '3px solid var(--terracotta)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    padding: '0.65rem 0.75rem',
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: 'var(--charcoal)',
    lineHeight: 1.6,
  },
  logFloatBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '0.9rem',
    fontSize: '0.95rem',
    marginTop: '0.5rem',
    position: 'sticky',
    bottom: '1rem',
    boxShadow: 'var(--shadow-lg)',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  infoCard: {
    overflow: 'hidden',
  },
  pinnedBar: {
    background: 'var(--cream)',
    padding: '0.4rem 1rem',
    fontSize: '0.75rem',
    color: 'var(--navy)',
    borderBottom: '1px solid var(--cream-dark)',
  },
  infoContent: {
    padding: '1.25rem',
  },
  infoCategory: {
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--terracotta)',
    fontWeight: 600,
    marginBottom: '0.4rem',
  },
  infoTitle: {
    fontSize: '1.2rem',
    color: 'var(--navy)',
    marginBottom: '0.75rem',
  },
  infoText: {
    fontSize: '0.9rem',
    lineHeight: 1.75,
    color: 'var(--charcoal)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  infoDate: {
    fontSize: '0.75rem',
    color: 'var(--charcoal)',
    opacity: 0.5,
    marginTop: '1rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid var(--cream-dark)',
  },
  progressCard: {
    overflow: 'hidden',
  },
  progressHeader: {
    padding: '1.25rem 1.25rem 0',
    borderBottom: '1px solid var(--cream-dark)',
    paddingBottom: '1rem',
    marginBottom: '0',
  },
};
