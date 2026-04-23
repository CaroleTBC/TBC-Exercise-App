import React, { useEffect, useState } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { CheckCircle2, Circle, MinusCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_CONFIG = {
  completed: {
    label: 'Done',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: CheckCircle2,
    emoji: '✅',
  },
  partial: {
    label: 'Partial',
    color: 'var(--partial)',
    bg: 'var(--partial-bg)',
    icon: MinusCircle,
    emoji: '🟡',
  },
  missed: {
    label: 'Missed',
    color: '#ccc',
    bg: '#f5f5f5',
    icon: Circle,
    emoji: '○',
  },
  none: {
    label: 'No data',
    color: '#ddd',
    bg: '#fafafa',
    icon: Circle,
    emoji: '○',
  },
};

export default function ComplianceTracker({ programmeId, onLogToday }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);

  const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));

  useEffect(() => {
    if (!programmeId || !user) return;
    fetchLogs();
  }, [programmeId, user]);

  async function fetchLogs() {
    try {
      const since = subDays(new Date(), 14).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('compliance_logs')
        .select('*')
        .eq('client_id', user.id)
        .eq('programme_id', programmeId)
        .gte('log_date', since)
        .order('log_date', { ascending: true });
      if (error) throw error;

      const logData = data || [];
      setLogs(logData);

      // Calculate streak — skip today if not yet logged, then count backwards
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let s = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        const dayStr = format(days[i], 'yyyy-MM-dd');
        if (dayStr === todayStr && !logData.find(l => l.log_date === dayStr)) {
          continue;
        }
        const log = logData.find(l => l.log_date === dayStr);
        if (log && (log.status === 'completed' || log.status === 'partial')) {
          s++;
        } else {
          break;
        }
      }
      setStreak(s);
      setCompletedCount(logData.filter(l => l.status === 'completed').length);
    } catch (err) {
      console.error('Failed to load compliance logs:', err);
    } finally {
      setLoading(false);
    }
  }

  function getLogForDay(day) {
    const dayStr = format(day, 'yyyy-MM-dd');
    return logs.find(l => l.log_date === dayStr) || null;
  }

  function getStatusConfig(log) {
    if (!log) return STATUS_CONFIG.none;
    return STATUS_CONFIG[log.status] || STATUS_CONFIG.none;
  }

  const today = new Date();
  const todayLog = getLogForDay(today);

  if (loading) {
    return (
      <div style={styles.loadingWrapper}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.wrapper} className="fade-in">
      {/* Header Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{streak}</span>
          <span style={styles.statLabel}>day streak 🔥</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{completedCount}</span>
          <span style={styles.statLabel}>full sessions</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{logs.filter(l => l.status !== 'missed').length}</span>
          <span style={styles.statLabel}>days active</span>
        </div>
      </div>

      {/* Encouragement message */}
      {streak > 0 && (
        <div style={styles.encouragement}>
          {streak >= 7
            ? `Outstanding — ${streak} days straight. Your bones are adapting. 💪`
            : streak >= 3
            ? `${streak} days in a row. Keep building on it.`
            : `Good start — ${streak} day${streak > 1 ? 's' : ''} in a row.`}
        </div>
      )}

      {/* 14-day grid */}
      <div style={styles.gridLabel}>Last 14 days</div>
      <div style={styles.grid}>
        {days.map((day, i) => {
          const log = getLogForDay(day);
          const config = getStatusConfig(log);
          const isToday = isSameDay(day, today);
          const isFuture = day > today;
          const IconComponent = config.icon;

          return (
            <div
              key={i}
              style={{
                ...styles.dayCell,
                opacity: isFuture ? 0.3 : 1,
              }}
              title={`${format(day, 'EEE d MMM')} — ${config.label}`}
            >
              <span style={styles.dayName}>{format(day, 'EEE')}</span>
              <div
                style={{
                  ...styles.dayDot,
                  background: config.bg,
                  border: isToday ? `2px solid var(--navy)` : '2px solid transparent',
                }}
              >
                <IconComponent
                  size={14}
                  color={config.color}
                  strokeWidth={2.5}
                />
              </div>
              <span style={{
                ...styles.dayNum,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--navy)' : 'var(--charcoal)',
              }}>
                {format(day, 'd')}
              </span>
              {log && log.status === 'partial' && log.exercises_completed > 0 && (
                <span style={styles.partialText}>
                  {log.exercises_completed}/{log.exercises_total}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'none').map(([key, val]) => {
          const Icon = val.icon;
          return (
            <div key={key} style={styles.legendItem}>
              <Icon size={12} color={val.color} />
              <span>{val.label}</span>
            </div>
          );
        })}
      </div>

      {/* Today's action */}
      {!todayLog && onLogToday && (
        <button
          onClick={onLogToday}
          style={styles.logBtn}
          className="btn btn-secondary"
        >
          Log today's session
          <ChevronRight size={16} />
        </button>
      )}

      {todayLog && (
        <div style={{
          ...styles.todayStatus,
          background: getStatusConfig(todayLog).bg,
          color: getStatusConfig(todayLog).color,
        }}>
          {todayLog.status === 'completed'
            ? "Today's session is logged — well done! ✅"
            : todayLog.status === 'partial'
            ? `Partial session logged today (${todayLog.exercises_completed} of ${todayLog.exercises_total} exercises)`
            : "Today marked as missed"}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    padding: '1.25rem',
  },
  loadingWrapper: {
    display: 'flex',
    justifyContent: 'center',
    padding: '2rem',
  },
  statsRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1rem',
  },
  statCard: {
    flex: 1,
    background: 'var(--cream)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 0.5rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  statNumber: {
    fontSize: '1.5rem',
    fontFamily: 'var(--font-serif)',
    fontWeight: 600,
    color: 'var(--navy)',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  encouragement: {
    background: 'rgba(47,69,111,0.06)',
    borderLeft: '3px solid var(--navy)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    padding: '0.6rem 0.9rem',
    fontSize: '0.875rem',
    color: 'var(--navy)',
    marginBottom: '1.25rem',
    fontStyle: 'italic',
  },
  gridLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--navy)',
    opacity: 0.6,
    marginBottom: '0.5rem',
    fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.35rem',
    marginBottom: '0.75rem',
  },
  dayCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.25rem 0',
  },
  dayName: {
    fontSize: '0.62rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--charcoal)',
    opacity: 0.5,
  },
  dayDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  dayNum: {
    fontSize: '0.7rem',
    opacity: 0.7,
  },
  partialText: {
    fontSize: '0.55rem',
    color: 'var(--partial)',
    opacity: 0.8,
  },
  legend: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginTop: '0.5rem',
    marginBottom: '1rem',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    fontSize: '0.72rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
  },
  logBtn: {
    width: '100%',
    justifyContent: 'center',
    padding: '0.75rem',
    fontSize: '0.95rem',
    marginTop: '0.25rem',
  },
  todayStatus: {
    textAlign: 'center',
    padding: '0.75rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
};
