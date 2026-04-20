import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ComplianceTracker from './ComplianceTracker';
import VideoPlayer from '../shared/VideoPlayer';
import LogSessionModal from './LogSessionModal';
import {
  LogOut, Dumbbell, BookOpen, BarChart2,
  ChevronDown, ChevronUp, Clock, RotateCcw,
  Info, Calendar, CheckCircle2, AlertTriangle, Play
} from 'lucide-react';
import { format } from 'date-fns';
import { renderMarkdown } from '../therapist/InformationLibrary';

const TABS = [
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'information', label: 'Information', icon: BookOpen },
  { id: 'progress', label: 'Progress', icon: BarChart2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Description parser
// Splits the legacy description blob into { intro, steps, safety }.
// Strips clinical trial references — those belong in the information section.
// ─────────────────────────────────────────────────────────────────────────────
function parseDescription(description = '') {
  const text = description;

  const howToIdx = text.search(/HOW TO DO IT:/i);
  const safetyIdx = text.search(/SAFETY:/i);

  // Intro: everything before HOW TO DO IT
  let intro = howToIdx > -1 ? text.slice(0, howToIdx).trim() : text.trim();

  // Strip trial name references from client-facing intro
  intro = intro
    .replace(/\bthe LIFTMOR trial[^.]*\./gi, '')
    .replace(/\bResearch from the LIFTMOR trial[^.]*\./gi, '')
    .replace(/\bthe FORTIFY trial[^.]*\./gi, '')
    .replace(/\bDr[^.]+showed that\b/gi, 'Research has shown that')
    .replace(/\bDr[^.]+at the [^.]+\./gi, '')
    .replace(/\(T-score below -2\.5\)/gi, '')
    .replace(/  +/g, ' ')
    .trim();

  // Steps: numbered items between HOW TO DO IT and SAFETY
  let steps = [];
  if (howToIdx > -1) {
    const stepsEnd = safetyIdx > -1 ? safetyIdx : text.length;
    const stepsBlock = text.slice(howToIdx, stepsEnd).replace(/HOW TO DO IT:/i, '').trim();
    steps = stepsBlock
      .split(/\n?\d+\.\s+/)
      .map(s => s.replace(/\n/g, ' ').trim())
      .filter(Boolean);
  }

  // Safety: everything after SAFETY:
  let safety = '';
  if (safetyIdx > -1) {
    safety = text.slice(safetyIdx).replace(/SAFETY:/i, '').trim();
  }

  return { intro, steps, safety };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('exercises');
  const [programme, setProgramme] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [information, setInformation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [showVideo, setShowVideo] = useState({});
  const [showLogModal, setShowLogModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // inline completion state: { [programme_exercise_id]: { type: 'full'|'partial'|'skipped'|null, sets: number|null } }
  const [completions, setCompletions] = useState({});
  const [showPartialPicker, setShowPartialPicker] = useState(null);

  const headerRef = useRef(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  // ── Fetch programme + today's completions ──────────────────────────────────
  const fetchProgramme = useCallback(async () => {
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
        .select('*, exercise:exercises(*)')
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

      // Load today's existing completions so inline buttons reflect prior logging
      const { data: todayLog } = await supabase
        .from('compliance_logs')
        .select('id')
        .eq('client_id', profile.id)
        .eq('programme_id', prog.id)
        .eq('log_date', today)
        .maybeSingle();

      if (todayLog) {
        const { data: exCompletions } = await supabase
          .from('exercise_completions')
          .select('*')
          .eq('compliance_log_id', todayLog.id);

        if (exCompletions?.length) {
          const map = {};
          exCompletions.forEach(ec => {
            const prescribed = ec.sets_prescribed;
            const done = ec.sets_completed;
            const type = !ec.completed
              ? 'skipped'
              : (done != null && prescribed != null && done < prescribed)
              ? 'partial'
              : 'full';
            map[ec.programme_exercise_id] = { type, sets: done ?? null };
          });
          setCompletions(map);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [profile.id, today]);

  useEffect(() => { fetchProgramme(); }, [fetchProgramme]);

  // ── Ensure a compliance_log exists for today, return its id ───────────────
  async function ensureTodayLog() {
    const { data: existing } = await supabase
      .from('compliance_logs')
      .select('id')
      .eq('client_id', profile.id)
      .eq('programme_id', programme.id)
      .eq('log_date', today)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created } = await supabase
      .from('compliance_logs')
      .insert({
        client_id: profile.id,
        programme_id: programme.id,
        log_date: today,
        status: 'partial',
        exercises_completed: 0,
        exercises_total: exercises.length,
      })
      .select()
      .single();

    return created?.id;
  }

  // ── Mark an exercise inline ────────────────────────────────────────────────
  async function markExercise(peId, type, setsCount, prescribedSets) {
    const logId = await ensureTodayLog();
    if (!logId) return;

    const isCompleted = type === 'full' || type === 'partial';

    await supabase
      .from('exercise_completions')
      .upsert(
        {
          compliance_log_id: logId,
          programme_exercise_id: peId,
          completed: isCompleted,
          sets_completed: setsCount ?? null,
          sets_prescribed: prescribedSets ?? null,
        },
        { onConflict: 'compliance_log_id,programme_exercise_id' }
      );

    const updatedCompletions = {
      ...completions,
      [peId]: { type, sets: setsCount },
    };
    setCompletions(updatedCompletions);
    setShowPartialPicker(null);

    // Keep the compliance_log status in sync
    const completedCount = Object.values(updatedCompletions)
      .filter(c => c.type === 'full' || c.type === 'partial').length;
    const status = completedCount === 0 ? 'missed'
      : completedCount === exercises.length ? 'completed'
      : 'partial';

    await supabase
      .from('compliance_logs')
      .update({ status, exercises_completed: completedCount })
      .eq('id', logId);
  }

  function clearExercise(peId) {
    setCompletions(prev => {
      const next = { ...prev };
      delete next[peId];
      return next;
    });
  }

  function toggleExercise(id) {
    setExpandedExercise(prev => prev === id ? null : id);
    setShowPartialPicker(null);
  }

  function onSessionLogged() {
    setRefreshTrigger(t => t + 1);
    setShowLogModal(false);
    fetchProgramme();
  }

  // ── Summary counts ─────────────────────────────────────────────────────────
  const fullCount = Object.values(completions).filter(c => c.type === 'full').length;
  const partialCount = Object.values(completions).filter(c => c.type === 'partial').length;
  const anyLogged = fullCount + partialCount > 0;
  const allDone = fullCount === exercises.length && exercises.length > 0;

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

      {/* ── Sticky header ── */}
      <header ref={headerRef} style={styles.header}>
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

      {/* ── Main content ── */}
      <main style={styles.main}>

        {/* ════════ EXERCISES TAB ════════ */}
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

                {/* Section header row */}
                <div style={styles.sectionHeader}>
                  <span>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {anyLogged && (
                      <span style={styles.progressPill}>
                        {fullCount + partialCount}/{exercises.length} done{allDone ? ' 🎉' : ''}
                      </span>
                    )}
                    {programme.review_date && (
                      <span style={styles.reviewDate}>
                        <Calendar size={12} />
                        Review: {new Date(programme.review_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Exercise cards */}
                {exercises.map((pe, idx) => {
                  const ex = pe.exercise;
                  const isExpanded = expandedExercise === pe.id;
                  const sets = pe.sets || ex?.default_sets;
                  const reps = pe.reps || ex?.default_reps;
                  const hold = pe.hold_seconds || ex?.default_hold_seconds;
                  const rest = pe.rest_seconds || ex?.default_rest_seconds;
                  const freq = pe.frequency_per_week ?? 3;
                  const completion = completions[pe.id] ?? null;
                  const setsArray = sets ? Array.from({ length: sets }, (_, i) => i + 1) : [1, 2, 3];
                  const isPickingPartial = showPartialPicker === pe.id;
                  const { intro, steps, safety } = parseDescription(ex?.description);

                  const borderAccent = completion?.type === 'full'
                    ? '4px solid var(--success)'
                    : completion?.type === 'partial'
                    ? '4px solid var(--terracotta)'
                    : '4px solid transparent';

                  return (
                    <div
                      key={pe.id}
                      className="card"
                      style={{
                        ...styles.exerciseCard,
                        animationDelay: `${idx * 0.05}s`,
                        borderLeft: borderAccent,
                      }}
                    >
                      {/* ── Card top: name + meta + completion buttons ── */}
                      <button
                        onClick={() => toggleExercise(pe.id)}
                        style={styles.exerciseHeader}
                        aria-expanded={isExpanded}
                      >
                        <div style={styles.exerciseHeaderLeft}>
                          <div style={styles.exerciseNumber}>{idx + 1}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={styles.exerciseName}>{ex?.name}</div>
                            <div style={styles.exerciseMeta}>
                              {sets && <span style={styles.metaItem}><RotateCcw size={11} /> {sets} sets</span>}
                              {reps && <span style={styles.metaItem}>× {reps}</span>}
                              {hold && <span style={styles.metaItem}><Clock size={11} /> {hold}s hold</span>}
                              <span style={styles.freqPill}>{freq}× / week</span>
                            </div>
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp size={18} color="var(--navy)" style={{ flexShrink: 0 }} />
                          : <ChevronDown size={18} color="var(--navy)" style={{ flexShrink: 0 }} />}
                      </button>

                      {/* Completion buttons — always visible below the name */}
                      <div style={styles.completionRow}>
                        {!completion && !isPickingPartial && (
                          <>
                            <button
                              onClick={() => markExercise(pe.id, 'full', sets, sets)}
                              style={styles.btnDone}
                            >
                              <CheckCircle2 size={13} /> Done
                            </button>
                            <button
                              onClick={() => setShowPartialPicker(pe.id)}
                              style={styles.btnPartial}
                            >
                              Partial
                            </button>
                            <button
                              onClick={() => markExercise(pe.id, 'skipped', 0, sets)}
                              style={styles.btnSkip}
                            >
                              Skip
                            </button>
                          </>
                        )}

                        {/* Partial: pick sets done */}
                        {isPickingPartial && (
                          <div style={styles.partialPicker}>
                            <span style={styles.partialLabel}>Sets done:</span>
                            {setsArray.map(n => (
                              <button
                                key={n}
                                onClick={() => markExercise(pe.id, 'partial', n, sets)}
                                style={styles.setBtn}
                              >
                                {n}
                              </button>
                            ))}
                            <button
                              onClick={() => setShowPartialPicker(null)}
                              style={styles.cancelBtn}
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {/* Already logged */}
                        {completion && !isPickingPartial && (
                          <div style={styles.loggedState}>
                            {completion.type === 'full' && (
                              <span style={styles.loggedFull}><CheckCircle2 size={13} /> Done</span>
                            )}
                            {completion.type === 'partial' && (
                              <span style={styles.loggedPartial}>{completion.sets}/{sets} sets</span>
                            )}
                            {completion.type === 'skipped' && (
                              <span style={styles.loggedSkip}>Skipped</span>
                            )}
                            <button
                              onClick={() => clearExercise(pe.id)}
                              style={styles.changeBtn}
                            >
                              Change
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── Expanded body ── */}
                      {isExpanded && (
                        <div style={styles.exerciseBody} className="slide-up">

                          {/* Params tiles */}
                          <div style={styles.exerciseParams}>
                            {sets && <div style={styles.param}><span style={styles.paramLabel}>Sets</span><span style={styles.paramValue}>{sets}</span></div>}
                            {reps && <div style={styles.param}><span style={styles.paramLabel}>Reps</span><span style={styles.paramValue}>{reps}</span></div>}
                            {hold && <div style={styles.param}><span style={styles.paramLabel}>Hold</span><span style={styles.paramValue}>{hold}s</span></div>}
                            {rest && <div style={styles.param}><span style={styles.paramLabel}>Rest</span><span style={styles.paramValue}>{rest}s</span></div>}
                            <div style={styles.param}><span style={styles.paramLabel}>Per week</span><span style={styles.paramValue}>{freq}×</span></div>
                          </div>

                          {/* Intro paragraph */}
                          {intro && (
                            <p style={styles.introText}>{intro}</p>
                          )}

                          {/* Numbered steps — each in its own row */}
                          {steps.length > 0 && (
                            <div style={styles.stepsContainer}>
                              {steps.map((step, i) => (
                                <div key={i} style={styles.stepRow}>
                                  <div style={styles.stepNumber}>{i + 1}</div>
                                  <p style={styles.stepText}>{step}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Safety note */}
                          {safety && (
                            <div style={styles.safetyBox}>
                              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                              <p style={{ margin: 0 }}>{safety}</p>
                            </div>
                          )}

                          {/* Carole's notes for this client */}
                          {pe.client_notes && (
                            <div style={styles.clientNotes}>
                              <Info size={13} />
                              <p>{pe.client_notes}</p>
                            </div>
                          )}

                          {/* Video — loads on tap to avoid auto-embed lag */}
                          {ex?.video_url && (
                            <div style={{ marginTop: '1rem' }}>
                              {!showVideo[pe.id] ? (
                                <button
                                  onClick={() => setShowVideo(prev => ({ ...prev, [pe.id]: true }))}
                                  style={styles.videoToggle}
                                >
                                  <Play size={14} /> Watch video guide
                                </button>
                              ) : (
                                <VideoPlayer url={ex.video_url} type={ex.video_type} title={ex.name} />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}


              </div>
            )}
          </div>
        )}

        {/* ════════ INFORMATION TAB ════════ */}
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
                        {renderMarkdown(item.content)}
                      </div>
                      <div style={styles.infoDate}>
                        {new Date(item.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════ PROGRESS TAB ════════ */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
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
  progressPill: {
    background: 'var(--navy)',
    color: 'var(--cream)',
    borderRadius: '99px',
    padding: '0.15rem 0.6rem',
    fontSize: '0.72rem',
    fontWeight: 600,
    opacity: 1,
    letterSpacing: '0.02em',
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
    transition: 'border-left-color 0.2s',
  },
  exerciseHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1rem 0.5rem',
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
  freqPill: {
    fontSize: '0.7rem',
    background: 'rgba(196,122,90,0.12)',
    color: 'var(--terracotta)',
    borderRadius: '99px',
    padding: '0.1rem 0.5rem',
    fontWeight: 600,
  },
  completionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0 1rem 0.85rem',
    flexWrap: 'wrap',
  },
  btnDone: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.35rem 0.8rem',
    borderRadius: '99px',
    border: '1.5px solid var(--success)',
    background: 'transparent',
    color: 'var(--success)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  btnPartial: {
    padding: '0.35rem 0.8rem',
    borderRadius: '99px',
    border: '1.5px solid var(--terracotta)',
    background: 'transparent',
    color: 'var(--terracotta)',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  btnSkip: {
    padding: '0.35rem 0.8rem',
    borderRadius: '99px',
    border: '1.5px solid #ccc',
    background: 'transparent',
    color: '#999',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 0.15s',
  },
  partialPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    flexWrap: 'wrap',
  },
  partialLabel: {
    fontSize: '0.75rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
  },
  setBtn: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '1.5px solid var(--terracotta)',
    background: 'transparent',
    color: 'var(--terracotta)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  cancelBtn: {
    padding: '0.2rem 0.5rem',
    border: 'none',
    background: 'transparent',
    color: '#999',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  loggedState: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  loggedFull: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    color: 'var(--success)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  loggedPartial: {
    color: 'var(--terracotta)',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  loggedSkip: {
    color: '#999',
    fontSize: '0.8rem',
  },
  changeBtn: {
    fontSize: '0.72rem',
    color: 'var(--terracotta)',
    textDecoration: 'underline',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    padding: 0,
  },
  exerciseBody: {
    padding: '0 1rem 1rem',
    borderTop: '1px solid var(--cream-dark)',
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
  introText: {
    fontSize: '0.875rem',
    lineHeight: 1.7,
    color: 'var(--charcoal)',
    marginBottom: '1rem',
    paddingBottom: '0.75rem',
    borderBottom: '1px solid var(--cream-dark)',
  },
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    marginBottom: '0.75rem',
  },
  stepRow: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-start',
    background: 'var(--cream)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.75rem',
  },
  stepNumber: {
    flexShrink: 0,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--navy)',
    color: 'var(--cream)',
    fontSize: '0.72rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.15rem',
  },
  stepText: {
    margin: 0,
    fontSize: '0.875rem',
    lineHeight: 1.65,
    color: 'var(--charcoal)',
    flex: 1,
  },
  safetyBox: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    background: 'rgba(234,179,8,0.08)',
    border: '1px solid rgba(234,179,8,0.3)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.75rem',
    marginBottom: '0.75rem',
    fontSize: '0.835rem',
    lineHeight: 1.6,
    color: '#7a5f00',
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
  videoToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'none',
    border: 'none',
    color: 'var(--navy)',
    fontSize: '0.85rem',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    padding: 0,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
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
    padding: '1.25rem 1.25rem 1rem',
    borderBottom: '1px solid var(--cream-dark)',
  },
};
