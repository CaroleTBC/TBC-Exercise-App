import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ComplianceTracker from '../client/ComplianceTracker';
import {
  UserPlus, X, ChevronRight, Plus, Trash2,
  Save, Eye, CheckCircle2, Circle, BarChart2, BookOpen,
  AlertCircle, Search, MessageCircle, Send, Clock
} from 'lucide-react';

export default function ClientManager({ onStatsChange }) {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('programme');
  const [showAddClient, setShowAddClient] = useState(false);
  const [search, setSearch] = useState('');

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
      setError('Failed to load clients.');
    } finally {
      setLoading(false);
    }
  }

  async function inviteClient(form) {
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

  const filteredClients = clients.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {!selectedClient ? (
        <div>
          <div style={styles.pageHeader}>
            <div>
              <h1 style={styles.pageTitle}>Clients</h1>
              <p style={styles.pageSubtitle}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setShowAddClient(true)} className="btn btn-primary">
              <UserPlus size={15} /> Invite Client
            </button>
          </div>

          {error && <div style={styles.errorBanner}>{error}</div>}

          <div style={styles.searchWrapper}>
            <Search size={15} style={styles.searchIcon} />
            <input
              type="search"
              className="form-input"
              style={{ paddingLeft: '2.2rem', marginBottom: '1rem' }}
              placeholder="Search clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {filteredClients.length === 0 ? (
            <div className="empty-state">
              <UserPlus size={40} opacity={0.3} />
              <p>No clients yet. Invite your first client to get started.</p>
            </div>
          ) : (
            <div style={styles.clientList}>
              {filteredClients.map(client => (
                <button
                  key={client.id}
                  onClick={() => { setSelectedClient(client); setActiveClientTab('programme'); }}
                  className="card"
                  style={styles.clientCard}
                >
                  <div style={styles.clientAvatar}>{client.full_name?.charAt(0)}</div>
                  <div style={styles.clientInfo}>
                    <span style={styles.clientName}>{client.full_name}</span>
                    <span style={styles.clientEmail}>{client.email}</span>
                  </div>
                  <ChevronRight size={18} color="var(--navy)" opacity={0.4} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ClientDetail
          client={selectedClient}
          therapistId={profile.id}
          onBack={() => setSelectedClient(null)}
          activeTab={activeClientTab}
          setActiveTab={setActiveClientTab}
        />
      )}

      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onInvite={inviteClient}
        />
      )}
    </div>
  );
}

