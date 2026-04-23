import React, { useEffect, useState, useMemo } from 'react';
import { supabase, EXERCISE_CATEGORIES, CATEGORY_LABELS } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import VideoPlayer from '../shared/VideoPlayer';
import {
  Plus, Sparkles, Search, ChevronDown, ChevronUp,
  Edit2, Trash2, X, Save, Info
} from 'lucide-react';

export default function ExerciseLibrary({ onStatsChange }) {
  const { profile } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    fetchExercises();
  }, []);

  async function fetchExercises() {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');
      if (error) throw error;
      setExercises(data || []);
    } catch (err) {
      console.error('Failed to load exercises:', err);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['All', ...EXERCISE_CATEGORIES];

  const filtered = useMemo(() => {
    return exercises
      .filter(ex => {
        const matchesSearch = !search ||
          ex.name.toLowerCase().includes(search.toLowerCase()) ||
          ex.description?.toLowerCase().includes(search.toLowerCase());
        const matchesCat = activeCategory === 'All' || ex.category === activeCategory;
        return matchesSearch && matchesCat;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, search, activeCategory]);

  // Group by category for display
  const grouped = useMemo(() => {
    if (activeCategory !== 'All') return { [activeCategory]: filtered };
    const g = {};
    // Add exercises in predefined category order first
    EXERCISE_CATEGORIES.forEach(cat => {
      const catExercises = filtered.filter(ex => ex.category === cat);
      if (catExercises.length > 0) g[cat] = catExercises;
    });
    // Catch any exercises whose category doesn't match a predefined one
    const known = new Set(EXERCISE_CATEGORIES);
    filtered.filter(ex => !known.has(ex.category)).forEach(ex => {
      const cat = ex.category || 'Other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(ex);
    });
    return g;
  }, [filtered, activeCategory]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this exercise from the library?')) return;
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) { alert('Failed to delete exercise. Please try again.'); return; }
    setExercises(prev => prev.filter(e => e.id !== id));
    onStatsChange?.();
  }

 async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/generate-exercise`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ prompt: aiPrompt }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await response.json();
      const generated = data.exercise;

      setEditingExercise({
        ...generated,
        ai_generated: true,
        video_url: '',
        video_type: 'youtube',
      });
      setShowAiPanel(false);
      setShowAddModal(true);
    } catch (err) {
      alert('AI generation failed. Please try again or add the exercise manually.');
    } finally {
      setAiLoading(false);
    }
  }

  function openAddManual() {
    setEditingExercise({
      name: '',
      category: EXERCISE_CATEGORIES[0],
      description: '',
      video_url: '',
      video_type: 'youtube',
      default_sets: 3,
      default_reps: '10',
      default_hold_seconds: null,
      default_rest_seconds: 60,
      therapist_notes_template: '',
      ai_generated: false,
    });
    setShowAddModal(true);
  }

  async function saveExercise(exercise) {
    const payload = {
      ...exercise,
      created_by: profile.id,
      video_url: exercise.video_url || null,
      default_hold_seconds: exercise.default_hold_seconds || null,
    };
    delete payload.id;

    if (exercise.id) {
      const { data, error } = await supabase
        .from('exercises')
        .update(payload)
        .eq('id', exercise.id)
        .select()
        .single();
      if (error) throw error;
      setExercises(prev => prev.map(e => e.id === exercise.id ? data : e));
    } else {
      const { data, error } = await supabase
        .from('exercises')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setExercises(prev => [...prev, data]);
    }

    setShowAddModal(false);
    setEditingExercise(null);
    onStatsChange?.();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Exercise Library</h1>
          <p style={styles.pageSubtitle}>{exercises.length} exercises · sorted alphabetically within categories</p>
        </div>
        <div style={styles.headerActions}>
          <button
            onClick={() => setShowAiPanel(v => !v)}
            className="btn"
            style={styles.aiBtn}
          >
            <Sparkles size={16} />
            AI Generate
          </button>
          <button onClick={openAddManual} className="btn btn-primary">
            <Plus size={16} /> Add Exercise
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div style={styles.aiPanel} className="fade-in">
          <div style={styles.aiPanelHeader}>
            <Sparkles size={16} color="var(--terracotta)" />
            <span style={styles.aiPanelTitle}>Generate an exercise with AI</span>
            <button onClick={() => setShowAiPanel(false)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '0.25rem' }}>
              <X size={16} />
            </button>
          </div>
          <p style={styles.aiNote}>
            Describe what you need — the AI will draft it, then you can edit everything before saving.
          </p>
          <div style={styles.aiInputRow}>
            <input
              type="text"
              className="form-input"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. single leg balance exercise suitable for osteoporosis, progressable from wall support"
              onKeyDown={e => e.key === 'Enter' && generateWithAI()}
            />
            <button
              onClick={generateWithAI}
              className="btn btn-secondary"
              disabled={aiLoading || !aiPrompt.trim()}
              style={{ flexShrink: 0 }}
            >
              {aiLoading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Sparkles size={15} />}
              {aiLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Search + Category filter */}
      <div style={styles.filterBar}>
        <div style={styles.searchWrapper}>
          <Search size={15} style={styles.searchIcon} />
          <input
            type="search"
            className="form-input"
            style={styles.searchInput}
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.categoryTabs}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                ...styles.catTab,
                ...(activeCategory === cat ? styles.catTabActive : {}),
              }}
            >
              {cat === 'All' ? 'All' : cat.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise list grouped by category */}
      <div style={styles.libraryContent}>
        {Object.entries(grouped).length === 0 ? (
          <div className="empty-state">
            <p>No exercises found. Try a different search or add one.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([cat, catExercises]) => (
            <div key={cat} style={styles.categorySection}>
              <div style={styles.categoryHeader}>
                <span style={styles.categoryName}>{CATEGORY_LABELS[cat] || cat}</span>
                <span style={styles.categoryCount}>{catExercises.length}</span>
              </div>

              <div style={styles.exerciseList}>
                {catExercises.map(ex => {
                  const isExpanded = expandedId === ex.id;
                  return (
                    <div key={ex.id} className="card" style={styles.exerciseCard}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                        style={styles.exerciseRow}
                      >
                        <div style={styles.exerciseInfo}>
                          <span style={styles.exerciseName}>{ex.name}</span>
                          <div style={styles.exerciseTags}>
                            {ex.ai_generated && (
                              <span className="badge badge-terracotta" style={{ fontSize: '0.65rem' }}>
                                <Sparkles size={9} /> AI
                              </span>
                            )}
                            {ex.video_url && (
                              <span className="badge badge-navy" style={{ fontSize: '0.65rem' }}>▶ Video</span>
                            )}
                          </div>
                        </div>
                        <div style={styles.exerciseActions}>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingExercise(ex); setShowAddModal(true); }}
                            className="btn btn-ghost"
                            style={styles.actionBtn}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(ex.id); }}
                            className="btn btn-ghost"
                            style={{ ...styles.actionBtn, color: 'var(--danger)' }}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                          {isExpanded ? <ChevronUp size={16} color="var(--navy)" /> : <ChevronDown size={16} color="var(--navy)" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={styles.exerciseDetail} className="slide-up">
                          {ex.video_url && (
                            <VideoPlayer url={ex.video_url} type={ex.video_type} title={ex.name} />
                          )}
                          <p style={styles.description}>{ex.description}</p>
                          <div style={styles.paramRow}>
                            {ex.default_sets && <span className="badge badge-navy">Sets: {ex.default_sets}</span>}
                            {ex.default_reps && <span className="badge badge-navy">Reps: {ex.default_reps}</span>}
                            {ex.default_hold_seconds && <span className="badge badge-navy">Hold: {ex.default_hold_seconds}s</span>}
                            {ex.default_rest_seconds && <span className="badge badge-navy">Rest: {ex.default_rest_seconds}s</span>}
                          </div>
                          {ex.therapist_notes_template && (
                            <div style={styles.therapistNotes}>
                              <Info size={13} />
                              <span>{ex.therapist_notes_template}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && editingExercise && (
        <ExerciseFormModal
          exercise={editingExercise}
          onSave={saveExercise}
          onClose={() => { setShowAddModal(false); setEditingExercise(null); }}
        />
      )}
    </div>
  );
}

function ExerciseFormModal({ exercise, onSave, onClose }) {
  const [form, setForm] = useState({ ...exercise });
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.description.trim()) {
      alert('Name and description are required.');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      alert(err.message || 'Failed to save exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>
              {exercise.id ? 'Edit Exercise' : 'Add Exercise'}
            </h2>
            {form.ai_generated && (
              <span className="badge badge-terracotta" style={{ marginTop: '0.4rem', fontSize: '0.7rem' }}>
                <Sparkles size={10} /> AI generated — review before saving
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Exercise Name *</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Single Leg Stand"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-select"
                value={form.category}
                onChange={e => set('category', e.target.value)}
              >
                {EXERCISE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Video Type</label>
              <select
                className="form-select"
                value={form.video_type || 'youtube'}
                onChange={e => set('video_type', e.target.value)}
              >
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Video URL</label>
              <input
                type="url"
                className="form-input"
                value={form.video_url || ''}
                onChange={e => set('video_url', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              {form.video_url && (
                <div style={{ marginTop: '0.75rem' }}>
                  <VideoPlayer url={form.video_url} type={form.video_type} title={form.name} />
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Instructions *</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={5}
              placeholder="Step-by-step instructions including starting position, movement, and key technique points..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Sets</label>
              <input type="number" className="form-input" min="1" max="10"
                value={form.default_sets || ''} onChange={e => set('default_sets', +e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reps</label>
              <input type="text" className="form-input"
                value={form.default_reps || ''} onChange={e => set('default_reps', e.target.value)}
                placeholder="10" />
            </div>
            <div className="form-group">
              <label className="form-label">Hold (s)</label>
              <input type="number" className="form-input" min="0"
                value={form.default_hold_seconds || ''} onChange={e => set('default_hold_seconds', +e.target.value || null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Rest (s)</label>
              <input type="number" className="form-input" min="0"
                value={form.default_rest_seconds || ''} onChange={e => set('default_rest_seconds', +e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Therapist Notes / Progressions</label>
            <textarea
              className="form-textarea"
              value={form.therapist_notes_template || ''}
              onChange={e => set('therapist_notes_template', e.target.value)}
              rows={3}
              placeholder="Progressions, regressions, contraindications, or cues for specific client groups..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving}
            style={{ gap: '0.5rem' }}
          >
            {saving ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Save size={15} />}
            {saving ? 'Saving...' : exercise.id ? 'Save changes' : 'Add to library'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: '1.5rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 'clamp(1.4rem, 3vw, 1.8rem)',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '0.85rem',
    color: 'var(--charcoal)',
    opacity: 0.6,
    marginTop: '0.3rem',
  },
  headerActions: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  aiBtn: {
    background: 'linear-gradient(135deg, rgba(196,122,90,0.15), rgba(47,69,111,0.1))',
    border: '1.5px solid rgba(196,122,90,0.4)',
    color: 'var(--terracotta-dark)',
    gap: '0.4rem',
  },
  aiPanel: {
    background: 'var(--white)',
    border: '1.5px solid rgba(196,122,90,0.3)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.25rem',
    marginBottom: '1.25rem',
  },
  aiPanelHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginBottom: '0.5rem',
  },
  aiPanelTitle: {
    fontWeight: 600,
    color: 'var(--navy)',
    fontSize: '0.9rem',
  },
  aiNote: {
    fontSize: '0.82rem',
    color: 'var(--charcoal)',
    opacity: 0.7,
    marginBottom: '0.75rem',
  },
  aiInputRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  filterBar: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexDirection: 'column',
  },
  searchWrapper: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--navy)',
    opacity: 0.4,
  },
  searchInput: {
    paddingLeft: '2.2rem',
  },
  categoryTabs: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  },
  catTab: {
    padding: '0.35rem 0.85rem',
    borderRadius: '20px',
    border: '1.5px solid var(--cream-dark)',
    background: 'var(--white)',
    color: 'var(--charcoal)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  catTabActive: {
    background: 'var(--navy)',
    color: 'var(--cream)',
    borderColor: 'var(--navy)',
  },
  libraryContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
  },
  categorySection: {},
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    paddingBottom: '0.5rem',
    borderBottom: '2px solid var(--cream-dark)',
  },
  categoryName: {
    fontFamily: 'var(--font-serif)',
    fontSize: '1.1rem',
    color: 'var(--navy)',
    fontWeight: 500,
  },
  categoryCount: {
    background: 'var(--navy)',
    color: 'var(--cream)',
    borderRadius: '20px',
    padding: '0.1rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  exerciseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  exerciseCard: {},
  exerciseRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.9rem 1rem',
    width: '100%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  exerciseInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    flex: 1,
    minWidth: 0,
  },
  exerciseName: {
    fontWeight: 500,
    color: 'var(--navy)',
    fontSize: '0.95rem',
  },
  exerciseTags: {
    display: 'flex',
    gap: '0.3rem',
  },
  exerciseActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  actionBtn: {
    padding: '0.35rem',
    color: 'var(--navy)',
    opacity: 0.6,
  },
  exerciseDetail: {
    padding: '0 1rem 1rem',
    borderTop: '1px solid var(--cream-dark)',
  },
  description: {
    fontSize: '0.9rem',
    lineHeight: 1.7,
    color: 'var(--charcoal)',
    marginBottom: '0.75rem',
    marginTop: '0.75rem',
  },
  paramRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem',
  },
  therapistNotes: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
    background: 'rgba(47,69,111,0.05)',
    borderLeft: '3px solid var(--navy)',
    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
    padding: '0.65rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--navy)',
    lineHeight: 1.6,
  },
};
