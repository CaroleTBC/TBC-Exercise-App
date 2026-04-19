import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import ComplianceTracker from '../client/ComplianceTracker';
import {
  UserPlus, X, ChevronRight, ChevronDown, Plus, Trash2,
  Save, Eye, CheckCircle2, Circle, BarChart2, BookOpen,
  AlertCircle, Search
} from 'lucide-react';

export default function ClientManager({ onStatsChange }) {
  const { profile } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('programme');
  const [showAddClient, setShowAddClient] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('full_name');
    setClients(data || []);
    setLoading(false);
  }

  async function createClient(form) {
    // Create auth user via Supabase Admin (invite flow)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(form.email, {
      data: { full_name: form.full_name, role: 'client' }
    });

    if (error) {
      // Fallback: create profile only if user exists
      alert(`Note: ${error.message}. If the client already has an account, their profile will be linked on first login.`);
      return;
    }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        role: 'client',
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gdpr_consent: true,
        gdpr_consent_date: new Date().toISOString(),
      });

      await fetchClients();
      onStatsChange?.();
    }
  }

  const filteredClients = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
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
        // Client list
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
                  onClick={() => setSelectedClient(client)}
                  className="card"
                  style={styles.clientCard}
                >
                  <div style={styles.clientAvatar}>
                    {client.full_name?.charAt(0)}
                  </div>
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
        // Client detail
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
          onCreate={createClient}
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
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddInfo, setShowAddInfo] = useState(false);

  const CLIENT_TABS = [
    { id: 'programme', label: 'Programme', icon: CheckCircle2 },
    { id: 'information', label: 'Information', icon: BookOpen },
    { id: 'compliance', label: 'Compliance', icon: BarChart2 },
  ];

  useEffect(() => {
    fetchData();
  }, [client.id]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: programmes } = await supabase
        .from('client_programmes')
        .select('*')
        .eq('client_id', client.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      let prog = programmes?.[0];

      if (!prog) {
        // Auto-create programme
        const { data: newProg } = await supabase
          .from('client_programmes')
          .insert({
            client_id: client.id,
            therapist_id: therapistId,
            name: `${client.full_name.split(' ')[0]}'s Programme`,
          })
          .select()
          .single();
        prog = newProg;
      }

      setProgramme(prog);

      const [{ data: progExs }, { data: exLib }, { data: info }] = await Promise.all([
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

      setProgrammeExercises(progExs || []);
      setAllExercises(exLib || []);
      setInformation(info || []);
    } finally {
      setLoading(false);
    }
  }

  async function removeExercise(peId) {
    if (!window.confirm('Remove this exercise from the programme?')) return;
    await supabase.from('programme_exercises').update({ is_active: false }).eq('id', peId);
    setProgrammeExercises(prev => prev.filter(pe => pe.id !== peId));
  }

  async function addExercise(exerciseId, customisation) {
    const { data } = await supabase
      .from('programme_exercises')
      .insert({
        programme_id: programme.id,
        exercise_id: exerciseId,
        sort_order: programmeExercises.length,
        ...customisation,
      })
      .select('*, exercise:exercises(*)')
      .single();
    setProgrammeExercises(prev => [...prev, data]);
    setShowAddExercise(false);
  }

  async function updateProgrammeExercise(peId, updates) {
    const { data } = await supabase
      .from('programme_exercises')
      .update(updates)
      .eq('id', peId)
      .select('*, exercise:exercises(*)')
      .single();
    setProgrammeExercises(prev => prev.map(pe => pe.id === peId ? data : pe));
  }

  async function addInformation(form) {
    const { data } = await supabase
      .from('client_information')
      .insert({ ...form, client_id: client.id, therapist_id: therapistId })
      .select()
      .single();
    setInformation(prev => [data, ...prev]);
    setShowAddInfo(false);
  }

  async function deleteInfo(id) {
    if (!window.confirm('Delete this information item?')) return;
    await supabase.from('client_information').delete().eq('id', id);
    setInformation(prev => prev.filter(i => i.id !== id));
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div>
      {/* Client header */}
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

      {/* Tabs */}
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
            </button>
          );
        })}
      </div>

      {/* Programme tab */}
      {activeTab === 'programme' && (
        <div style={styles.tabContent} className="fade-in">
          <div style={styles.tabActionBar}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {programme?.name}
            </h3>
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

      {/* Information tab */}
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

          {information.map(item => (
            <div key={item.id} className="card" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
              {item.is_pinned && <div style={styles.pinnedBar}>📌 Pinned</div>}
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={styles.infoCategory}>{item.category}</div>
                    <h4 style={{ fontSize: '1rem', margin: '0.25rem 0' }}>{item.title}</h4>
                  </div>
                  <button onClick={() => deleteInfo(item.id)} className="btn btn-ghost" style={{ color: 'var(--danger)', padding: '0.3rem' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7, marginTop: '0.5rem', lineHeight: 1.6 }}>
                  {item.content.length > 200 ? item.content.substring(0, 200) + '...' : item.content}
                </p>
              </div>
            </div>
          ))}

          {information.length === 0 && (
            <div className="empty-state">
              <BookOpen size={36} opacity={0.3} />
              <p>No information articles yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Compliance tab */}
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
              <ComplianceTracker programmeId={programme.id} userId={client.id} readOnly />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
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
    sets: pe.sets || pe.exercise?.default_sets || '',
    reps: pe.reps || pe.exercise?.default_reps || '',
    hold_seconds: pe.hold_seconds || pe.exercise?.default_hold_seconds || '',
    rest_seconds: pe.rest_seconds || pe.exercise?.default_rest_seconds || '',
    client_notes: pe.client_notes || '',
  });

  async function save() {
    await onUpdate(pe.id, {
      sets: form.sets || null,
      reps: form.reps || null,
      hold_seconds: form.hold_seconds || null,
      rest_seconds: form.rest_seconds || null,
      client_notes: form.client_notes || null,
    });
    setEditing(false);
  }

  return (
    <div className="card" style={{ marginBottom: '0.5rem' }}>
      <div style={styles.peRow}>
        <div style={styles.peNum}>{idx + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={styles.peName}>{pe.exercise?.name}</div>
          <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>{pe.exercise?.category}</span>
        </div>
        <div style={styles.peActions}>
          <button onClick={() => setEditing(v => !v)} className="btn btn-ghost" style={{ padding: '0.3rem', fontSize: '0.75rem' }}>
            {editing ? <X size={14} /> : 'Edit'}
          </button>
          <button onClick={() => onRemove(pe.id)} className="btn btn-ghost" style={{ padding: '0.3rem', color: 'var(--danger)' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <div style={styles.peEditForm} className="slide-up">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Sets</label>
              <input type="number" className="form-input" style={{ padding: '0.45rem 0.65rem' }}
                value={form.sets} onChange={e => setForm(f => ({ ...f, sets: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Reps</label>
              <input type="text" className="form-input" style={{ padding: '0.45rem 0.65rem' }}
                value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Hold (s)</label>
              <input type="number" className="form-input" style={{ padding: '0.45rem 0.65rem' }}
                value={form.hold_seconds} onChange={e => setForm(f => ({ ...f, hold_seconds: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Rest (s)</label>
              <input type="number" className="form-input" style={{ padding: '0.45rem 0.65rem' }}
                value={form.rest_seconds} onChange={e => setForm(f => ({ ...f, rest_seconds: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: '0.75rem', marginTop: '0.75rem' }}>
            <label className="form-label" style={{ fontSize: '0.7rem' }}>Client-specific notes</label>
            <textarea className="form-textarea" style={{ minHeight: '60px', padding: '0.45rem 0.65rem' }}
              value={form.client_notes} onChange={e => setForm(f => ({ ...f, client_notes: e.target.value }))}
              placeholder="Custom instruction for this client..." />
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
  const [customisation, setCustomisation] = useState({ sets: '', reps: '', hold_seconds: '', rest_seconds: '', client_notes: '' });

  const available = allExercises
    .filter(ex => !assignedIds.includes(ex.id))
    .filter(ex => !search || ex.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  async function handleAdd() {
    if (!selected) return;
    const payload = {};
    if (customisation.sets) payload.sets = +customisation.sets;
    if (customisation.reps) payload.reps = customisation.reps;
    if (customisation.hold_seconds) payload.hold_seconds = +customisation.hold_seconds;
    if (customisation.rest_seconds) payload.rest_seconds = +customisation.rest_seconds;
    if (customisation.client_notes) payload.client_notes = customisation.client_notes;
    await onAdd(selected.id, payload);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Add Exercise to Programme</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <input
            type="search" className="form-input"
            placeholder="Search exercises..."
            value={search} onChange={e => setSearch(e.target.value)}
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
                  <span style={{ fontWeight: selected?.id === ex.id ? 600 : 400, fontSize: '0.9rem' }}>{ex.name}</span>
                  <span className="badge badge-navy" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>{ex.category}</span>
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
                {['sets', 'reps', 'hold_seconds', 'rest_seconds'].map(key => (
                  <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>{key.replace('_', ' ')}</label>
                    <input
                      type={key === 'reps' ? 'text' : 'number'}
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem' }}
                      placeholder={`Default: ${selected[`default_${key}`] || '—'}`}
                      value={customisation[key]}
                      onChange={e => setCustomisation(c => ({ ...c, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Client-specific note</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: '60px' }}
                  placeholder="Any note specific to this client..."
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
  const [form, setForm] = useState({ title: '', content: '', category: 'General', is_pinned: false });
  const categories = ['General', 'Osteoporosis', 'Exercise Tips', 'Home Care', 'Nutrition', 'Lifestyle'];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Add Information Article</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Title</label>
            <input type="text" className="form-input" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Understanding Osteoporosis" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 0.75rem', alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.35rem' }}>
                <input type="checkbox" checked={form.is_pinned}
                  onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
                  style={{ accentColor: 'var(--navy)', width: '16px', height: '16px' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--navy)' }}>Pin to top</span>
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Content</label>
            <textarea className="form-textarea" rows={8} value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Write your article or notes here..." />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={() => onAdd(form)} className="btn btn-primary"
            disabled={!form.title.trim() || !form.content.trim()}>
            <Save size={15} /> Add
          </button>
        </div>
      </div>
    </div>
  );
}

function AddClientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', date_of_birth: '' });
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!form.full_name.trim() || !form.email.trim()) return;
    setLoading(true);
    await onCreate(form);
    setLoading(false);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Invite New Client</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--navy)' }}>
            The client will receive an email invitation to set their password and access their programme.
            Their GDPR consent is recorded at the point of account creation.
          </div>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input type="text" className="form-input" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input type="email" className="form-input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone (optional)</label>
            <input type="tel" className="form-input" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+44 7700 000000" />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth (optional)</label>
            <input type="date" className="form-input" value={form.date_of_birth}
              onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleCreate} className="btn btn-primary"
            disabled={loading || !form.full_name.trim() || !form.email.trim()}>
            {loading ? 'Inviting...' : <><UserPlus size={15} /> Send Invite</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', maxWidth: '900px', margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', margin: 0 },
  pageSubtitle: { fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.6, marginTop: '0.3rem' },
  searchWrapper: { position: 'relative' },
  searchIcon: { position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--navy)', opacity: 0.4 },
  clientList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  clientCard: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'box-shadow 0.2s', background: 'var(--white)', borderRadius: 'var(--radius-lg)' },
  clientAvatar: { width: '40px', height: '40px', borderRadius: '50%', background: 'var(--navy)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, flexShrink: 0 },
  clientInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  clientName: { fontWeight: 500, color: 'var(--navy)', fontSize: '0.95rem' },
  clientEmail: { fontSize: '0.78rem', color: 'var(--charcoal)', opacity: 0.6 },
  clientDetailHeader: { marginBottom: '1.5rem' },
  clientDetailMeta: { display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' },
  clientAvatarLg: { width: '48px', height: '48px', borderRadius: '50%', background: 'var(--navy)', color: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '1.1rem', flexShrink: 0 },
  clientTabs: { display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '2px solid var(--cream-dark)', paddingBottom: '0' },
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
};
