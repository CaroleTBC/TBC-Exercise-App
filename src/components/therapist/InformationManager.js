import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Plus, Trash2, X, ChevronDown, ChevronUp, Search, Edit2, Sparkles } from 'lucide-react';

const CATEGORIES = ['General', 'Osteoporosis', 'Exercise Tips', 'Home Care', 'Nutrition', 'Lifestyle'];

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

function MarkdownContent({ text }) {
  if (!text) return null;
  const elements = [];
  text.split('\n').forEach((line, i) => {
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} style={{ fontSize: '0.95rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.75rem 0 0.3rem' }}>{parseInline(line.slice(4))}</h4>);
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} style={{ fontSize: '1.05rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.75rem 0 0.3rem' }}>{parseInline(line.slice(3))}</h3>);
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} style={{ fontSize: '1.15rem', color: 'var(--navy)', fontFamily: 'var(--font-serif)', fontWeight: 600, margin: '0.75rem 0 0.3rem' }}>{parseInline(line.slice(2))}</h2>);
    } else if (line.match(/^[-*] /)) {
      elements.push(<div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.2rem' }}><span style={{ color: 'var(--terracotta)', fontWeight: 700 }}>•</span><span style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--charcoal)' }}>{parseInline(line.slice(2))}</span></div>);
    } else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: '0.4rem' }} />);
    } else {
      elements.push(<p key={i} style={{ margin: 0, lineHeight: 1.75, fontSize: '0.9rem', color: 'var(--charcoal)' }}>{parseInline(line)}</p>);
    }
  });
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>{elements}</div>;
}

