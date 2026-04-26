import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

// Cycles: done → partial → skipped → done
const STATES = ['done', 'partial', 'skipped'];
const STATE_CONFIG = {
  done:    { label: 'Done',     icon: CheckCircle2, color: 'var(--success)',    bg: 'var(--success-bg)',             border: 'var(--success)' },
  partial: { label: 'Partial',  icon: MinusCircle,  color: 'var(--terracotta)', bg: 'rgba(196,122,90,0.08)',         border: 'var(--terracotta)' },
  skipped: { label: 'Not done', icon: Circle,       color: 'var(--cream-dark)', bg: 'var(--off-white, #f9f8f6)',     border: 'var(--cream-dark)' },
};

export default function LogSessionModal({ programme, exercises, onClose, onLogged }) {
  const { user } = useAuth();
  const [completions, setCompletions] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [existingLog, setExistingLog] = useState(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    checkExistingLog();
    const initial = {};
    exercises.forEach(pe => { initial[pe.id] = 'done'; });
    setCompletions(initial);
  }, [exercises]);

  async function checkExistingLog() {
    const { data } = await supabase
      .from('compliance_logs')
      .select('*')
      .eq('client_id', user.id)
      .eq('programme_id', programme.id)
      .eq('log_date', today)
      .single();
    if (data) setExistingLog(data);
  }

  function cycleExercise(id) {
    setCompletions(prev => {
      const current = prev[id] || 'done';
      const next = STATES[(STATES.indexOf(current) + 1) % STATES.length];
      return { ...prev, [id]: next };
    });
  }

  function selectAll(state) {
    const updated = {};
    exercises.forEach(pe => { updated[pe.id] = state; });
    setCompletions(updated);
  }

  async function handleSubmit() {
    setLoading(true);
    setSubmitError('');
    const doneCount = Object.values(completions).filter(v => v === 'done').length;
    const partialCount = Object.values(completions).filter(v => v === 'partial').length;
    const total = exercises.length;
    const status = doneCount === total
      ? 'completed'
      : doneCount === 0 && partialCount === 0
      ? 'missed'
      : 'partial';

    try {
      let logId;
      const logPayload = {
        status,
        exercises_completed: doneCount,
        exercises_total: total,
        notes: notes || null,
      };

      if (existingLog) {
        const { data } = await supabase
          .from('compliance_logs')
          .update(logPayload)
          .eq('id', existingLog.id)
          .select()
          .single();
        logId = data.id;
      } else {
        const { data } = await supabase
          .from('compliance_logs')
          .insert({ client_id: user.id, programme_id: programme.id, log_date: today, ...logPayload })
          .select()
          .single();
        logId = data.id;
      }

      if (logId) {
        const completionRows = exercises.map(pe => ({
          compliance_log_id: logId,
          programme_exercise_id: pe.id,
          completed: completions[pe.id] === 'done',
          notes: completions[pe.id] === 'partial' ? 'partial' : null,
        }));
        await supabase.from('exercise_completions')
          .upsert(completionRows, { onConflict: 'compliance_log_id,programme_exercise_id' });
      }

      onLogged();
    } catch (err) {
      setSubmitError('Failed to save your session. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const doneCount = Object.values(completions).filter(v => v === 'done').length;
  const partialCount = Object.values(completions).filter(v => v === 'partial').length;
  const total = exercises.length;
  const allDone = doneCount === total;
  const noneDone = doneCount === 0 && partialCount === 0;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.3rem' }}>Log today's session</h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>
              {format(new Date(), 'EEEE d MMMM yyyy')}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {existingLog && (
            <div style={styles.existingNote}>
              You've already logged today — you can update it here.
            </div>
          )}

          {/* Progress bar */}
          <div style={styles.progressBarWrapper}>
            <div style={styles.progressBarTrack}>
              <div style={{
                ...styles.progressBarFill,
                width: total > 0 ? `${(doneCount / total) * 100}%` : '0%',
                background: allDone ? 'var(--success)' : noneDone ? '#ddd' : 'var(--terracotta)',
              }} />
            </div>
            <span style={styles.progressText}>
              {doneCount === total
                ? `All ${total} done ✅`
                : `${doneCount} of ${total} done`}
            </span>
          </div>

          {/* Quick select */}
          <div style={styles.quickSelect}>
            <button onClick={() => selectAll('done')} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <CheckCircle2 size={14} /> All done
            </button>
            <button onClick={() => selectAll('skipped')} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <Circle size={14} /> Clear all
            </button>
          </div>

          <p style={styles.tapHint}>Tap each exercise to cycle: Done → Partial → Not done</p>

          {/* Exercise list */}
          <div style={styles.exerciseList}>
            {exercises.map(pe => {
              const ex = pe.exercise;
              const state = completions[pe.id] || 'done';
              const cfg = STATE_CONFIG[state];
              const Icon = cfg.icon;
              const sets = pe.sets || ex?.default_sets;
              const reps = pe.reps || ex?.default_reps;
              const metaParts = [sets && `${sets} sets`, reps && `${reps} reps`].filter(Boolean);
              return (
                <button
                  key={pe.id}
                  onClick={() => cycleExercise(pe.id)}
                  style={{
                    ...styles.exerciseRow,
                    background: cfg.bg,
                    borderColor: cfg.border,
                  }}
                >
                  <Icon size={22} color={cfg.color} strokeWidth={2} />
                  <div style={styles.exInfo}>
                    <span style={styles.exName}>{ex?.name}</span>
                    {metaParts.length > 0 && (
                      <span style={styles.exMeta}>{metaParts.join(' · ')}</span>
                    )}
                  </div>
                  <span style={{ ...styles.stateLabel, color: cfg.color, opacity: state === 'skipped' ? 0.5 : 1 }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: '1rem', marginBottom: 0 }}>
            <label className="form-label">Session notes (optional)</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did it feel? Any pain or difficulty? Anything to tell Carole?"
              rows={3}
            />
          </div>
        </div>

        {submitError && (
          <div style={styles.errorBanner}>{submitError}</div>
        )}

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={loading}
            style={{ gap: '0.5rem' }}
          >
            {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : null}
            {loading ? 'Saving…'
              : allDone ? '✅ Log full session'
              : noneDone ? 'Mark as missed'
              : `🟡 Log session (${doneCount} done${partialCount > 0 ? `, ${partialCount} partial` : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  existingNote: {
    background: 'var(--warning-bg, #fff9e6)',
    color: 'var(--warning, #b07d00)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.6rem 0.9rem',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  },
  progressBarWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  progressBarTrack: {
    flex: 1,
    height: '8px',
    background: 'var(--cream-dark)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease, background 0.3s',
  },
  progressText: {
    fontSize: '0.8rem',
    color: 'var(--navy)',
    opacity: 0.7,
    whiteSpace: 'nowrap',
    minWidth: '80px',
  },
  quickSelect: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  tapHint: {
    fontSize: '0.75rem',
    color: 'var(--charcoal)',
    opacity: 0.5,
    marginBottom: '0.75rem',
    fontStyle: 'italic',
  },
  exerciseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    maxHeight: '320px',
    overflowY: 'auto',
  },
  exerciseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.7rem 0.9rem',
    border: '1.5px solid',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
    width: '100%',
  },
  exInfo: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  exName: {
    fontWeight: 500,
    fontSize: '0.9rem',
    color: 'var(--navy)',
  },
  exMeta: {
    fontSize: '0.72rem',
    color: 'var(--charcoal)',
    opacity: 0.6,
    marginTop: '0.1rem',
  },
  stateLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  errorBanner: {
    margin: '0 1.5rem 0.75rem',
    padding: '0.65rem 0.9rem',
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.875rem',
  },
};
