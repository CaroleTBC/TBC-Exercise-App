import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
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

// Parses **bold** and *italic* inline markers into React elements
function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

// Renders markdown-ish text: ###/##/# headings, **bold**, *italic*, - bullets, paragraphs
function MarkdownContent({ text }) {
  if (!text) return null;
  const elements = [];
  text.split('\n').forEach((line, i) => {
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} style={{ fontSize: '0.95rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.85rem 0 0.35rem' }}>{parseInline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} style={{ fontSize: '1.05rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.85rem 0 0.35rem' }}>{parseInline(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} style={{ fontSize: '1.15rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.85rem 0 0.35rem' }}>{parseInline(line.slice(2))}</h2>);
    } else if (line.match(/^[-*] /)) {
      elements.push(
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}>
          <span style={{ color: 'var(--terracotta)', fontWeight: 700, flexShrink: 0 }}>•</span>
          <span style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--charcoal)' }}>{parseInline(line.slice(2))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.4rem' }} />);
    } else {
      elements.push(<p key={i} style={{ margin: 0, lineHeight: 1.75, fontSize: '0.9rem', color: 'var(--charcoal)' }}>{parseInline(line)}</p>);
    }
  });
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{elements}</div>;
}

// Renders exercise description: detects numbered steps and puts each in its own box,
// handles mixed intro text + steps
function DescriptionText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const segments = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current) { segments.push(current); current = null; }
      continue;
    }
    const isNumbered = /^\d+[.)]\s/.test(line);
    if (isNumbered) {
      if (!current || current.type !== 'steps') {
        if (current) segments.push(current);
        current = { type: 'steps', lines: [] };
      }
      current.lines.push(line.replace(/^\d+[.)]\s*/, ''));
    } else {
      if (!current || current.type !== 'text') {
        if (current) segments.push(current);
        current = { type: 'text', lines: [] };
      }
      current.lines.push(line);
    }
  }
  if (current) segments.push(current);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {segments.map((seg, si) => {
        if (seg.type === 'steps') {
          return (
            <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {seg.lines.map((line, li) => (
                <div key={li} style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  background: 'var(--cream)', border: '1px solid var(--cream-dark)',
                  borderRadius: 'var(--radius-md)', padding: '0.7rem 0.9rem',
                }}>
                  <span style={{
                    width: '22px', height: '22px', minWidth: '22px', borderRadius: '50%',
                    background: 'var(--terracotta)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>{li + 1}</span>
                  <span style={{ fontSize: '0.875rem', lineHeight: 1.65, color: 'var(--charcoal)' }}>{line}</span>
                </div>
              ))}
            </div>
          );
        }
        return (
          <p key={si} style={{ margin: 0, lineHeight: 1.65, fontSize: '0.875rem', color: 'var(--charcoal)' }}>
            {seg.lines.join(' ')}
          </p>
        );
      })}
    </div>
  );
}

