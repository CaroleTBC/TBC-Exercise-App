import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  Plus, Sparkles, Search, ChevronDown, ChevronUp,
  Edit2, Trash2, X, Save, Users, Check
} from 'lucide-react';

const SUPABASE_URL = 'https://wysbbhrolgyzjkwwzpyy.supabase.co';

const CATEGORIES = [
  'General',
  'Osteoporosis',
  'Exercise Tips',
  'Bone Health',
  'Nutrition',
  'Lifestyle',
  'Pain Management',
  'Home Care',
];

// ─────────────────────────────────────────────────────────────────────────────
// Simple markdown renderer — no external libraries
// Handles: ## headings, ### subheadings, **bold**, - bullets, blank lines
// ─────────────────────────────────────────────────────────────────────────────
export function renderMarkdown(text = '') {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let bulletBuffer = [];
  let key = 0;

  function flushBullets() {
    if (bulletBuffer.length > 0) {
      elements.push(
        <ul key={key++} style={mdStyles.ul}>
          {bulletBuffer.map((item, i) => (
            <li key={i} style={mdStyles.li}
              dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      bulletBuffer = [];
    }
  }

  lines.forEach(line => {
    if (line.startsWith('## ')) {
      flushBullets();
      elements.push(<h2 key={key++} style={mdStyles.h2}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      flushBullets();
      elements.push(<h3 key={key++} style={mdStyles.h3}>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      bulletBuffer.push(line.slice(2));
    } else if (line.trim() === '') {
      flushBullets();
      elements.push(<div key={key++} style={{ height: '0.5rem' }} />);
    } else {
      flushBullets();
      elements.push(
        <p key={key++} style={mdStyles.p}
          dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      );
    }
  });

  flushBullets();
  return elements;
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

const mdStyles = {
  h2: { fontSize: '1.05rem', fontFamily: 'var(--font-serif)', color: 'var(--navy)', fontWeight: 600, margin: '1rem 0 0.4rem', borderBottom: '1px solid var(--cream-dark)', paddingBottom: '0.3rem' },
  h3: { fontSize: '0.95rem', color: 'var(--navy)', fontWeight: 600, margin: '0.75rem 0 0.3rem' },
  p: { fontSize: '0.9rem', lineHeight: 1.75, color: 'var(--charcoal)', margin: '0.1rem 0' },
  ul: { margin: '0.25rem 0 0.25rem 1.25rem', padding: 0 },
  li: { fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--charcoal)', marginBottom: '0.2rem' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Markdown toolbar — inserts syntax at cursor position
// ─────────────────────────────────────────────────────────────────────────────
function MarkdownToolbar({ textareaRef, value, onChange }) {
  function insert(before, after = '', placeholder = 'text') {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }

  function insertLine(prefix) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const newVal = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(newVal);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + prefix.length, start + prefix.length); }, 0);
  }

  const btnStyle = {
    padding: '0.3rem 0.6rem',
    border: '1px solid var(--cream-dark)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--white)',
    color: 'var(--navy)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    transition: 'all 0.1s',
  };

  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
      <button type="button" style={btnStyle} onClick={() => insertLine('## ')}>H2</button>
      <button type="button" style={btnStyle} onClick={() => insertLine('### ')}>H3</button>
      <button type="button" style={{ ...btnStyle, fontWeight: 700 }} onClick={() => insert('**', '**', 'bold text')}>B</button>
      <button type="button" style={{ ...btnStyle, fontStyle: 'italic' }} onClick={() => insert('*', '*', 'italic text')}>I</button>
      <button type="button" style={btnStyle} onClick={() => insertLine('- ')}>• List</button>
      <span style={{ borderLeft: '1px solid var(--cream-dark)', margin: '0 0.15rem' }} />
      <span style={{ fontSize: '0.72rem', color: 'var(--charcoal)', opacity: 0.5, alignSelf: 'center' }}>
        Select text then click to format
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function InformationLibrary({ onStatsChange }) {
  const { profile } = useAuth();
  const [articles, setArticles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [showPushModal, setShowPushModal] = useState(null); // article being pushed
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState('General');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    fetchArticles();
    fetchClients();
  }, []);

  async function fetchArticles() {
    const { data } = await supabase
      .from('information_articles')
      .select('*')
      .order('created_at', { ascending: false });
    setArticles(data || []);
    setLoading(false);
  }

  async function fetchClients() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'client')
      .order('full_name');
    setClients(data || []);
  }

  const categories = ['All', ...CATEGORIES];

  const filtered = useMemo(() => {
    return articles.filter(a => {
      const matchSearch = !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase());
      const matchCat = activeCategory === 'All' || a.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [articles, search, activeCategory]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this article from the library? It will be removed from any clients it has been pushed to.')) return;
    await supabase.from('information_articles').delete().eq('id', id);
    setArticles(prev => prev.filter(a => a.id !== id));
  }

  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: aiPrompt, category: aiCategory }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Generation failed');

      setEditingArticle({ ...result.article, ai_generated: true });
      setAiPrompt('');
      setShowAiPanel(false);
      setShowFormModal(true);
    } catch (err) {
      setAiError(err.message || 'Something went wrong. Try again or write the article manually.');
    } finally {
      setAiLoading(false);
    }
  }

  function openAddManual() {
    setEditingArticle({ title: '', content: '', category: 'General', ai_generated: false });
    setShowFormModal(true);
  }

  async function saveArticle(article) {
    const payload = {
      title: article.title,
      content: article.content,
      category: article.category,
      ai_generated: article.ai_generated || false,
      therapist_id: profile.id,
      updated_at: new Date().toISOString(),
    };

    if (article.id) {
      const { data } = await supabase
        .from('information_articles')
        .update(payload)
        .eq('id', article.id)
        .select()
        .single();
      setArticles(prev => prev.map(a => a.id === article.id ? data : a));
    } else {
      const { data } = await supabase
        .from('information_articles')
        .insert(payload)
        .select()
        .single();
      setArticles(prev => [data, ...prev]);
    }

    setShowFormModal(false);
    setEditingArticle(null);
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="spinner" /></div>;
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Information Library</h1>
          <p style={styles.pageSubtitle}>{articles.length} article{articles.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => { setShowAiPanel(v => !v); setAiError(''); }} className="btn" style={styles.aiBtn}>
            <Sparkles size={16} /> AI Generate
          </button>
          <button onClick={openAddManual} className="btn btn-primary">
            <Plus size={16} /> Write Article
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div style={styles.aiPanel} className="fade-in">
          <div style={styles.aiPanelHeader}>
            <Sparkles size={16} color="var(--terracotta)" />
            <span style={styles.aiPanelTitle}>Generate an article with AI</span>
            <button onClick={() => { setShowAiPanel(false); setAiError(''); }} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '0.25rem' }}>
              <X size={16} />
            </button>
          </div>
          <p style={styles.aiNote}>Describe the topic — the AI will write a patient-friendly draft you can edit before saving.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="text"
              className="form-input"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !aiLoading && generateWithAI()}
              placeholder="e.g. why impact exercise helps build bone density, for someone newly diagnosed with osteoporosis"
              disabled={aiLoading}
            />
            <select className="form-select" value={aiCategory} onChange={e => setAiCategory(e.target.value)} style={{ width: 'auto' }}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={generateWithAI} className="btn btn-secondary" disabled={aiLoading || !aiPrompt.trim()}>
            {aiLoading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Sparkles size={15} />}
            {aiLoading ? 'Generating...' : 'Generate'}
          </button>
          {aiError && <p style={styles.aiErrorMsg}>{aiError}</p>}
        </div>
      )}

      {/* Search + category filter */}
      <div style={styles.filterBar}>
        <div style={styles.searchWrapper}>
          <Search size={15} style={styles.searchIcon} />
          <input type="search" className="form-input" style={{ paddingLeft: '2.2rem' }}
            placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={styles.categoryTabs}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ ...styles.catTab, ...(activeCategory === cat ? styles.catTabActive : {}) }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Article list */}
      {filtered.length === 0 ? (
        <div className="empty-state"><p>No articles found. Generate one with AI or write your own.</p></div>
      ) : (
        <div style={styles.articleList}>
          {filtered.map(article => {
            const isExpanded = expandedId === article.id;
            return (
              <div key={article.id} className="card" style={styles.articleCard}>
                <button onClick={() => setExpandedId(isExpanded ? null : article.id)} style={styles.articleRow}>
                  <div style={styles.articleInfo}>
                    <div>
                      <span style={styles.articleTitle}>{article.title}</span>
                      <div style={styles.articleMeta}>
                        <span style={styles.catPill}>{article.category}</span>
                        {article.ai_generated && (
                          <span className="badge badge-terracotta" style={{ fontSize: '0.65rem' }}>
                            <Sparkles size={9} /> AI
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={styles.articleActions}>
                    <button
                      onClick={e => { e.stopPropagation(); setShowPushModal(article); }}
                      className="btn btn-ghost" style={styles.actionBtn} title="Push to clients"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingArticle(article); setShowFormModal(true); }}
                      className="btn btn-ghost" style={styles.actionBtn} title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(article.id); }}
                      className="btn btn-ghost" style={{ ...styles.actionBtn, color: 'var(--danger)' }} title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={16} color="var(--navy)" /> : <ChevronDown size={16} color="var(--navy)" />}
                  </div>
                </button>

                {isExpanded && (
                  <div style={styles.articlePreview} className="slide-up">
                    <div style={styles.previewContent}>
                      {renderMarkdown(article.content)}
                    </div>
                    <button
                      onClick={() => setShowPushModal(article)}
                      className="btn btn-primary"
                      style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      <Users size={14} /> Push to clients
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Article form modal */}
      {showFormModal && editingArticle && (
        <ArticleFormModal
          article={editingArticle}
          onSave={saveArticle}
          onClose={() => { setShowFormModal(false); setEditingArticle(null); }}
        />
      )}

      {/* Push to clients modal */}
      {showPushModal && (
        <PushToClientsModal
          article={showPushModal}
          clients={clients}
          therapistId={profile.id}
          onClose={() => setShowPushModal(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Article form modal — write/edit with markdown toolbar and live preview
// ─────────────────────────────────────────────────────────────────────────────
function ArticleFormModal({ article, onSave, onClose }) {
  const [form, setForm] = useState({ ...article });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

  function set(key, value) { setForm(prev => ({ ...prev, [key]: value })); }

  async function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      alert('Title and content are required.');
      return;
    }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>{article.id ? 'Edit Article' : 'Write Article'}</h2>
            {form.ai_generated && (
              <span className="badge badge-terracotta" style={{ marginTop: '0.4rem', fontSize: '0.7rem' }}>
                <Sparkles size={10} /> AI generated — review before saving
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 0.75rem', alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input type="text" className="form-input" value={form.title}
                onChange={e => set('title', e.target.value)} placeholder="e.g. Understanding Osteoporosis" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Content *</label>
              <button type="button" onClick={() => setShowPreview(v => !v)}
                style={{ fontSize: '0.75rem', color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {!showPreview ? (
              <>
                <MarkdownToolbar textareaRef={textareaRef} value={form.content} onChange={v => set('content', v)} />
                <textarea
                  ref={textareaRef}
                  className="form-textarea"
                  value={form.content}
                  onChange={e => set('content', e.target.value)}
                  rows={14}
                  placeholder={`## Why Exercise Matters for Bone Health\n\nYour bones respond to the forces placed on them...\n\n## What You Can Do\n\n- Start with gentle weight-bearing activities\n- **Consistency matters more than intensity**\n- Build up gradually over weeks`}
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </>
            ) : (
              <div style={styles.previewBox}>
                {renderMarkdown(form.content)}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Save size={15} />}
            {saving ? 'Saving...' : article.id ? 'Save changes' : 'Add to library'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Push to clients modal
// ─────────────────────────────────────────────────────────────────────────────
function PushToClientsModal({ article, clients, therapistId, onClose }) {
  const [selected, setSelected] = useState(new Set());
  const [alreadyAssigned, setAlreadyAssigned] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function checkAssigned() {
      const { data } = await supabase
        .from('client_information')
        .select('client_id')
        .eq('article_id', article.id);
      if (data) setAlreadyAssigned(new Set(data.map(r => r.client_id)));
    }
    checkAssigned();
  }, [article.id]);

  function toggle(clientId) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(clientId) ? next.delete(clientId) : next.add(clientId);
      return next;
    });
  }

  async function handlePush() {
    if (selected.size === 0) return;
    setSaving(true);

    const rows = [...selected].map(clientId => ({
      client_id: clientId,
      therapist_id: therapistId,
      article_id: article.id,
      title: article.title,
      content: article.content,
      category: article.category,
      is_pinned: false,
    }));

    await supabase.from('client_information').insert(rows);
    setDone(true);
    setSaving(false);
  }

  const availableClients = clients.filter(c => !alreadyAssigned.has(c.id));
  const assignedClients = clients.filter(c => alreadyAssigned.has(c.id));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>Push to clients</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '1rem', fontWeight: 500 }}>
            "{article.title}"
          </p>

          {done ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <p style={{ color: 'var(--success)', fontWeight: 600 }}>Article pushed to {selected.size} client{selected.size !== 1 ? 's' : ''}</p>
            </div>
          ) : (
            <>
              {availableClients.length === 0 && assignedClients.length > 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7 }}>
                  All clients already have this article.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: 'var(--charcoal)', opacity: 0.6, marginBottom: '0.75rem' }}>
                    Select clients to send this article to:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {availableClients.map(client => (
                      <button
                        key={client.id}
                        onClick={() => toggle(client.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.65rem 0.9rem', borderRadius: 'var(--radius-sm)',
                          border: selected.has(client.id) ? '1.5px solid var(--navy)' : '1.5px solid var(--cream-dark)',
                          background: selected.has(client.id) ? 'var(--cream)' : 'transparent',
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          border: '1.5px solid', flexShrink: 0,
                          borderColor: selected.has(client.id) ? 'var(--navy)' : 'var(--cream-dark)',
                          background: selected.has(client.id) ? 'var(--navy)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selected.has(client.id) && <Check size={11} color="var(--cream)" strokeWidth={3} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--navy)' }}>{client.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--charcoal)', opacity: 0.6 }}>{client.email}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {assignedClients.length > 0 && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--cream-dark)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--charcoal)', opacity: 0.5, marginBottom: '0.4rem' }}>
                    Already assigned:
                  </p>
                  {assignedClients.map(c => (
                    <span key={c.id} style={{ fontSize: '0.78rem', color: 'var(--charcoal)', opacity: 0.6, marginRight: '0.5rem' }}>
                      {c.full_name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">{done ? 'Close' : 'Cancel'}</button>
          {!done && (
            <button onClick={handlePush} className="btn btn-primary"
              disabled={saving || selected.size === 0}>
              {saving ? 'Pushing...' : `Push to ${selected.size || ''} client${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', margin: 0 },
  pageSubtitle: { fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.6, marginTop: '0.3rem' },
  headerActions: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  aiBtn: { background: 'linear-gradient(135deg, rgba(196,122,90,0.15), rgba(47,69,111,0.1))', border: '1.5px solid rgba(196,122,90,0.4)', color: 'var(--terracotta-dark)', gap: '0.4rem' },
  aiPanel: { background: 'var(--white)', border: '1.5px solid rgba(196,122,90,0.3)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1.25rem' },
  aiPanelHeader: { display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' },
  aiPanelTitle: { fontWeight: 600, color: 'var(--navy)', fontSize: '0.9rem' },
  aiNote: { fontSize: '0.82rem', color: 'var(--charcoal)', opacity: 0.7, marginBottom: '0.75rem' },
  aiErrorMsg: { marginTop: '0.65rem', fontSize: '0.82rem', color: 'var(--danger)', background: 'rgba(220,53,69,0.06)', border: '1px solid rgba(220,53,69,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem' },
  filterBar: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' },
  searchWrapper: { position: 'relative' },
  searchIcon: { position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--navy)', opacity: 0.4 },
  categoryTabs: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  catTab: { padding: '0.3rem 0.75rem', borderRadius: '20px', border: '1.5px solid var(--cream-dark)', background: 'var(--white)', color: 'var(--charcoal)', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' },
  catTabActive: { background: 'var(--navy)', color: 'var(--cream)', borderColor: 'var(--navy)' },
  articleList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  articleCard: {},
  articleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem', width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' },
  articleInfo: { flex: 1, minWidth: 0 },
  articleTitle: { fontWeight: 500, color: 'var(--navy)', fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' },
  articleMeta: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  catPill: { fontSize: '0.68rem', background: 'rgba(47,69,111,0.08)', color: 'var(--navy)', borderRadius: '99px', padding: '0.1rem 0.5rem', fontWeight: 500 },
  articleActions: { display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 },
  actionBtn: { padding: '0.35rem', color: 'var(--navy)', opacity: 0.6 },
  articlePreview: { padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--cream-dark)' },
  previewContent: { marginTop: '1rem' },
  previewBox: { border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', minHeight: '200px', background: 'var(--off-white)' },
};
