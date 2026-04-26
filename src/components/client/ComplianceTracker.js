import React, { useEffect, useState } from 'react';
import { format, subDays, isSameDay } from 'date-fns';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

const STATUS_CONFIG = {
  completed: {
    label: 'Full session',
    color: 'var(--success)',
    bg: 'var(--success-bg)',
    icon: CheckCircle2,
  },
  partial: {
    label: 'Active',
    color: 'var(--terracotta)',
    bg: 'rgba(196,122,90,0.15)',
    icon: CheckCircle2,   // same icon, different colour — still a win
  },
  missed: {
    label: 'Rest day',
    color: '#b0b0b0',
    bg: '#f2f2f2',
    icon: Circle,
  },
  none: {
    label: '',
    color: '#ddd',
    bg: '#fafafa',
    icon: Circle,
  },
};

function getEncouragement(streak, activeDays) {
  if (streak >= 14) return "Two full weeks without a break — extraordinary. 🌟";
  if (streak >= 7)  return `${streak} days straight. Your body is responding to this. 💪`;
  if (streak >= 5)  return `${streak} days in a row — this is becoming a habit.`;
  if (streak >= 3)  return `${streak} days running. Keep that momentum going.`;
  if (streak >= 1)  return `${streak} day${streak > 1 ? 's' : ''} active — every session adds up.`;
  if (activeDays >= 8) return "Consistent over the past two weeks — that's what counts.";
  if (activeDays >= 3) return "Some days on, some days off — that's real life, and it still works.";
  if (activeDays >= 1) return "Any exercise is better than none. You're building something.";
  return null;
}

export default function ComplianceTracker({ programmeId, onLogToday, userId: userIdProp, readOnly }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [fullSessions, setFullSessions] = useState(0);

  const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));

  useEffect(() => {
    const clientId = userIdProp || user?.id;
    if (!programmeId || !clientId) return;
    fetchLogs();
  }, [programmeId, user, userIdProp]);

  async function fetchLogs() {
    const clientId = userIdProp || user?.id;
    try {
      const since = subDays(new Date(), 14).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('compliance_logs')
        .select('*')
        .eq('client_id', clientId)
        .eq('programme_id', programmeId)
        .gte('log_date', since)
        .order('log_date', { ascending: true });
      if (error) throw error;

      const logData = data || [];
      setLogs(logData);

      // Streak: any active day (completed or partial) counts
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      let s = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        const dayStr = format(days[i], 'yyyy-MM-dd');
        if (dayStr === todayStr && !logData.find(l => l.log_date === dayStr)) continue;
        const log = logData.find(l => l.log_date === dayStr);
        if (log && (log.status === 'completed' || log.status === 'partial')) {
          s++;
        } else {
          break;
        }
      }
      setStreak(s);
      setActiveDays(logData.filter(l => l.status === 'completed' || l.status === 'partial').length);
      setFullSessions(logData.filter(l => l.status === 'completed').length);
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
  const encouragement = getEncouragement(streak, activeDays);

  if (loading) {
    return <div style={styles.loadingWrapper}><span className="spinner" /></div>;
  }

  return (
    <div style={styles.wrapper} className="fade-in">
      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{streak}</span>
          <span style={styles.statLabel}>day streak 🔥</span>
        </div>
        <div style={{ ...styles.statCard, background: 'rgba(196,122,90,0.1)' }}>
          <span style={styles.statNumber}>{activeDays}</span>
          <span style={styles.statLabel}>active days</span>
        </div>
        <div style={styles.statCard}>
          <span style={styles.statNumber}>{fullSessions}</span>
          <span style={styles.statLabel}>full sessions</span>
        </div>
      </div>

      {/* Encouragement */}
      {encouragement && (
        <div style={styles.encouragement}>{encouragement}</div>
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
              style={{ ...styles.dayCell, opacity: isFuture ? 0.25 : 1 }}
              title={`${format(day, 'EEE d MMM')}${log ? ` — ${config.label}` : ''}`}
            >
              <span style={styles.dayName}>{format(day, 'EEE')}</span>
              <div style={{
                ...styles.dayDot,
                background: config.bg,
                border: isToday ? '2px solid var(--navy)' : '2px solid transparent',
              }}>
                <IconComponent size={14} color={config.color} strokeWidth={2.5} />
              </div>
              <span style={{
                ...styles.dayNum,
                fontWeight: isToday ? 700 : 400,
                color: isToday ? 'var(--navy)' : 'var(--charcoal)',
              }}>
                {format(day, 'd')}
              </span>
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
      {!readOnly && !todayLog && onLogToday && (
        <button onClick={onLogToday} style={styles.logBtn} className="btn btn-secondary">
          Log today's session
          <ChevronRight size={16} />
        </button>
      )}

      {todayLog && (
        <div style={{
          ...styles.todayStatus,
          background: getStatusConfig(todayLog).bg,
          borderLeft: `3px solid ${getStatusConfig(todayLog).color}`,
        }}>
          {todayLog.status === 'completed'
            ? "Full session logged today — excellent work! ✅"
            : todayLog.status === 'partial'
            ? "Session logged today — doing something always counts ✅"
            : "Rest day logged."}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrapper: { padding: '1.25rem' },
  loadingWrapper: { display: 'flex', justifyContent: 'center', padding: '2rem' },
  statsRow: { display: 'flex', gap: '0.75rem', marginBottom: '1rem' },
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
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--navy)',
    background: 'var(--cream)',
  },
};
