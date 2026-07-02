import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { useAuth, useAuthActions } from '../auth';
import Header from './layout/Header';
import Footer from './layout/Footer';
import SkeletonPanel from './ui/SkeletonPanel';
import StatusMessage from './ui/StatusMessage';
import { BillingButtonStyles } from './AccountBilling';
import {
  fetchWorkflowList,
  fetchWorkflowStatus,
  resolveDisplayName,
  resolveAvailableOutputs,
  updateWorkflowVisibility,
  deleteWorkflow,
} from '../utils/api';
import config from '../config';

const INSTRUMENT_COLORS = {
  drums: '#f59e0b',
  bass: '#22c55e',
  jazz_bass: '#22c55e',
  piano: '#93b4ff',
  vocals: '#e879f9',
  guitar: '#fb923c',
  other: '#8d8c8d',
};
const instrumentLabel = (i) => (i === 'jazz_bass' ? 'Jazz bass' : i.charAt(0).toUpperCase() + i.slice(1));

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'title', label: 'Title A–Z' },
];

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'unlisted', label: 'Unlisted' },
  { id: 'private', label: 'Private' },
];
const INSTRUMENT_CHIPS = ['all', 'drums', 'piano', 'bass', 'vocals'];

const fileParts = (full) => {
  const i = full.lastIndexOf('.');
  return i === -1 ? { base: full, ext: '' } : { base: full.slice(0, i), ext: full.slice(i) };
};
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
const fmtDuration = (secs) => {
  if (!secs && secs !== 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const visibilityOf = (w) => w.visibility || 'private';

export const TranscriptionHistory = () => {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { signOut } = useAuthActions();

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [view, setView] = useState('grid');
  const [statusFilter, setStatusFilter] = useState('all');
  const [instrFilter, setInstrFilter] = useState('all');

  const [menuFor, setMenuFor] = useState(null); // workflow_id with open kebab
  const [popFor, setPopFor] = useState(null); // { id, kind: 'publish' | 'delete' }
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const listData = await fetchWorkflowList(config.apiBaseUrl, getToken, signOut);
        let ids = [];
        if (listData && Array.isArray(listData.workflow_ids)) ids = listData.workflow_ids;
        else if (Array.isArray(listData)) ids = listData;
        if (ids.length) {
          const statuses = await Promise.all(
            ids.map((id) =>
              fetchWorkflowStatus(config.apiBaseUrl, id, getToken, signOut).catch((err) => {
                if (err.isAuthError) throw err;
                return null;
              })
            )
          );
          if (!cancelled) setWorkflows(statuses.filter(Boolean));
        } else if (!cancelled) {
          setWorkflows([]);
        }
        if (!cancelled) setError(null);
      } catch (err) {
        if (cancelled) return;
        if (err.isAuthError) {
          setError('Your session has expired. You have been logged out.');
          setTimeout(() => navigate('/'), 2000);
        } else {
          setError(err.message);
        }
        setWorkflows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, signOut, navigate]);

  const handleDownload = async (workflowId, fileKey, filename) => {
    setMenuFor(null);
    try {
      const token = await getToken();
      const res = await fetch(`${config.apiBaseUrl}/workflow/download/${workflowId}/${fileKey}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        await signOut();
        navigate('/');
        return;
      }
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      notify('Failed to download file');
    }
  };

  const setVisibility = async (workflowId, visibility) => {
    setPopFor(null);
    setMenuFor(null);
    // Optimistic local update; revert silently if the endpoint is missing.
    setWorkflows((ws) => ws.map((w) => (w.workflow_id === workflowId ? { ...w, visibility } : w)));
    try {
      await updateWorkflowVisibility(config.apiBaseUrl, workflowId, visibility, getToken, signOut);
      notify(visibility === 'private' ? 'Unpublished' : `Published as ${visibility}`);
    } catch {
      notify('Publishing is not available yet');
    }
  };

  const doDelete = async (workflowId) => {
    setPopFor(null);
    setMenuFor(null);
    try {
      await deleteWorkflow(config.apiBaseUrl, workflowId, getToken, signOut);
      setWorkflows((ws) => ws.filter((w) => w.workflow_id !== workflowId));
      notify('Transcription deleted');
    } catch {
      notify('Deleting is not available yet');
    }
  };

  // ---- filter / group ----
  const all = Array.isArray(workflows) ? workflows : [];
  const matchesQuery = (w) => resolveDisplayName(w).toLowerCase().includes(query.toLowerCase());
  const instrOf = (w) => w.metadata?.instrument || 'drums';

  const visible = all.filter((w) => {
    if (!matchesQuery(w)) return false;
    if (instrFilter !== 'all' && instrOf(w) !== instrFilter) return false;
    const isProc = ['processing', 'pending', 'running'].includes(w.status);
    if (statusFilter !== 'all' && !isProc && visibilityOf(w) !== statusFilter) return false;
    if (statusFilter !== 'all' && isProc) return false;
    return true;
  });

  const processing = visible.filter((w) => ['processing', 'pending', 'running'].includes(w.status));
  const completed = visible.filter((w) => ['completed', 'success'].includes(w.status));

  const sorted = [...completed].sort((a, b) => {
    if (sort === 'title') return resolveDisplayName(a).localeCompare(resolveDisplayName(b));
    const da = new Date(a.created_at || a.completed_at || 0).getTime();
    const db = new Date(b.created_at || b.completed_at || 0).getTime();
    return sort === 'oldest' ? da - db : db - da;
  });

  const byYear = useMemo(() => {
    const m = {};
    for (const w of sorted) {
      const ds = w.created_at || w.completed_at;
      const y = ds ? new Date(ds).getFullYear() : new Date().getFullYear();
      (m[y] = m[y] || []).push(w);
    }
    return m;
  }, [sorted]);
  const years = Object.keys(byYear).sort((a, b) => b - a);

  const trulyEmpty = !loading && !error && all.length === 0;
  const noResults = !loading && !error && all.length > 0 && visible.length === 0;

  // ---- styles ----
  const page = { position: 'relative', minHeight: '100vh', background: 'var(--color-background)', color: 'var(--color-text)', fontFamily: 'var(--font-family-sans)', WebkitFontSmoothing: 'antialiased' };
  const dots = { position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)', backgroundSize: '43px 43px', opacity: 0.35 };
  const main = { position: 'relative', zIndex: 1, maxWidth: 1414, margin: '0 auto', padding: '18px 20px 80px' };
  const toolbarField = { height: 52, background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', borderRadius: 8 };
  const chipStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px', borderRadius: 6, cursor: 'pointer',
    fontFamily: 'var(--font-family-sans)', fontSize: 14, whiteSpace: 'nowrap', transition: 'all .15s ease',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text)',
  });
  const groupTitle = { fontSize: 22, lineHeight: '28px', fontWeight: 400, margin: 0, color: 'var(--color-foreground)' };
  const badge = (w) => {
    const v = visibilityOf(w);
    const map = {
      public: { label: 'Published', color: 'var(--color-primary)', dot: true },
      unlisted: { label: 'Unlisted', color: 'var(--color-warning)', dot: true },
      private: { label: 'Private', color: 'var(--color-muted-foreground)', lock: true },
    };
    return map[v] || map.private;
  };

  const Thumb = (w, h) => {
    if (w.cover_url) return <img src={w.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
    const color = INSTRUMENT_COLORS[instrOf(w)] || '#8d8c8d';
    return (
      <span style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${color}33, #15151a)` }}>
        <svg width={h ? 22 : 34} height={h ? 22 : 34} viewBox="0 0 24 24" fill="none" style={{ color }}>
          <path d="M9 18V5l11-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" /><circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
    );
  };

  const StatusBadge = (w) => {
    const b = badge(w);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 9px', borderRadius: 6, color: b.color, background: 'var(--color-surface-light)', border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {b.lock && <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" /></svg>}
        {b.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />}
        {b.label}
      </span>
    );
  };

  const InstrBadges = (w) => {
    const i = instrOf(w);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-foreground)', background: 'var(--color-surface-light)', border: '1px solid var(--color-border)', padding: '3px 9px', borderRadius: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: INSTRUMENT_COLORS[i] || '#8d8c8d' }} />
        {instrumentLabel(i)}
      </span>
    );
  };

  // Kebab menu (shared between grid + list).
  const KebabMenu = (w, anchorBottom) => {
    const avail = resolveAvailableOutputs(w);
    const v = visibilityOf(w);
    const published = v === 'public' || v === 'unlisted';
    const id = w.workflow_id;
    const menuStyle = { position: 'absolute', right: 0, [anchorBottom ? 'bottom' : 'top']: anchorBottom ? 50 : 46, zIndex: 60, width: 230, background: 'var(--color-panel1)', borderRadius: 10, padding: 6, boxShadow: '0 14px 40px rgba(0,0,0,.45)' };
    const item = (color) => ({ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: 'none', border: 'none', fontFamily: 'var(--font-family-sans)', fontSize: 14, color, padding: '9px 10px', borderRadius: 6, cursor: 'pointer' });
    const dl = { flex: 1, background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontFamily: 'var(--font-family-sans)', fontSize: 12, fontWeight: 500, padding: '7px 4px', borderRadius: 6, cursor: 'pointer' };
    return (
      <div role="menu" className="gs-pop" style={menuStyle} onClick={(e) => e.stopPropagation()}>
        <button role="menuitem" style={item('var(--color-primary)')} onClick={() => setPopFor({ id, kind: 'publish' })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V6M6 12l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {published ? 'Change visibility' : 'Publish…'}
        </button>
        {published && (
          <button role="menuitem" style={item('var(--color-text)')} onClick={() => setVisibility(id, 'private')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v8M8 9l4-4 4 4M5 19h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Unpublish
          </button>
        )}
        <button role="menuitem" style={item('var(--color-text)')} onClick={() => { setMenuFor(null); notify('Editing details is not available yet'); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M13.5 6.5l4 4" stroke="currentColor" strokeWidth="2" /></svg>
          Edit details
        </button>
        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 4px' }} />
        <div style={{ fontSize: 11, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--color-muted-foreground)', padding: '4px 10px 6px' }}>Download</div>
        <div style={{ display: 'flex', gap: 6, padding: '0 6px 4px' }}>
          <button className="gs-dl" style={dl} disabled={!avail.score.available && !avail.transcription.available} onClick={() => handleDownload(id, (avail.score.available ? avail.score.fileKey : avail.transcription.fileKey), `${id}.musicxml`)}>MusicXML</button>
          <button className="gs-dl" style={dl} disabled={!avail.midi.available} onClick={() => handleDownload(id, avail.midi.fileKey, `${id}.mid`)}>MIDI</button>
          <button className="gs-dl" style={dl} disabled={!avail.instrument.available} onClick={() => handleDownload(id, avail.instrument.fileKey, `${id}.wav`)}>Stems</button>
        </div>
        <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 4px' }} />
        <button role="menuitem" style={item('#FF6B7A')} onClick={() => setPopFor({ id, kind: 'delete' })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Delete
        </button>
      </div>
    );
  };

  const PublishPopover = (w, anchorBottom) => {
    const id = w.workflow_id;
    const cur = visibilityOf(w);
    const opts = [
      { v: 'public', label: 'Public', desc: 'On Explore · anyone can find & download' },
      { v: 'unlisted', label: 'Unlisted', desc: 'Only people with the link' },
      { v: 'private', label: 'Private', desc: 'Only you can see it' },
    ];
    return (
      <div role="dialog" aria-modal="true" className="gs-pop" style={{ position: 'absolute', right: 0, [anchorBottom ? 'bottom' : 'top']: anchorBottom ? 50 : 46, zIndex: 60, width: 300, background: 'var(--color-panel1)', borderRadius: 12, padding: 18, boxShadow: '0 14px 40px rgba(0,0,0,.45)', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', marginBottom: 3 }}>Publish settings</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 14, lineHeight: '18px' }}>Choose who can find this transcription.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((o) => {
            const active = cur === o.v;
            return (
              <button key={o.v} onClick={() => setVisibility(id, o.v)} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', background: active ? 'var(--color-surface-light)' : 'transparent', border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: '50%', border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`, flexShrink: 0, marginTop: 1 }}>
                  {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{o.label}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)', lineHeight: '16px' }}>{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="gs-btn gs-btn-secondary" style={{ flex: 1 }} onClick={() => setPopFor(null)}>Done</button>
        </div>
      </div>
    );
  };

  const DeletePopover = (w, anchorBottom) => (
    <div role="dialog" aria-modal="true" className="gs-pop" style={{ position: 'absolute', right: 0, [anchorBottom ? 'bottom' : 'top']: anchorBottom ? 50 : 46, zIndex: 60, width: 290, background: 'var(--color-panel1)', borderRadius: 12, padding: 18, boxShadow: '0 14px 40px rgba(0,0,0,.45)', textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,107,122,.14)', color: '#FF6B7A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)' }}>Delete this transcription?</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', lineHeight: '19px', marginBottom: 16 }}>
        This permanently removes <span style={{ color: 'var(--color-text)' }}>{resolveDisplayName(w)}</span> and all its files. This can't be undone.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="gs-btn gs-btn-secondary" style={{ flex: 1 }} onClick={() => setPopFor(null)}>Cancel</button>
        <button className="gs-btn gs-btn-destructive" style={{ flex: 1 }} onClick={() => doDelete(w.workflow_id)}>Delete</button>
      </div>
    </div>
  );

  const Card = (w) => {
    const name = resolveDisplayName(w);
    const { base, ext } = fileParts(name);
    const ds = w.created_at || w.completed_at || new Date().toISOString();
    const dur = fmtDuration(w.metadata?.duration_seconds ?? w.duration_seconds);
    const href = `/explore/${w.workflow_id}`;
    const open = menuFor === w.workflow_id;
    const pop = popFor && popFor.id === w.workflow_id ? popFor.kind : null;
    return (
      <div className="gs-card" key={w.workflow_id} style={{ background: 'var(--color-panel2)', borderRadius: 13, border: '1px solid transparent', overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
        <a href={href} aria-label={`Open ${name}`} style={{ position: 'relative', display: 'block', height: 172, borderRadius: '13px 13px 0 0', overflow: 'hidden', background: '#15151a' }}>
          {Thumb(w)}
          {dur && (
            <span style={{ position: 'absolute', left: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,.55)', padding: '5px 10px', borderRadius: 999 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5Z" /></svg>{dur}
            </span>
          )}
        </a>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
          {StatusBadge(w)}
          <a href={href} style={{ fontSize: 17, fontWeight: 500, color: 'var(--color-text)', lineHeight: '22px', textDecoration: 'none' }}>{base}</a>
          <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span>{base}</span><span style={{ opacity: 0.6 }}>{ext}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', display: 'flex', alignItems: 'center', gap: 9 }}>
            {fmtDate(ds)}<span style={{ width: 1, height: 11, background: 'var(--color-border)' }} />{fmtTime(ds)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>{InstrBadges(w)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
            <a href={href} className="gs-btn gs-btn-secondary" style={{ flex: 1 }}>
              Open <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </a>
            <div style={{ position: 'relative' }}>
              <button aria-haspopup="menu" aria-expanded={open} aria-label="More actions" onClick={(e) => { e.stopPropagation(); setPopFor(null); setMenuFor(open ? null : w.workflow_id); }} style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', cursor: 'pointer' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
              </button>
              {open && !pop && KebabMenu(w, true)}
              {pop === 'publish' && PublishPopover(w, true)}
              {pop === 'delete' && DeletePopover(w, true)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ListRow = (w) => {
    const name = resolveDisplayName(w);
    const { base, ext } = fileParts(name);
    const ds = w.created_at || w.completed_at || new Date().toISOString();
    const dur = fmtDuration(w.metadata?.duration_seconds ?? w.duration_seconds);
    const href = `/explore/${w.workflow_id}`;
    const open = menuFor === w.workflow_id;
    const pop = popFor && popFor.id === w.workflow_id ? popFor.kind : null;
    return (
      <div className="gs-row" key={w.workflow_id} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,2.4fr) 1.4fr 1.5fr 0.9fr 0.6fr 88px', gap: 16, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--color-border)' }}>
        <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, textDecoration: 'none' }}>
          <span style={{ width: 54, height: 40, borderRadius: 7, overflow: 'hidden', flexShrink: 0, display: 'block' }}>{Thumb(w, true)}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{base}</span>
            <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{base}<span style={{ opacity: 0.6 }}>{ext}</span></span>
          </span>
        </a>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>{InstrBadges(w)}</div>
        <div style={{ minWidth: 0 }}>{StatusBadge(w)}</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap' }}>{fmtDate(ds)}</div>
        <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap' }}>{dur || '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', position: 'relative' }}>
          <a href={href} aria-label={`Open ${name}`} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', textDecoration: 'none' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <button aria-haspopup="menu" aria-expanded={open} aria-label="More actions" onClick={(e) => { e.stopPropagation(); setPopFor(null); setMenuFor(open ? null : w.workflow_id); }} style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-text)', cursor: 'pointer' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
          {open && !pop && KebabMenu(w, false)}
          {pop === 'publish' && PublishPopover(w, false)}
          {pop === 'delete' && DeletePopover(w, false)}
        </div>
      </div>
    );
  };

  return (
    <div style={page} onClick={() => { setMenuFor(null); setPopFor(null); setSortOpen(false); }}>
      <BillingButtonStyles />
      <style>{`
        @keyframes gsDot{0%,100%{opacity:.35;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}
        @keyframes gsSpin{to{transform:rotate(360deg)}}
        @keyframes gsBarMove{0%{background-position:0 0}100%{background-position:34px 0}}
        .gs-card{transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}
        .gs-card:hover{transform:translateY(-2px);border-color:var(--color-surface-muted);box-shadow:0 10px 30px rgba(0,0,0,.28)}
        .gs-row{transition:background .15s ease}
        .gs-row:last-child{border-bottom:none!important}
        .gs-row:hover{background:var(--color-surface-light)}
        .gs-dl:hover:not(:disabled){border-color:var(--color-primary)!important;color:var(--color-primary)!important}
        .th-search input::placeholder{color:var(--color-muted-foreground)}
      `}</style>
      <div style={dots} />
      <Header />

      <main style={main}>
        <button className="back-button" onClick={() => navigate('/')} style={{ marginBottom: 18 }}>
          <ArrowLeft size={24} /><span>Back</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h1 style={{ fontSize: 40, lineHeight: '48px', fontWeight: 400, margin: 0, color: 'var(--color-text)' }}>Your Library</h1>
            <p style={{ fontSize: 18, lineHeight: '25px', color: 'var(--color-muted-foreground)', margin: 0, maxWidth: 540 }}>
              Every transcription you've made — in progress, ready, and published. We store your files for 1 year.
            </p>
          </div>
          <a href="/" className="gs-btn gs-btn-primary" style={{ whiteSpace: 'nowrap' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            New transcription
          </a>
        </div>

        {loading && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
              <SkeletonPanel count={6} height={300} />
            </div>
          </div>
        )}

        {!loading && error && <StatusMessage variant="error" title="Couldn't load your library">{error}</StatusMessage>}

        {trulyEmpty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 18, padding: '90px 20px', background: 'var(--color-panel2)', borderRadius: 13 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, background: 'var(--color-surface-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l11-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" /><circle cx="17" cy="16" r="3" stroke="currentColor" strokeWidth="2" /></svg>
            </div>
            <h2 style={{ fontSize: 26, lineHeight: '33px', fontWeight: 400, margin: 0, color: 'var(--color-text)' }}>Your library is empty</h2>
            <p style={{ fontSize: 18, lineHeight: '26px', color: 'var(--color-muted-foreground)', margin: 0, maxWidth: 440 }}>Upload an audio file and we'll turn it into clean notation in seconds. Everything you transcribe lands here.</p>
            <a href="/" className="gs-btn gs-btn-primary" style={{ marginTop: 6 }}>Transcribe your first song</a>
          </div>
        )}

        {!loading && !error && all.length > 0 && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <div className="th-search" style={{ ...toolbarField, flex: 1, minWidth: 240, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <MagnifyingGlass size={20} style={{ color: 'var(--color-muted-foreground)', flexShrink: 0 }} />
                <input type="text" aria-label="Search by filename or title" placeholder="Search by filename or title" value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-family-sans)', fontSize: 16, color: 'var(--color-text)', minWidth: 0 }} />
              </div>
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button aria-haspopup="listbox" aria-expanded={sortOpen} onClick={() => setSortOpen((o) => !o)} style={{ ...toolbarField, display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--color-text)', fontSize: 15, fontFamily: 'var(--font-family-sans)', padding: '0 16px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--color-muted-foreground)' }}>Sort:</span> {SORT_OPTIONS.find((s) => s.id === sort).label}
                  <svg width="14" height="9" viewBox="0 0 17 10" fill="none"><path d="M8.1 9.5L.6 2 1.66.95 8.1 7.4 14.56.95 15.6 2 8.1 9.5Z" fill="currentColor" /></svg>
                </button>
                {sortOpen && (
                  <ul role="listbox" className="gs-pop" style={{ position: 'absolute', top: 58, right: 0, zIndex: 30, minWidth: 200, background: 'var(--color-panel1)', borderRadius: 8, padding: 6, margin: 0, listStyle: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.37)' }}>
                    {SORT_OPTIONS.map((opt) => (
                      <li key={opt.id} role="option" aria-selected={sort === opt.id} onClick={() => { setSort(opt.id); setSortOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 6, fontSize: 14, color: 'var(--color-text)', cursor: 'pointer' }}>
                        <span>{opt.label}</span>
                        {sort === opt.id && <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div role="group" aria-label="View" style={{ ...toolbarField, display: 'flex', padding: 4 }}>
                {['grid', 'list'].map((v) => (
                  <button key={v} onClick={() => setView(v)} aria-pressed={view === v} aria-label={v} style={{ width: 44, display: 'grid', placeItems: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: view === v ? 'var(--color-primary)' : 'transparent', color: view === v ? '#fff' : 'var(--color-muted-foreground)' }}>
                    {v === 'grid' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', marginBottom: 30, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>Status</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STATUS_CHIPS.map((c) => (
                    <button key={c.id} onClick={() => setStatusFilter(c.id)} aria-pressed={statusFilter === c.id} style={chipStyle(statusFilter === c.id)}>{c.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-muted-foreground)' }}>Instrument</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {INSTRUMENT_CHIPS.map((c) => (
                    <button key={c} onClick={() => setInstrFilter(c)} aria-pressed={instrFilter === c} style={chipStyle(instrFilter === c)}>{c === 'all' ? 'All' : instrumentLabel(c)}</button>
                  ))}
                </div>
              </div>
            </div>

            {noResults && <p style={{ color: 'var(--color-muted-foreground)' }}>No transcriptions match your filters.</p>}

            {/* Processing */}
            {processing.length > 0 && (
              <section style={{ marginBottom: 56 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-primary)', animation: 'gsDot 1.4s ease infinite' }} />
                  <h2 style={groupTitle}>Processing</h2>
                  <span style={{ fontSize: 16, color: 'var(--color-muted-foreground)' }}>{processing.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {processing.map((w) => {
                    const name = resolveDisplayName(w);
                    const { base, ext } = fileParts(name);
                    const ds = w.created_at || w.completed_at || new Date().toISOString();
                    const progress = w.progress || 0;
                    return (
                      <div key={w.workflow_id} style={{ background: 'var(--color-panel2)', borderRadius: 13, padding: '22px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: 'var(--color-muted-foreground)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span>{fmtDate(ds)}</span><span style={{ width: 1, height: 12, background: 'var(--color-border)' }} /><span>{fmtTime(ds)}</span>
                            </div>
                            <div style={{ fontSize: 18, color: 'var(--color-text)' }}><span style={{ fontWeight: 500 }}>{base}</span><span style={{ color: 'var(--color-muted-foreground)' }}>{ext}</span></div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>{InstrBadges(w)}</div>
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 500, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap', lineHeight: 1 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: 'gsSpin 1s linear infinite' }}><circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.35)" strokeWidth="2.4" /><path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
                            Processing
                          </span>
                        </div>
                        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} style={{ flex: 1, height: 8, borderRadius: 6, background: 'var(--color-surface-light)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 6, background: 'linear-gradient(90deg,#012FA7,#0139C7)', backgroundSize: '34px 100%', animation: 'gsBarMove 1s linear infinite' }} />
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)', minWidth: 42, textAlign: 'right' }}>{progress}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Year groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 56 }}>
              {years.map((y) => (
                <section key={y}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
                    <h2 style={groupTitle}>{y}</h2>
                    <span style={{ fontSize: 16, color: 'var(--color-muted-foreground)' }}>{byYear[y].length}</span>
                  </div>
                  {view === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 24 }}>
                      {byYear[y].map(Card)}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--color-panel2)', borderRadius: 13 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,2.4fr) 1.4fr 1.5fr 0.9fr 0.6fr 88px', gap: 16, alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                        <span>Title</span><span>Instruments</span><span>Status</span><span>Added</span><span>Length</span><span />
                      </div>
                      {byYear[y].map(ListRow)}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />

      {toast && (
        <div role="status" style={{ position: 'fixed', left: 24, bottom: 24, zIndex: 70, background: 'rgba(20,20,22,.96)', color: '#fff', border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: '12px 18px', fontFamily: 'var(--font-family-alt)', fontSize: 14, boxShadow: '0 10px 40px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4f7cff' }} />{toast}
        </div>
      )}
    </div>
  );
};

export default TranscriptionHistory;