export default function ClientDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('exercises');
  const [programme, setProgramme] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [information, setInformation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // Inline set logging
  const [loggedSets, setLoggedSets] = useState({});   // { [peId]: number }
  const [todayLogId, setTodayLogId] = useState(null);
  const [logSaving, setLogSaving] = useState({});      // { [peId]: bool }

  useEffect(() => {
    fetchProgramme();
  }, []);

  async function fetchProgramme() {
    setLoading(true);
    setFetchError(null);
    try {
      const { data: programmes, error: progErr } = await supabase
        .from('client_programmes')
        .select('*')
        .eq('client_id', profile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (progErr) throw progErr;
      if (!programmes?.length) { setLoading(false); return; }
      const prog = programmes[0];
      setProgramme(prog);

      const [{ data: progExercises, error: exErr }, { data: info, error: infoErr }] = await Promise.all([
        supabase
          .from('programme_exercises')
          .select('*, exercise:exercises(*)')
          .eq('programme_id', prog.id)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('client_information')
          .select('*')
          .eq('client_id', profile.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (exErr) throw exErr;
      if (infoErr) throw infoErr;

      setExercises(progExercises || []);
      setInformation(info || []);

      // Load any sets already logged today
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayLog } = await supabase
        .from('compliance_logs')
        .select('id, exercise_completions(*)')
        .eq('client_id', profile.id)
        .eq('programme_id', prog.id)
        .eq('log_date', today)
        .maybeSingle();

      if (todayLog) {
        setTodayLogId(todayLog.id);
        const sets = {};
        (todayLog.exercise_completions || []).forEach(ec => {
          const n = parseInt(ec.notes);
          if (!isNaN(n)) sets[ec.programme_exercise_id] = n;
          else if (ec.completed) sets[ec.programme_exercise_id] = 99; // logged as done via modal
        });
        setLoggedSets(sets);
      }
    } catch (err) {
      setFetchError(err.message || 'Failed to load your programme.');
    } finally {
      setLoading(false);
    }
  }

  async function logSetsForExercise(peId, count, totalSets) {
    setLogSaving(prev => ({ ...prev, [peId]: true }));
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Get or create today's compliance log
      let logId = todayLogId;
      if (!logId) {
        const { data: existing } = await supabase
          .from('compliance_logs')
          .select('id')
          .eq('client_id', profile.id)
          .eq('programme_id', programme.id)
          .eq('log_date', today)
          .maybeSingle();

        if (existing) {
          logId = existing.id;
        } else {
          const { data: newLog, error } = await supabase
            .from('compliance_logs')
            .insert({
              client_id: profile.id,
              programme_id: programme.id,
              log_date: today,
              status: 'partial',
              exercises_completed: 0,
              exercises_total: exercises.length,
            })
            .select('id')
            .single();
          if (error) throw error;
          logId = newLog.id;
        }
        setTodayLogId(logId);
      }

      // Upsert this exercise's completion
      await supabase
        .from('exercise_completions')
        .upsert({
          compliance_log_id: logId,
          programme_exercise_id: peId,
          completed: count >= totalSets,
          notes: count > 0 ? String(count) : null,
        }, { onConflict: 'compliance_log_id,programme_exercise_id' });

      const updatedSets = { ...loggedSets, [peId]: count };
      setLoggedSets(updatedSets);

      // Recalculate overall log status
      const doneCount = exercises.filter(pe => {
        const t = pe.sets || pe.exercise?.default_sets || 3;
        return (updatedSets[pe.id] || 0) >= t;
      }).length;
      const anyLogged = exercises.some(pe => (updatedSets[pe.id] || 0) > 0);
      const status = doneCount === exercises.length ? 'completed' : anyLogged ? 'partial' : 'partial';

      await supabase
        .from('compliance_logs')
        .update({ exercises_completed: doneCount, exercises_total: exercises.length, status })
        .eq('id', logId);

      if (status === 'completed') setRefreshTrigger(t => t + 1);
    } catch (err) {
      console.error('Failed to log sets:', err);
    } finally {
      setLogSaving(prev => ({ ...prev, [peId]: false }));
    }
  }

  function toggleExercise(id) {
    setExpandedExercise(prev => prev === id ? null : id);
  }

  function onSessionLogged() {
    setRefreshTrigger(t => t + 1);
    setShowLogModal(false);
    // Reload today's completions to sync inline state
    fetchProgramme();
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

  if (fetchError) {
    return (
      <div style={styles.loadingPage}>
        <p style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem' }}>
          {fetchError}
        </p>
        <button onClick={fetchProgramme} className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Sticky Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <div style={styles.headerTitle}>Therapy by Carole</div>
            <div style={styles.headerSub}>{programme?.name || `Hi ${firstName}`}</div>
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
        <nav style={styles.tabs}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <main style={styles.main}>
        {/* ── EXERCISES ─────────────────────────────── */}
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
                  const totalSets = sets || 3;
                  const doneSets = loggedSets[pe.id] || 0;
                  const allSetsDone = doneSets >= totalSets;
                  const someSetsDone = doneSets > 0 && !allSetsDone;

                  return (
                    <div key={pe.id} className="card" style={{ ...styles.exerciseCard, animationDelay: `${idx * 0.05}s` }}>
                      <button
                        onClick={() => toggleExercise(pe.id)}
                        style={styles.exerciseHeader}
                        aria-expanded={isExpanded}
                      >
                        <div style={styles.exerciseHeaderLeft}>
                          <div style={{
                            ...styles.exerciseNumber,
                            background: allSetsDone ? 'var(--success)' : someSetsDone ? 'var(--terracotta)' : 'var(--navy)',
                          }}>
                            {allSetsDone ? '✓' : idx + 1}
                          </div>
                          <div>
                            <div style={styles.exerciseName}>{ex?.name}</div>
                            <div style={styles.exerciseMeta}>
                              <span className="badge badge-navy">{ex?.category}</span>
                              {sets && <span style={styles.metaItem}><RotateCcw size={11} /> {sets} sets</span>}
                              {reps && <span style={styles.metaItem}>× {reps}</span>}
                              {hold && <span style={styles.metaItem}><Clock size={11} /> {hold}s hold</span>}
                              {pe.frequency_per_week && <span style={styles.metaItem}><Calendar size={11} /> {pe.frequency_per_week}× per week</span>}
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
                              <DescriptionText text={ex.description} />
                            </div>
                          )}

                          {pe.client_notes && (
                            <div style={styles.clientNotes}>
                              <Info size={13} />
                              <p>{pe.client_notes}</p>
                            </div>
                          )}

                          {/* ── Inline set logging ── */}
                          <div style={styles.setLogSection}>
                            <span style={styles.setLogLabel}>Sets done today</span>
                            <div style={styles.setButtonRow}>
                              {Array.from({ length: totalSets }, (_, i) => i + 1).map(n => {
                                const filled = doneSets >= n;
                                return (
                                  <button
                                    key={n}
                                    disabled={logSaving[pe.id]}
                                    onClick={() => logSetsForExercise(pe.id, doneSets === n ? n - 1 : n, totalSets)}
                                    style={{
                                      ...styles.setBtn,
                                      background: filled ? 'var(--success)' : 'var(--cream)',
                                      color: filled ? 'white' : 'var(--charcoal)',
                                      border: `2px solid ${filled ? 'var(--success)' : 'var(--cream-dark)'}`,
                                      opacity: logSaving[pe.id] ? 0.6 : 1,
                                    }}
                                  >
                                    {filled ? '✓' : n}
                                  </button>
                                );
                              })}
                              {doneSets > 0 && (
                                <button
                                  onClick={() => logSetsForExercise(pe.id, 0, totalSets)}
                                  disabled={logSaving[pe.id]}
                                  style={{ ...styles.setBtn, background: 'transparent', border: '2px solid var(--cream-dark)', color: 'var(--charcoal)', opacity: 0.45 }}
                                  title="Clear"
                                >✕</button>
                              )}
                            </div>
                            {doneSets > 0 && (
                              <span style={{ ...styles.setLogStatus, color: allSetsDone ? 'var(--success)' : 'var(--terracotta)' }}>
                                {allSetsDone ? '✅ All sets done!' : `${doneSets} of ${totalSets} sets`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── INFORMATION ───────────────────────────── */}
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
                    {item.is_pinned && <div style={styles.pinnedBar}>📌 Pinned</div>}
                    <div style={styles.infoContent}>
                      <div style={styles.infoCategory}>{item.category}</div>
                      <h3 style={styles.infoTitle}>{item.title}</h3>
                      <div style={styles.infoText}>
                        <MarkdownContent text={item.content} />
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

        {/* ── PROGRESS ──────────────────────────────── */}
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
  page: { minHeight: '100vh', background: 'var(--off-white)', display: 'flex', flexDirection: 'column' },
  loadingPage: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  header: { position: 'sticky', top: 0, zIndex: 100, background: 'var(--navy)', boxShadow: 'var(--shadow-md)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem 0.5rem', maxWidth: '800px', margin: '0 auto', width: '100%' },
  headerTitle: { fontFamily: 'var(--font-serif)', fontSize: '1.15rem', color: 'var(--cream)', fontWeight: 500 },
  headerSub: { fontSize: '0.75rem', color: 'rgba(239,231,220,0.65)', marginTop: '0.1rem' },
  tabs: { display: 'flex', maxWidth: '800px', margin: '0 auto', width: '100%', padding: '0 0.5rem' },
  tab: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem 0.25rem', background: 'transparent', border: 'none', color: 'rgba(239,231,220,0.6)', fontSize: 'clamp(0.65rem, 2.2vw, 0.8rem)', fontFamily: 'var(--font-sans)', fontWeight: 400, cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden' },
  tabActive: { color: 'var(--cream)', borderBottomColor: 'var(--terracotta)', fontWeight: 600 },
  main: { flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%', padding: '1rem' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--navy)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', padding: '0 0.25rem' },
  reviewDate: { display: 'flex', alignItems: 'center', gap: '0.3rem' },
  exerciseList: { display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1rem' },
  exerciseCard: { animation: 'fadeIn 0.3s ease forwards', opacity: 0 },
  exerciseHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' },
  exerciseHeaderLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 },
  exerciseNumber: { width: '28px', height: '28px', borderRadius: '50%', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0, transition: 'background 0.3s' },
  exerciseName: { fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 500, marginBottom: '0.25rem' },
  exerciseMeta: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  metaItem: { display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--charcoal)', opacity: 0.7 },
  exerciseBody: { padding: '0 1rem 1rem', borderTop: '1px solid var(--cream-dark)' },
  exerciseParams: { display: 'flex', gap: '0.75rem', margin: '1rem 0', flexWrap: 'wrap' },
  param: { display: 'flex', flexDirection: 'column', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', minWidth: '60px', alignItems: 'center' },
  paramLabel: { fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--navy)', opacity: 0.6 },
  paramValue: { fontSize: '1rem', fontFamily: 'var(--font-serif)', fontWeight: 600, color: 'var(--navy)', marginTop: '0.1rem' },
  description: { marginTop: '0.75rem', marginBottom: '0.75rem' },
  clientNotes: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(196,122,90,0.08)', borderLeft: '3px solid var(--terracotta)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', padding: '0.65rem 0.75rem', marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--charcoal)', lineHeight: 1.6 },
  setLogSection: { marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--cream-dark)', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  setLogLabel: { fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--navy)', opacity: 0.6, fontWeight: 500 },
  setButtonRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  setBtn: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-sans)' },
  setLogStatus: { fontSize: '0.8rem', fontWeight: 600 },
  infoList: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  infoCard: { overflow: 'hidden' },
  pinnedBar: { background: 'var(--terracotta)', padding: '0.35rem 1rem', fontSize: '0.72rem', color: 'white', fontWeight: 600, letterSpacing: '0.03em' },
  infoContent: { padding: '1.25rem' },
  infoCategory: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--terracotta)', fontWeight: 600, marginBottom: '0.4rem' },
  infoTitle: { fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--navy)', fontWeight: 500, marginBottom: '0.75rem' },
  infoText: { fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--charcoal)' },
  infoDate: { fontSize: '0.75rem', color: 'var(--charcoal)', opacity: 0.5, marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--cream-dark)' },
  progressCard: { overflow: 'hidden' },
  progressHeader: { padding: '1.25rem 1.25rem 0', borderBottom: '1px solid var(--cream-dark)', paddingBottom: '1rem', marginBottom: '0' },
};
