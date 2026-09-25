'use client';

// The "Processing" card (Figma: GrooveSheet workspace, node 327:3454) and a
// section that lists the caller's in-flight jobs. Used on the history page and
// directly under the uploader on the homepage and Stem Splitter, so a user who
// closes the upload box still sees their song moving, or waiting in line.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useUser, useAuth } from '@/lib/auth';
import config from '@/lib/config';
import {
  fetchWorkflowList,
  fetchWorkflowStatus,
  resolveFileDisplayName,
  resolveWorkflowType,
} from '@/lib/api';
import { loadActiveJob } from '@/lib/activeJob';
import { isQueued, queueSummary } from '@/lib/queue';
import type { Workflow } from '@/lib/types';

// Same vocabulary the history page uses; kept here so both agree.
export const PROCESSING_STATES = ['initializing', 'started', 'processing', 'worker_processing', 'pending', 'running'];
export const isProcessing = (w: Workflow | null | undefined): boolean =>
  PROCESSING_STATES.includes(w?.status ?? '');

const INSTRUMENT_COLORS: Record<string, string> = {
  drums: '#f59e0b', bass: '#22c55e', jazz_bass: '#22c55e', piano: '#93b4ff', vocals: '#e879f9',
  guitar: '#fb7185', other: '#8d8c8d',
};
const instrumentLabel = (i: string) => (i === 'jazz_bass' ? 'Jazz bass' : i.charAt(0).toUpperCase() + i.slice(1));
const fileParts = (full: string) => {
  const i = full.lastIndexOf('.');
  return i === -1 ? { base: full, ext: '' } : { base: full.slice(0, i), ext: full.slice(i) };
};
// "03 Oct 2025" / "4:45", as in the design.
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });

const tagStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-foreground)',
  background: 'var(--color-surface-light)', border: '1px solid var(--color-border)', padding: '3px 9px',
  borderRadius: 6, whiteSpace: 'nowrap',
};

function InstrumentTag({ instrument }: { instrument?: string }) {
  const i = instrument || 'drums';
  return (
    <span style={tagStyle}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: INSTRUMENT_COLORS[i] || '#8d8c8d' }} />
      {instrumentLabel(i)}
    </span>
  );
}

// Stems / MIDI / Transcription: the same chip the history grid shows, so a
// job keeps its label from the queue through to the finished card.
function TypeTag({ workflow }: { workflow: Workflow }) {
  const t = resolveWorkflowType(workflow);
  return (
    <span style={tagStyle}>
      <span style={{ width: 7, height: 7, borderRadius: 2, background: t.color }} />
      {t.label}
    </span>
  );
}

export interface ProcessingCardProps {
  w: Workflow;
}

/**
 * One in-flight job. Layout follows the Figma card: date | time, the file
 * name at 24px with its extension, and a 36px bar whose blue segment carries
 * the percentage. While the job is still waiting for a worker there is no
 * progress to show, so the gray part of the bar says so ("Queued · 2nd in
 * line · about 60 minutes") instead of a separate status pill.
 */
export function ProcessingCard({ w }: ProcessingCardProps) {
  const name = resolveFileDisplayName(w);
  const { base, ext } = fileParts(name);
  const ds = w.created_at || w.completed_at || new Date().toISOString();
  const queued = isQueued(w);
  const progress = queued ? 0 : Math.max(0, Math.min(99, Math.round(w.progress || 0)));
  const summary = queued ? queueSummary(w.queue) : null;
  const queuedLabel = ['Queued', summary].filter(Boolean).join(' · ');
  const instrument = w.metadata?.instrument;
  return (
    <div style={{ background: 'var(--color-panel1)', border: '1px solid var(--color-border)', borderRadius: 13, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, lineHeight: '20.8px', color: 'var(--color-muted-foreground)' }}>
          <span>{fmtDate(ds)}</span>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-muted-foreground)' }} />
          <span>{fmtTime(ds)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minWidth: 0 }}>
          <div style={{ fontSize: 24, lineHeight: '31.2px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {base}<span style={{ color: 'var(--color-muted-foreground)' }}>{ext}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <TypeTag workflow={w} />
            {instrument && <InstrumentTag instrument={instrument} />}
            {w.is_preview === true && (
              <span style={{ fontSize: 12, padding: '3px 8px', borderRadius: 999, border: '1px solid var(--color-border)', color: 'var(--color-muted-foreground)', whiteSpace: 'nowrap' }}>10s preview</span>
            )}
          </div>
        </div>
      </div>
      <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={queued ? queuedLabel : `${progress}% done`} style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', background: 'var(--color-load-bar)' }}>
        {progress > 0 && (
          <div style={{ width: `${progress}%`, minWidth: 56, background: 'var(--color-primary)', color: '#fff', fontSize: 16, lineHeight: '20.8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'width .6s ease' }}>
            {progress}%
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', padding: '0 14px', color: '#fff', fontSize: 16, lineHeight: '20.8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {queued ? queuedLabel : (progress === 0 ? 'Starting…' : '')}
        </div>
      </div>
    </div>
  );
}

export interface ProcessingJobsProps {
  title?: string;
  style?: CSSProperties;
}

/**
 * The caller's jobs that are still running or waiting, polled every 10s.
 * Signed in: everything from /workflow/list (previews included). Signed out:
 * whatever this browser remembers submitting (see lib/activeJob).
 * Renders nothing when there is nothing in flight, which is also what the
 * server renders, so a Server Component page can include it safely.
 */
export default function ProcessingJobs({ title = 'Processing', style }: ProcessingJobsProps) {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<Workflow[]>([]);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!isLoaded) return undefined;

    const load = async () => {
      try {
        let items: Workflow[] = [];
        if (isSignedIn) {
          const data = await fetchWorkflowList(config.apiBaseUrl, getToken, null, { limit: 50, offset: 0 });
          items = Array.isArray(data?.items) ? data.items : [];
        } else {
          const ids = ['stem-splitter', 'midi-converter']
            .map((s) => loadActiveJob(s)?.jobId)
            .filter((id): id is string => Boolean(id));
          const statuses = await Promise.all(
            ids.map((id) => fetchWorkflowStatus(config.apiBaseUrl, id, getToken).catch(() => null))
          );
          items = statuses.filter((s): s is Workflow => s !== null);
        }
        if (alive.current) setJobs(items.filter(isProcessing));
      } catch {
        // Keep whatever is on screen; the next tick retries.
      }
    };

    load();
    const t = setInterval(load, 10000);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (!jobs.length) return null;

  return (
    <section aria-label={title} style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px 56px', display: 'flex', flexDirection: 'column', gap: 24, ...style }}>
      <h2 style={{ margin: 0, fontSize: 24, lineHeight: '32px', fontWeight: 400, color: 'var(--color-text)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {jobs.map((w, i) => <ProcessingCard key={w.workflow_id ?? i} w={w} />)}
      </div>
    </section>
  );
}
