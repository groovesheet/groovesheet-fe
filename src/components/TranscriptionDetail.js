// Owner-only song page — /transcription-history/:workflowId.
//
// The Library's "Open" used to lead to /explore/:trackId, which only resolves
// *published* library tracks: a private transcription had nowhere to go. This
// route gives every transcription the same viewer stack the public song page
// uses (sheet / piano roll / stems on one transport), read from the owner's own
// workflow outputs instead of library assets.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAuth, useAuthActions } from '../auth';
import Header from './layout/Header';
import Footer from './layout/Footer';
import SkeletonPanel from './ui/SkeletonPanel';
import StatusMessage from './ui/StatusMessage';
import TranscriptionResultView from './TranscriptionResult/TranscriptionResultView';
import { BillingButtonStyles } from './AccountBilling';
import { useLocalizedNavigate } from '../i18n/locale';
import {
  downloadScorePdf,
  downloadWorkflowFile,
  fetchWorkflowStatus,
  resolveAvailableOutputs,
  resolveDescription,
  resolveDisplayName,
  resolveInstrument,
} from '../utils/api';
import config from '../config';
import usePageMeta from '../hooks/usePageMeta';

const PROCESSING_STATES = ['initializing', 'started', 'processing', 'worker_processing', 'pending', 'running'];
const COMPLETED_STATES = ['completed', 'success'];

const page = {
  position: 'relative',
  minHeight: '100vh',
  background: 'var(--color-background)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-family-sans)',
  WebkitFontSmoothing: 'antialiased',
};
const dots = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)',
  backgroundSize: '43px 43px',
  opacity: 0.35,
};
// 1414 + 2×20 gutter: lines the content up with the nav bar (Header.css).
const main = { position: 'relative', zIndex: 1, maxWidth: 1454, margin: '0 auto', padding: '48px 20px 40px' };

const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export default function TranscriptionDetail() {
  const { workflowId } = useParams();
  const navigate = useLocalizedNavigate();
  const { getToken, isSignedIn } = useAuth();
  const { signOut } = useAuthActions();

  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  const load = useCallback(async () => {
    const data = await fetchWorkflowStatus(config.apiBaseUrl, workflowId, getToken, signOut);
    setWorkflow(data);
    return data;
  }, [workflowId, getToken, signOut]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await load();
        if (!cancelled) setError(data ? null : 'Transcription not found');
      } catch (err) {
        if (cancelled) return;
        // The status route answers a missing/other-user workflow with a detail
        // string, not a typed error — match on it so the reader gets copy.
        const message = err?.message || '';
        setError(
          /not found|Access denied/i.test(message)
            ? "We couldn't find that transcription. It may have been deleted, or it belongs to another account."
            : message || 'Could not load this transcription'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [load]);

  const status = workflow?.status;
  const isProcessing = PROCESSING_STATES.includes(status);
  const isCompleted = COMPLETED_STATES.includes(status);

  // A job still running finishes on this page rather than sending the reader
  // back to the Library to wait.
  useEffect(() => {
    if (!isProcessing) return undefined;
    const timer = setInterval(() => { load().catch(() => {}); }, 10000);
    return () => clearInterval(timer);
  }, [isProcessing, load]);

  const title = workflow ? resolveDisplayName(workflow) : 'Transcription';
  const description = workflow ? resolveDescription(workflow) : '';
  const instrument = workflow ? resolveInstrument(workflow) || 'drums' : 'drums';
  const outputs = useMemo(() => (workflow ? resolveAvailableOutputs(workflow) : null), [workflow]);

  usePageMeta(title, description);

  const download = useCallback(async (fileKey, fallbackName) => {
    if (!fileKey) return;
    setDownloadError(null);
    try {
      const result = await downloadWorkflowFile(config.apiBaseUrl, workflowId, fileKey, getToken);
      if (!result?.blob) {
        setDownloadError('That file is not available for this transcription.');
        return;
      }
      // The server names downloads after the song; fallbackName only covers a
      // response whose Content-Disposition never made it through.
      saveBlob(result.blob, result.filename || fallbackName);
    } catch (err) {
      setDownloadError(err?.message || 'Failed to download file.');
    }
  }, [workflowId, getToken]);

  // The printable engraving; rendered on demand from the score MusicXML.
  const downloadPdf = useCallback(async () => {
    setDownloadError(null);
    try {
      const result = await downloadScorePdf(config.apiBaseUrl, workflowId, getToken);
      if (!result?.blob) {
        setDownloadError('This transcription has no score to print.');
        return;
      }
      saveBlob(result.blob, result.filename || 'score_groovesheet.pdf');
    } catch (err) {
      setDownloadError(err?.message || 'Could not render the score as a PDF.');
    }
  }, [workflowId, getToken]);

  const safeBase = title.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, ' ').trim() || 'transcription';
  const fallback = (kind, ext) => [safeBase, instrument, kind, 'groovesheet'].filter(Boolean).join('_') + ext;

  const scoreKey = outputs?.score?.available ? outputs.score.fileKey : outputs?.transcription?.fileKey;

  // Same "← Back" as every other account page (styles come from
  // BillingButtonStyles; without them the arrow and label stacked).
  const backButton = (
    <button className="back-button" onClick={() => navigate('/account/history')} style={{ marginBottom: 36 }}>
      <ArrowLeft size={28} weight="regular" /><span>Back</span>
    </button>
  );

  return (
    <div style={page}>
      <BillingButtonStyles />
      <div style={dots} />
      <Header />
      <main style={main}>
        {backButton}

        {loading && (
          <div style={{ display: 'grid', gap: 16 }}>
            <SkeletonPanel count={1} height={72} />
            <SkeletonPanel count={1} height={520} />
          </div>
        )}

        {!loading && error && (
          <StatusMessage variant="error" title="Couldn't open this transcription">{error}</StatusMessage>
        )}

        {!loading && !error && workflow && !isCompleted && (
          <div style={{ background: 'var(--color-panel2)', borderRadius: 13, padding: '48px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 400, margin: 0 }}>{title}</h1>
            <p style={{ color: 'var(--color-muted-foreground)', margin: 0 }}>{description}</p>
            {isProcessing ? (
              <StatusMessage variant="info">
                Still transcribing — {workflow.progress || 0}% done. This page updates itself.
              </StatusMessage>
            ) : (
              <StatusMessage variant="error" title="This transcription failed">
                {workflow.error || 'Processing failed'}. Your minutes for this run were refunded automatically.
              </StatusMessage>
            )}
          </div>
        )}
      </main>

      {!loading && !error && workflow && isCompleted && (
        <TranscriptionResultView
          variant="page"
          workflowId={workflowId}
          title={title}
          subtitle={description}
          fileName={workflow.metadata?.original_filename || title}
          selectedInstrument={instrument}
          prefetchedFiles={null}
          files={workflow.outputs?.files || null}
          durationHint={workflow.preview_output_sec || workflow.metadata?.duration_seconds || null}
          onDownloadTranscription={() => download(scoreKey, fallback('score', '.musicxml'))}
          onDownloadMidi={() => download(outputs?.midi?.fileKey, fallback('midi', '.mid'))}
          onDownloadPdf={downloadPdf}
          onDownloadStem={() => download(outputs?.instrument?.fileKey, fallback('stem', '.wav'))}
          onReset={null}
          downloadError={downloadError}
          isSignedIn={isSignedIn}
        />
      )}

      <Footer />
    </div>
  );
}