function ClientDetail({ client, therapistId, onBack, activeTab, setActiveTab }) {
  const [programme, setProgramme] = useState(null);
  const [allExercises, setAllExercises] = useState([]);
  const [programmeExercises, setProgrammeExercises] = useState([]);
  const [information, setInformation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddInfo, setShowAddInfo] = useState(false);

  const [questions, setQuestions] = useState([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [replyDraft, setReplyDraft] = useState({});   // { [questionId]: string }
  const [replySaving, setReplySaving] = useState({}); // { [questionId]: bool }

  const CLIENT_TABS = [
    { id: 'programme', label: 'Programme', icon: CheckCircle2 },
    { id: 'information', label: 'Information', icon: BookOpen },
    { id: 'compliance', label: 'Compliance', icon: BarChart2 },
    { id: 'questions', label: 'Questions', icon: MessageCircle },
  ];

  useEffect(() => {
    fetchData();
  }, [client.id]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data: programmes, error: progErr } = await supabase
        .from('client_programmes')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (progErr) throw progErr;

      let prog = programmes?.[0];

      if (!prog) {
        const { data: newProg, error: createErr } = await supabase
          .from('client_programmes')
          .insert({
            client_id: client.id,
            therapist_id: therapistId,
            name: `${client.full_name.split(' ')[0]}'s Programme`,
          })
          .select()
          .single();
        if (createErr) throw createErr;
        prog = newProg;
      }

      setProgramme(prog);

      const [{ data: progExs, error: exErr }, { data: exLib, error: libErr }, { data: info, error: infoErr }] = await Promise.all([
        supabase
          .from('programme_exercises')
          .select('*, exercise:exercises(*)')
          .eq('programme_id', prog.id)
          .eq('is_active', true)
          .order('sort_order'),
        supabase.from('exercises').select('*').order('name'),
        supabase
          .from('client_information')
          .select('*')
          .eq('client_id', client.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (exErr) throw exErr;
      if (libErr) throw libErr;
      if (infoErr) throw infoErr;

      setProgrammeExercises(progExs || []);
      setAllExercises(exLib || []);
      setInformation(info || []);

      const { data: qs } = await supabase
        .from('client_questions')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (qs) {
        setQuestions(qs);
        setUnansweredCount(qs.filter(q => !q.answer).length);
      }
    } catch (err) {
      setError(err.message || 'Failed to load client data.');
    } finally {
      setLoading(false);
    }
  }

  async function replyToQuestion(questionId) {
    const answer = replyDraft[questionId]?.trim();
    if (!answer) return;
    setReplySaving(prev => ({ ...prev, [questionId]: true }));
    try {
      const { data, error } = await supabase
        .from('client_questions')
        .update({ answer, answered_at: new Date().toISOString() })
        .eq('id', questionId)
        .select()
        .single();
      if (error) throw error;
      setQuestions(prev => prev.map(q => q.id === questionId ? data : q));
      setUnansweredCount(prev => Math.max(0, prev - 1));
      setReplyDraft(prev => { const n = { ...prev }; delete n[questionId]; return n; });
    } catch {
      alert('Failed to save reply. Please try again.');
    } finally {
      setReplySaving(prev => ({ ...prev, [questionId]: false }));
    }
  }

  async function removeExercise(peId) {
    if (!window.confirm('Remove this exercise from the programme?')) return;
    const { error } = await supabase
      .from('programme_exercises')
      .update({ is_active: false })
      .eq('id', peId);
    if (error) { alert('Failed to remove exercise.'); return; }
    setProgrammeExercises(prev => prev.filter(pe => pe.id !== peId));
  }

  async function addExercise(exerciseId, customisation) {
    const { data, error } = await supabase
      .from('programme_exercises')
      .insert({
        programme_id: programme.id,
        exercise_id: exerciseId,
        sort_order: programmeExercises.length,
        ...customisation,
      })
      .select('*, exercise:exercises(*)')
      .single();
    if (error) { alert('Failed to add exercise.'); return; }
    setProgrammeExercises(prev => [...prev, data]);
    setShowAddExercise(false);
  }

  async function updateProgrammeExercise(peId, updates) {
    const { data, error } = await supabase
      .from('programme_exercises')
      .update(updates)
      .eq('id', peId)
      .select('*, exercise:exercises(*)')
      .single();
    if (error) { alert('Failed to update exercise.'); return; }
    setProgrammeExercises(prev => prev.map(pe => pe.id === peId ? data : pe));
  }

  async function addInformation(form) {
    const { data, error } = await supabase
      .from('client_information')
      .insert({ ...form, client_id: client.id, therapist_id: therapistId })
      .select()
      .single();
    if (error) { alert('Failed to add information.'); return; }
    setInformation(prev => [data, ...prev]);
    setShowAddInfo(false);
  }

  async function deleteInfo(id) {
    if (!window.confirm('Delete this information item?')) return;
    const { error } = await supabase.from('client_information').delete().eq('id', id);
    if (error) { alert('Failed to delete.'); return; }
    setInformation(prev => prev.filter(i => i.id !== id));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: '1rem' }}>← Back</button>
        <div style={styles.errorBanner}>{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.clientDetailHeader}>
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
          ← Back
        </button>
        <div style={styles.clientDetailMeta}>
          <div style={styles.clientAvatarLg}>{client.full_name?.charAt(0)}</div>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{client.full_name}</h2>
            <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>{client.email}</p>
          </div>
        </div>
      </div>

      <div style={styles.clientTabs}>
        {CLIENT_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.clientTab,
                ...(activeTab === tab.id ? styles.clientTabActive : {}),
              }}
            >
              <Icon size={14} />
              {tab.label}
              {tab.id === 'questions' && unansweredCount > 0 && (
                <span style={styles.qBadge}>{unansweredCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'programme' && (
        <div style={styles.tabContent} className="fade-in">
          <div style={styles.tabActionBar}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{programme?.name}</h3>
            <button
              onClick={() => setShowAddExercise(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={14} /> Add Exercise
            </button>
          </div>

          {programmeExercises.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={36} opacity={0.3} />
              <p>No exercises assigned yet. Add from the library above.</p>
            </div>
          ) : (
            <div style={styles.programmeList}>
              {programmeExercises.map((pe, idx) => (
                <ProgrammeExerciseRow
                  key={pe.id}
                  pe={pe}
                  idx={idx}
                  onRemove={removeExercise}
                  onUpdate={updateProgrammeExercise}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'information' && (
        <div style={styles.tabContent} className="fade-in">
          <div style={styles.tabActionBar}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Client Information</h3>
            <button
              onClick={() => setShowAddInfo(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
            >
              <Plus size={14} /> Add Article
            </button>
          </div>

          {information.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={36} opacity={0.3} />
              <p>No information articles yet.</p>
            </div>
          ) : (
            information.map(item => (
              <div key={item.id} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                {item.is_pinned && <div style={styles.pinnedBar}>📌 Pinned</div>}
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={styles.infoCategory}>{item.category}</div>
                      <h4 style={{ fontSize: '1rem', margin: '0.25rem 0' }}>{item.title}</h4>
                    </div>
                    <button
                      onClick={() => deleteInfo(item.id)}
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', padding: '0.3rem' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7, marginTop: '0.5rem', lineHeight: 1.6 }}>
                    {item.content.length > 200 ? item.content.substring(0, 200) + '…' : item.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'compliance' && (
        <div style={styles.tabContent} className="fade-in">
          <div className="card">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--cream-dark)' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>14-Day Compliance View</h3>
              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.2rem' }}>
                Read-only view of {client.full_name.split(' ')[0]}'s exercise log
              </p>
            </div>
            {programme && (
              <ComplianceTracker
                programmeId={programme.id}
                userId={client.id}
                readOnly
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div style={styles.tabContent} className="fade-in">
          {questions.length === 0 ? (
            <div className="empty-state">
              <MessageCircle size={36} opacity={0.3} />
              <p>No messages from {client.full_name.split(' ')[0]} yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {questions.map(q => (
                <div key={q.id} className="card" style={{ padding: '1rem' }}>
                  {/* Question */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <MessageCircle size={14} color="var(--navy)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                    <div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--charcoal)', lineHeight: 1.5 }}>{q.question}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--charcoal)', opacity: 0.45, marginTop: '0.2rem' }}>
                        {new Date(q.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Existing answer */}
                  {q.answer ? (
                    <div style={styles.answerBlock}>
                      <CheckCircle2 size={13} color="var(--success)" style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', lineHeight: 1.6 }}>{q.answer}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--charcoal)', opacity: 0.45, marginTop: '0.2rem' }}>
                          Replied {new Date(q.answered_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Reply form */
                    <div style={styles.replyForm}>
                      <div style={styles.pendingLabel}>
                        <Clock size={12} /> Awaiting your reply
                      </div>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Type your reply…"
                        value={replyDraft[q.id] || ''}
                        onChange={e => setReplyDraft(prev => ({ ...prev, [q.id]: e.target.value }))}
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ alignSelf: 'flex-end', fontSize: '0.82rem', padding: '0.45rem 0.9rem', gap: '0.35rem' }}
                        disabled={replySaving[q.id] || !replyDraft[q.id]?.trim()}
                        onClick={() => replyToQuestion(q.id)}
                      >
                        {replySaving[q.id]
                          ? <span className="spinner" style={{ width: '0.9rem', height: '0.9rem', borderWidth: '2px' }} />
                          : <Send size={13} />}
                        Send reply
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddExercise && (
        <AddExerciseModal
          allExercises={allExercises}
          assignedIds={programmeExercises.map(pe => pe.exercise_id)}
          onAdd={addExercise}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {showAddInfo && (
        <AddInfoModal
          onAdd={addInformation}
          onClose={() => setShowAddInfo(false)}
        />
      )}
    </div>
  );
}

function ProgrammeExerciseRow({ pe, idx, onRemove, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    sets: pe.sets ?? pe.exercise?.default_sets ?? '',
    reps: pe.reps ?? pe.exercise?.default_reps ?? '',
    hold_seconds: pe.hold_seconds ?? pe.exercise?.default_hold_seconds ?? '',
    rest_seconds: pe.rest_seconds ?? pe.exercise?.default_rest_seconds ?? '',
    therapist_notes: pe.therapist_notes ?? '',
    client_notes: pe.client_notes ?? '',
    frequency_per_week: pe.frequency_per_week ?? '',
  });

  async function save() {
    await onUpdate(pe.id, {
      sets: form.sets !== '' ? +form.sets : null,
      reps: form.reps || null,
      hold_seconds: form.hold_seconds !== '' ? +form.hold_seconds : null,
      rest_seconds: form.rest_seconds !== '' ? +form.rest_seconds : null,
      therapist_notes: form.therapist_notes || null,
      client_notes: form.client_notes || null,
      frequency_per_week: form.frequency_per_week !== '' ? +form.frequency_per_week : null,
    });
    setEditing(false);
  }

  return (
    <div className="card" style={{ marginBottom: '0.5rem' }}>
      <div style={styles.peRow}>
        <div style={styles.peNum}>{idx + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={styles.peName}>{pe.exercise?.name}</div>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
            <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>{pe.exercise?.category}</span>
            {pe.frequency_per_week && (
              <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(196,122,90,0.15)', color: 'var(--terracotta)' }}>
                {pe.frequency_per_week}× per week
              </span>
            )}
          </div>
        </div>
        <div style={styles.peActions}>
          <button
            onClick={() => setEditing(v => !v)}
            className="btn btn-ghost"
            style={{ padding: '0.3rem', fontSize: '0.75rem' }}
          >
            {editing ? <X size={14} /> : 'Edit'}
          </button>
          <button
            onClick={() => onRemove(pe.id)}
            className="btn btn-ghost"
            style={{ padding: '0.3rem', color: 'var(--danger)' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <div style={styles.peEditForm} className="slide-up">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {[
              { key: 'sets', label: 'Sets', type: 'number' },
              { key: 'reps', label: 'Reps', type: 'text' },
              { key: 'hold_seconds', label: 'Hold (s)', type: 'number' },
              { key: 'rest_seconds', label: 'Rest (s)', type: 'number' },
            ].map(({ key, label, type }) => (
              <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>{label}</label>
                <input
                  type={type}
                  className="form-input"
                  style={{ padding: '0.45rem 0.65rem' }}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Times per week</label>
            <select
              className="form-select"
              style={{ padding: '0.45rem 0.65rem' }}
              value={form.frequency_per_week}
              onChange={e => setForm(f => ({ ...f, frequency_per_week: e.target.value }))}
            >
              <option value="">Not set</option>
              {[1,2,3,4,5,6,7].map(n => (
                <option key={n} value={n}>{n}× per week</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Your private notes <span style={{ color: 'var(--charcoal)', opacity: 0.5, fontWeight: 400 }}>(only you can see this)</span></label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '60px', padding: '0.45rem 0.65rem' }}
              value={form.therapist_notes}
              onChange={e => setForm(f => ({ ...f, therapist_notes: e.target.value }))}
              placeholder="Clinical notes, precautions, progressions for your reference..."
            />
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Note for client <span style={{ color: 'var(--terracotta)', fontWeight: 400 }}>(client will see this)</span></label>
            <textarea
              className="form-textarea"
              style={{ minHeight: '60px', padding: '0.45rem 0.65rem' }}
              value={form.client_notes}
              onChange={e => setForm(f => ({ ...f, client_notes: e.target.value }))}
              placeholder="Optional instruction to share with client..."
            />
          </div>
          <button onClick={save} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>
            <Save size={13} /> Save
          </button>
        </div>
      )}
    </div>
  );
}

function AddExerciseModal({ allExercises, assignedIds, onAdd, onClose }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [customisation, setCustomisation] = useState({
    sets: '', reps: '', hold_seconds: '', rest_seconds: '', therapist_notes: '', client_notes: '', frequency_per_week: '',
  });

  const available = allExercises
    .filter(ex => !assignedIds.includes(ex.id))
    .filter(ex => !search || ex.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleAdd() {
    if (!selected) return;
    const payload = {};
    if (customisation.sets) payload.sets = +customisation.sets;
    if (customisation.reps) payload.reps = customisation.reps;
    if (customisation.hold_seconds) payload.hold_seconds = +customisation.hold_seconds;
    if (customisation.rest_seconds) payload.rest_seconds = +customisation.rest_seconds;
    if (customisation.therapist_notes) payload.therapist_notes = customisation.therapist_notes;
    if (customisation.client_notes) payload.client_notes = customisation.client_notes;
    if (customisation.frequency_per_week) payload.frequency_per_week = +customisation.frequency_per_week;
    onAdd(selected.id, payload);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Add Exercise to Programme</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <input
            type="search"
            className="form-input"
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ marginBottom: '0.75rem' }}
          />

          <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '1rem' }}>
            {available.map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelected(ex)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '0.65rem 0.75rem',
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  background: selected?.id === ex.id ? 'var(--cream)' : 'transparent',
                  marginBottom: '0.2rem', textAlign: 'left',
                }}
              >
                <span>
                  <span style={{ fontWeight: selected?.id === ex.id ? 600 : 400, fontSize: '0.9rem' }}>
                    {ex.name}
                  </span>
                  <span className="badge badge-navy" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>
                    {ex.category}
                  </span>
                </span>
                {selected?.id === ex.id && <CheckCircle2 size={16} color="var(--success)" />}
              </button>
            ))}
            {available.length === 0 && (
              <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.875rem', padding: '1rem' }}>
                No exercises found
              </p>
            )}
          </div>

          {selected && (
            <div style={{ borderTop: '1px solid var(--cream-dark)', paddingTop: '1rem' }} className="fade-in">
              <p style={{ fontSize: '0.8rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>
                Override defaults for <strong>{selected.name}</strong> (leave blank to use library defaults)
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem 0.75rem' }}>
                {[
                  { key: 'sets', label: 'Sets', type: 'number', defaultKey: 'default_sets' },
                  { key: 'reps', label: 'Reps', type: 'text', defaultKey: 'default_reps' },
                  { key: 'hold_seconds', label: 'Hold (s)', type: 'number', defaultKey: 'default_hold_seconds' },
                  { key: 'rest_seconds', label: 'Rest (s)', type: 'number', defaultKey: 'default_rest_seconds' },
                ].map(({ key, label, type, defaultKey }) => (
                  <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>{label}</label>
                    <input
                      type={type}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem' }}
                      placeholder={`Default: ${selected[defaultKey] || '—'}`}
                      value={customisation[key]}
                      onChange={e => setCustomisation(c => ({ ...c, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Times per week</label>
                <select
                  className="form-select"
                  value={customisation.frequency_per_week}
                  onChange={e => setCustomisation(c => ({ ...c, frequency_per_week: e.target.value }))}
                >
                  <option value="">Not set</option>
                  {[1,2,3,4,5,6,7].map(n => (
                    <option key={n} value={n}>{n}× per week</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Your private notes <span style={{ color: 'var(--charcoal)', opacity: 0.5, fontWeight: 400 }}>(only you can see this)</span></label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '60px' }}
                  placeholder="Clinical notes, precautions, progressions for your reference..."
                  value={customisation.therapist_notes}
                  onChange={e => setCustomisation(c => ({ ...c, therapist_notes: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Note for client <span style={{ color: 'var(--terracotta)', fontWeight: 400 }}>(client will see this)</span></label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '60px' }}
                  placeholder="Optional instruction to share with client..."
                  value={customisation.client_notes}
                  onChange={e => setCustomisation(c => ({ ...c, client_notes: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleAdd} className="btn btn-primary" disabled={!selected}>
            <Plus size={15} /> Add to Programme
          </button>
        </div>
      </div>
    </div>
  );
}

function AddInfoModal({ onAdd, onClose }) {
  const [form, setForm] = useState({
    title: '', content: '', category: 'General', is_pinned: false,
  });
  const categories = ['General', 'Osteoporosis', 'Exercise Tips', 'Home Care', 'Nutrition', 'Lifestyle'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Add Information Article</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              type="text" className="form-input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Understanding Osteoporosis"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 0.75rem', alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-select" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.35rem' }}>
                <input
                  type="checkbox" checked={form.is_pinned}
                  onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                  style={{ accentColor: 'var(--navy)', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>Pin to top</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea
              className="form-textarea" rows={8} value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write your article or notes here..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={() => onAdd(form)} className="btn btn-primary"
            disabled={!form.title.trim() || !form.content.trim()}
          >
            <Save size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function AddClientModal({ onClose, onInvite }) {
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleInvite() {
    if (!form.full_name.trim() || !form.email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const msg = await onInvite(form);
      setSuccess(msg || 'Client invited successfully.');
    } catch (err) {
      setError(err.message || 'Failed to invite client.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Invite New Client</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <>
            <div className="modal-body">
              <div style={styles.successBox}>{success}</div>
              <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.7, marginTop: '0.75rem' }}>
                The client has been sent a login invitation. Click their name to assign exercises.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body">
              <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--navy)' }}>
                The client will receive an email invitation to set their password and access their programme.
              </div>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text" className="form-input" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email" className="form-input" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
              {error && <div style={styles.errorBanner}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handleInvite} className="btn btn-primary"
                disabled={loading || !form.full_name.trim() || !form.email.trim()}
              >
                {loading
                  ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} />
                  : <UserPlus size={15} />}
                {loading ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', maxWidth: '900px', margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', margin: 0 },
  pageSubtitle: { fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.6, marginTop: '0.3rem' },
  errorBanner: { background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.9rem', fontSize: '0.875rem', marginBottom: '1rem' },
  successBox: { background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.875rem' },
  searchWrapper: { position: 'relative' },
  searchIcon: { position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--navy)', opacity: 0.4 },
  clientList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  clientCard: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', background: 'var(--white)', borderRadius: 'var(--radius-lg)' },
  clientAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--navy)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  clientInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  clientName: { fontWeight: 500, color: 'var(--navy)', fontSize: '0.95rem' },
  clientEmail: { fontSize: '0.78rem', color: 'var(--charcoal)', opacity: 0.6 },
  clientDetailHeader: { marginBottom: '1.5rem' },
  clientDetailMeta: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' },
  clientAvatarLg: { width: '48px', height: '48px', borderRadius: '50%', background: 'var(--navy)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.1rem', flexShrink: 0 },
  clientTabs: { display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--cream-dark)' },
  clientTab: { display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0', background: 'transparent', border: 'none', color: 'var(--charcoal)', opacity: 0.6, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', borderBottom: '2px solid transparent', marginBottom: '-2px' },
  clientTabActive: { color: 'var(--navy)', opacity: 1, borderBottomColor: 'var(--terracotta)', fontWeight: 600 },
  tabContent: { paddingBottom: '2rem' },
  tabActionBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', gap: '0.75rem' },
  programmeList: { display: 'flex', flexDirection: 'column' },
  peRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' },
  peNum: { width: '24px', height: '24px', borderRadius: '50%', background: 'var(--navy)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 },
  peName: { fontWeight: 500, fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.25rem' },
  peActions: { display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' },
  peEditForm: { padding: '0 1rem 1rem', borderTop: '1px solid var(--cream-dark)' },
  infoCategory: { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--terracotta)', fontWeight: 600 },
  pinnedBar: { background: 'var(--cream)', padding: '0.35rem 1rem', fontSize: '0.75rem', color: 'var(--navy)', borderBottom: '1px solid var(--cream-dark)' },
  qBadge: { background: 'var(--terracotta)', color: 'white', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700, padding: '0.05rem 0.45rem', lineHeight: 1.4, marginLeft: '0.2rem' },
  answerBlock: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', background: 'rgba(76,175,125,0.08)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.75rem' },
  replyForm: { display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--cream-dark)', paddingTop: '0.75rem' },
  pendingLabel: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--terracotta)', fontWeight: 600 },
};