export default function InformationManager() {
  const { profile } = useAuth();
  const [articles, setArticles] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefill, setAddPrefill] = useState(null);   // pre-filled data for new article (from AI)
  const [editingArticle, setEditingArticle] = useState(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiClient, setAiClient] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const selectedClient = clients.find(c => c.id === aiClient);
      const response = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/generate-information`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            prompt: aiPrompt,
            client_name: selectedClient?.full_name || null,
          }),
        }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Generation failed');
      }
      const data = await response.json();
      const generated = data.article;
      // Pre-fill the add modal with AI-generated content
      setAddPrefill({
        client_id: aiClient || '',
        title: generated.title || '',
        content: generated.content || '',
        category: generated.category || 'General',
        is_pinned: false,
      });
      setShowAiPanel(false);
      setShowAdd(true);
    } catch (err) {
      alert('AI generation failed. Please try again or add the article manually.');
    } finally {
      setAiLoading(false);
    }
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [{ data: arts }, { data: cls }] = await Promise.all([
        supabase
          .from('client_information')
          .select('*, client:profiles!client_information_client_id_fkey(id, full_name)')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name').eq('role', 'client').order('full_name'),
      ]);
      setArticles(arts || []);
      setClients(cls || []);
    } catch (err) {
      console.error('Failed to load information:', err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteArticle(id) {
    if (!window.confirm('Delete this article?')) return;
    const { error } = await supabase.from('client_information').delete().eq('id', id);
    if (error) { alert('Failed to delete.'); return; }
    setArticles(prev => prev.filter(a => a.id !== id));
  }

  async function addArticle(form) {
    const { data, error } = await supabase
      .from('client_information')
      .insert({ ...form, therapist_id: profile.id })
      .select('*, client:profiles!client_information_client_id_fkey(id, full_name)')
      .single();
    if (error) { alert('Failed to save article.'); return; }
    setArticles(prev => [data, ...prev]);
    setShowAdd(false);
  }

  async function updateArticle(id, form) {
    const { data, error } = await supabase
      .from('client_information')
      .update(form)
      .eq('id', id)
      .select('*, client:profiles!client_information_client_id_fkey(id, full_name)')
      .single();
    if (error) { alert('Failed to update article.'); return; }
    setArticles(prev => prev.map(a => a.id === id ? data : a));
    setEditingArticle(null);
  }

  const filtered = articles.filter(a => {
    const matchesClient = !filterClient || a.client_id === filterClient;
    const matchesSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase()) ||
      a.client?.full_name?.toLowerCase().includes(search.toLowerCase());
    return matchesClient && matchesSearch;
  });

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><span className="spinner" /></div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Information Articles</h1>
          <p style={styles.pageSubtitle}>{articles.length} article{articles.length !== 1 ? 's' : ''} across {clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowAiPanel(v => !v)}
            className="btn"
            style={styles.aiBtn}
          >
            <Sparkles size={15} /> AI Generate
          </button>
          <button onClick={() => { setAddPrefill(null); setShowAdd(true); }} className="btn btn-primary">
            <Plus size={15} /> Add Article
          </button>
        </div>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div style={styles.aiPanel} className="fade-in">
          <div style={styles.aiPanelHeader}>
            <Sparkles size={15} color="var(--terracotta)" />
            <span style={styles.aiPanelTitle}>Generate an information article with AI</span>
            <button onClick={() => setShowAiPanel(false)} className="btn btn-ghost" style={{ marginLeft: 'auto', padding: '0.25rem' }}>
              <X size={15} />
            </button>
          </div>
          <p style={styles.aiNote}>
            Describe what you need — the AI will draft the article for you to review and edit before saving.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <select
              className="form-select"
              style={{ maxWidth: '200px' }}
              value={aiClient}
              onChange={e => setAiClient(e.target.value)}
            >
              <option value="">No specific client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div style={styles.aiInputRow}>
            <input
              type="text"
              className="form-input"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. what to expect after a DEXA scan, hip fracture prevention tips, importance of calcium and vitamin D"
              onKeyDown={e => e.key === 'Enter' && generateWithAI()}
            />
            <button
              onClick={generateWithAI}
              className="btn btn-secondary"
              disabled={aiLoading || !aiPrompt.trim()}
              style={{ flexShrink: 0 }}
            >
              {aiLoading ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Sparkles size={14} />}
              {aiLoading ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      <div style={styles.filterBar}>
        <div style={styles.searchWrapper}>
          <Search size={14} style={styles.searchIcon} />
          <input
            type="search"
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search articles..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: '200px' }}
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{articles.length === 0 ? 'No articles yet. Add one to get started.' : 'No articles match your search.'}</p>
        </div>
      ) : (
        <div style={styles.articleList}>
          {filtered.map(article => {
            const isExpanded = expandedId === article.id;
            return (
              <div key={article.id} className="card" style={styles.articleCard}>
                {article.is_pinned && <div style={styles.pinnedBar}>📌 Pinned</div>}
                <div style={styles.articleHeader}>
                  <div style={styles.articleMeta}>
                    <span style={styles.clientBadge}>{article.client?.full_name}</span>
                    <span style={styles.categoryBadge}>{article.category}</span>
                  </div>
                  <div style={styles.articleActions}>
                    <button onClick={() => setExpandedId(isExpanded ? null : article.id)} className="btn btn-ghost" style={{ padding: '0.3rem' }}>
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => setEditingArticle(article)} className="btn btn-ghost" style={{ padding: '0.3rem' }} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteArticle(article.id)} className="btn btn-ghost" style={{ padding: '0.3rem', color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={styles.articleTitleRow}>
                  <h3 style={styles.articleTitle}>{article.title}</h3>
                  <span style={styles.articleDate}>
                    {new Date(article.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {!isExpanded && (
                  <p style={styles.articlePreview}>
                    {article.content.replace(/[#*]/g, '').trim().slice(0, 160)}{article.content.length > 160 ? '…' : ''}
                  </p>
                )}

                {isExpanded && (
                  <div style={styles.articleBody} className="slide-up">
                    <MarkdownContent text={article.content} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddArticleModal
          clients={clients}
          initial={addPrefill}
          onAdd={addArticle}
          onClose={() => { setShowAdd(false); setAddPrefill(null); }}
        />
      )}

      {editingArticle && (
        <AddArticleModal
          clients={clients}
          initial={editingArticle}
          isEditMode
          onAdd={form => updateArticle(editingArticle.id, form)}
          onClose={() => setEditingArticle(null)}
        />
      )}
    </div>
  );
}

function AddArticleModal({ clients, onAdd, onClose, initial, isEditMode }) {
  const isEdit = !!isEditMode;
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? '',
    title: initial?.title ?? '',
    content: initial?.content ?? '',
    category: initial?.category ?? 'General',
    is_pinned: initial?.is_pinned ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.client_id) { alert('Please select a client.'); return; }
    if (!form.title.trim()) { alert('Please add a title.'); return; }
    if (!form.content.trim()) { alert('Please add some content.'); return; }
    setSaving(true);
    await onAdd(form);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem' }}>{isEdit ? 'Edit Article' : 'Add Information Article'}</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.4rem' }}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Client *</label>
              <select className="form-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                <option value="">Select a client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input type="text" className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Understanding Osteoporosis" />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--charcoal)', opacity: 0.6, marginBottom: '0.5rem' }}>
              Supports markdown: ## Heading, **bold**, *italic*, - bullet points
            </p>
            <textarea
              className="form-textarea"
              rows={10}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="## Introduction&#10;&#10;Write your article here…"
              style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_pinned} onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))} />
            Pin this article (appears at the top for the client)
          </label>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ gap: '0.5rem' }}>
            {saving ? <span className="spinner" style={{ width: '1rem', height: '1rem', borderWidth: '2px' }} /> : <Plus size={15} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Article'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '1.5rem', maxWidth: '900px', margin: '0 auto' },
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' },
  pageTitle: { fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', margin: 0 },
  pageSubtitle: { fontSize: '0.85rem', color: 'var(--charcoal)', opacity: 0.6, marginTop: '0.3rem' },
  filterBar: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  searchWrapper: { position: 'relative', flex: 1, minWidth: '180px' },
  searchIcon: { position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--navy)', opacity: 0.4, pointerEvents: 'none' },
  articleList: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  articleCard: { overflow: 'hidden' },
  pinnedBar: { background: 'var(--terracotta)', padding: '0.3rem 1rem', fontSize: '0.72rem', color: 'white', fontWeight: 600 },
  articleHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1rem 0' },
  articleMeta: { display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' },
  clientBadge: { background: 'var(--navy)', color: 'var(--cream)', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 500 },
  categoryBadge: { background: 'rgba(196,122,90,0.12)', color: 'var(--terracotta)', borderRadius: '20px', padding: '0.2rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' },
  articleActions: { display: 'flex', gap: '0.25rem' },
  articleTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.4rem 1rem 0', gap: '0.5rem' },
  articleTitle: { fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--navy)', fontWeight: 500, margin: 0 },
  articleDate: { fontSize: '0.72rem', color: 'var(--charcoal)', opacity: 0.4, whiteSpace: 'nowrap' },
  articlePreview: { padding: '0.5rem 1rem 1rem', fontSize: '0.875rem', color: 'var(--charcoal)', opacity: 0.7, lineHeight: 1.6, margin: 0 },
  articleBody: { padding: '0.5rem 1rem 1.25rem' },
  aiBtn: { background: 'rgba(196,122,90,0.12)', color: 'var(--terracotta)', border: '1px solid rgba(196,122,90,0.25)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' },
  aiPanel: { background: 'var(--cream)', border: '1px solid var(--cream-dark)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' },
  aiPanelHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  aiPanelTitle: { fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--navy)' },
  aiNote: { fontSize: '0.8rem', color: 'var(--charcoal)', opacity: 0.65, margin: '0 0 0.75rem' },
  aiInputRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
};
