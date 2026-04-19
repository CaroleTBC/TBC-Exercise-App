import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

export default function LogSessionModal({ programme, exercises, onClose, onLogged }) {
  const { user } = useAuth();
  const [completions, setCompletions] = useState({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingLog, setExistingLog] = useState(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    checkExistingLog();
    // Default all to completed
    const initial = {};
    exercises.forEach(pe => { initial[pe.id] = true; });
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

  function toggleExercise(id) {
    setCompletions(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function selectAll(val) {
    const updated = {};
    exercises.forEach(pe => { updated[pe.id] = val; });
    setCompletions(updated);
  }

  async function handleSubmit() {
    setLoading(true);
    const completedCount = Object.values(completions).filter(Boolean).length;
    const total = exercises.length;

    const status = completedCount === 0
      ? 'missed'
      : completedCount === total
      ? 'completed'
      : 'partial';

    try {
      let logId;

      if (existingLog) {
        const { data } = await supabase
          .from('compliance_logs')
          .update({
            status,
            exercises_completed: completedCount,
            exercises_total: total,
            notes: notes || null,
          })
          .eq('id', existingLog.id)
          .select()
          .single();
        logId = data.id;
      } else {
        const { data } = await supabase
          .from('compliance_logs')
          .insert({
            client_id: user.id,
            programme_id: programme.id,
            log_date: today,
            status,
            exercises_completed: completedCount,
            exercises_total: total,
            notes: notes || null,
          })
          .select()
          .single();
        logId = data.id;
      }

      // Log individual exercise completions
      if (logId) {
        const completionRows = exercises.map(pe => ({
          compliance_log_id: logId,
          programme_exercise_id: pe.id,
          completed: !!completions[pe.id],
        }));

        await supabase.from('exercise_completions')
          .upsert(completionRows, { onConflict: 'compliance_log_id,programme_exercise_id' });
      }

      onLogged();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const completedCount = Object.values(completions).filter(Boolean).length;
  const total = exercises.length;
  const allDone = completedCount === total;
  const noneDone = completedCount === 0;

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
                width: `${(completedCount / total) * 100}%`,
                background: allDone ? 'var(--success)' : noneDone ? '#ddd' : 'var(--terracotta)',
              }} />
            </div>
            <span style={styles.progressText}>
              {completedCount} of {total} exercises
            </span>
          </div>

          {/* Quick select */}
          <div style={styles.quickSelect}>
            <button onClick={() => selectAll(true)} className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <CheckCircle2 size={14} /> All done
            </button>
            <button onClick={() => selectAll(false)} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
              <Circle size={14} /> Clear all
            </button>
          </div>

          {/* Exercise list */}
          <div style={styles.exerciseList}>
            {exercises.map(pe => {
              const ex = pe.exercise;
              const done = completions[pe.id];
              return (
                <button
                  key={pe.id}
                  onClick={() => toggleExercise(pe.id)}
                  style={{
                    ...styles.exerciseRow,
                    background: done ? 'var(--success-bg)' : 'var(--off-white)',
                    borderColor: done ? 'var(--success)' : 'var(--cream-dark)',
                  }}
                >
                  {done
                    ? <CheckCircle2 size={20} color="var(--success)" />
                    : <Circle size={20} color="var(--cream-dark)" />
                  }
                  <div style={styles.exName}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ex?.name}</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{ex?.category}</span>
                  </div>
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
              placeholder="How did it feel? Any pain or difficulty?"
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={loading}
            style={{ gap: '0.5rem' }}
          >
            {loading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : null}
            {loading ? 'Saving...' : allDone ? '✅ Log full session' : noneDone ? 'Mark as missed' : '🟡 Log partial session'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  existingNote: {
    background: 'var(--warning-bg)',
    color: 'var(--warning)',
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
    minWidth: '70px',
  },
  quickSelect: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  exerciseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  exerciseRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.65rem 0.9rem',
    border: '1.5px solid',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  },
  exName: {
    display: 'flex',
    flexDirection: 'column',
  },
};
