'use client';

/* eslint-disable @next/next/no-img-element -- the format artwork swaps with the theme; same markup as the CRA card */
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { LuGuitar, LuDrum } from 'react-icons/lu';
import { LiaMicrophoneAltSolid } from 'react-icons/lia';
import { Piano } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from '@/lib/navigation';
import { useUser, useAuth } from '@/lib/auth';
import { authenticatedFetch, apiPrefixForId } from '@/lib/api';
import { queueSummary } from '@/lib/queue';
import { saveActiveJob, loadActiveJob, clearActiveJob } from '@/lib/activeJob';
import { FUNNEL, trackFunnel, trackWorkflowStarted } from '@/lib/analytics';
import { previewFetch, startPreview, setPendingPreviewId, upgradeToFull } from '@/lib/previewApi';
import { useFullSongFlow, type UpgradeOutcome, type UpgradeTrigger } from '@/lib/hooks/useFullSongFlow';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/constants';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { useIsTouch } from '@/lib/hooks/useMediaQuery';
import config from '@/lib/config';
import type { WorkflowQueue } from '@/lib/types';
import StatusMessage from '@/components/ui/StatusMessage';
import { BassIcon, MagicWandIcon, ServerIcon, TrayArrowUpIcon } from './icons';
import ResultView from './ResultView';
import {
  UPLOAD_ACCEPT,
  errorInfo,
  failureMessage,
  filenameFromResponse,
  isCompletedStatus,
  isFailedStatus,
  makeFileTypeCheck,
  trackPointer,
  triggerDownload,
  uiStateFor,
  useCompletionConfetti,
  useProgressSimulation,
  type StartPayload,
  type StatusPayload,
} from './shared';
import '../Hero.css';

const isSupportedFileType = makeFileTypeCheck([
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/x-flac',
  'audio/ogg',
  'audio/x-ogg',
  'audio/basic',
  'audio/x-au',
  'audio/x-nist',
]);

const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES;

const API_BASE_URL = config.apiBaseUrl;

// Which surface started the job. Stored in the workflow metadata so
// /account/history can label a row by where it came from: the backend
// workflow name alone can't tell a MIDI conversion from a transcription.
const UPLOAD_SOURCE = 'stem_splitter';

// Key for the resumable job in localStorage (lib/activeJob).
const SURFACE = 'stem-splitter';
// How long a finished preview comes back after a reload.
const FINISHED_PREVIEW_TTL_MS = 2 * 60 * 60 * 1000;

// NOTE: Download key maps and download handlers are shared across the home,
// MIDI converter and stem splitter cards and TranscriptionHistory. When
// changing download logic here, update those too.
// BS-Roformer outputs 6 stems: vocals, drums, bass, guitar, piano, other.
const STEM_KEYS: Record<string, string> = {
  vocals: 'bs_roformer_vocals_stem',
  drums: 'bs_roformer_drums_stem',
  bass: 'bs_roformer_bass_stem',
  piano: 'bs_roformer_piano_stem',
  guitar: 'bs_roformer_guitar_stem',
  other: 'bs_roformer_other_stem',
};

const INSTRUMENTS = [
  { value: 'vocals', label: 'Vocal', icon: LiaMicrophoneAltSolid },
  { value: 'drums', label: 'Drums', icon: LuDrum },
  { value: 'piano', label: 'Piano', icon: Piano },
  { value: 'guitar', label: 'Guitar', icon: LuGuitar },
  { value: 'bass', label: 'Bass', icon: BassIcon },
];

interface StemSplitterUploaderProps {
  /** Server-rendered heading block (h1, subtitle, desktop disclaimer). */
  intro: ReactNode;
  /** Server-rendered disclaimer shown under the card on mobile. */
  mobileDisclaimer: ReactNode;
}

/**
 * The /stem-splitter upload card. Every run starts as the 10-second preview
 * (PRV* ids); a signed-in visitor can then promote it to the full song. The
 * status and download endpoints follow the id's prefix.
 */
export default function StemSplitterUploader({ intro, mobileDisclaimer }: StemSplitterUploaderProps) {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const isTouch = useIsTouch();

  const [fileName, setFileName] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatusState] = useState<string | null>(null);
  // Queue block from /preview/status or /workflow/status while the job waits
  // for a free worker: { state, position, ahead, eta_seconds }.
  const [queue, setQueue] = useState<WorkflowQueue | null>(null);
  // Consecutive failed polls. Network errors used to be swallowed silently, so
  // an API restart left this screen frozen with no hint anything was wrong.
  const [pollFailures, setPollFailures] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // The finished job's output file map ({ key: r2path }). The result view needs
  // it to find every separated stem: without it the viewer only knows about
  // the one instrument that was asked for, and the "everything else" row that
  // is mixed from the others never appears.
  const [resultFiles, setResultFiles] = useState<Record<string, unknown> | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState('vocals');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The polling loop outlives the render that started it; these carry the
  // live values into it (see HeroUploader).
  const statusRef = useRef<string | null>(null);
  const fileNameRef = useRef<string | null>(null);
  const resumedRef = useRef(false);

  const setStatus = useCallback((value: string | null) => {
    statusRef.current = value;
    setStatusState(value);
  }, []);
  const setFile = (name: string | null) => {
    fileNameRef.current = name;
    setFileName(name);
  };

  const { simulateProgress, stopProgressSimulation } = useProgressSimulation(setProgress);

  const uiState = uiStateFor(status, queue);

  useCompletionConfetti(isCompletedStatus(status) && Boolean(downloadFilename));

  // Download the separated stem audio file (.wav)
  const downloadStemFile = async (id: string): Promise<{ objectUrl: string; filename: string }> => {
    const fileKey = STEM_KEYS[selectedInstrument] || `bs_roformer_${selectedInstrument}_stem`;
    const url = `${API_BASE_URL}${apiPrefixForId(id)}/download/${id}/${fileKey}`;
    const isPreview = id.startsWith('PRV');
    const fetchFn = isPreview ? previewFetch : authenticatedFetch;
    const res = await fetchFn(url, {}, getToken);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Download failed ${res.status}: ${txt}`);
    }
    const blob = await res.blob();
    const extension = '.wav';
    const suffix = `_${selectedInstrument}`;
    const currentName = fileNameRef.current;
    const filename = filenameFromResponse(
      res,
      currentName ? currentName.replace(/\.[^.]+$/, `${suffix}${extension}`) : `${selectedInstrument}_groovesheet${extension}`
    );

    const objectUrl = URL.createObjectURL(blob);
    // A preview is listened to here, not saved: an automatic download on a
    // phone hands the page to the download sheet (or, in the Facebook and
    // Instagram in-app browsers, to another app) before the preview is heard.
    if (!isPreview) triggerDownload(objectUrl, filename);
    return { objectUrl, filename };
  };

  const pollStatus = (id: string) => {
    let consecutive404s = 0;
    const intervalMs = 3000;
    const max404s = 8;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const isPreview = id.startsWith('PRV');
        const fetchFn = isPreview ? previewFetch : authenticatedFetch;
        const response = await fetchFn(
          `${API_BASE_URL}${apiPrefixForId(id)}/status/${id}`,
          isPreview ? { method: 'GET', cache: 'no-store' } : { mode: 'cors', credentials: 'omit', cache: 'no-store' },
          getToken
        );
        if (response.status === 404) {
          consecutive404s++;
          if (consecutive404s >= max404s) {
            setError(t('tools.uploader.errors.jobNotFound'));
            stopped = true;
            clearActiveJob(SURFACE);
            return;
          }
          setStatus('pending');
          setProgress(0);
        } else if (!response.ok) {
          const txt = await response.text();
          throw new Error(`Status check failed ${response.status}: ${txt}`);
        } else {
          consecutive404s = 0;
          const data = (await response.json()) as StatusPayload;
          const newStatus = data.status || data.state || 'processing';
          setPollFailures(0);
          setQueue(data.queue || null);

          if (isCompletedStatus(newStatus)) {
            stopProgressSimulation();
            sendNotification('GrooveSheet', { body: t('tools.uploader.notify.stemsReady') });
            stopped = true;
            // A finished preview stays restorable for a while: sign-in,
            // Checkout and a stale-chunk reload all reload this page.
            if (id.startsWith('PRV')) saveActiveJob(SURFACE, id, { instrument: selectedInstrument, fileName: fileNameRef.current ?? undefined, completed: true });
            else clearActiveJob(SURFACE);
            setResultFiles(data.outputs?.files || null);
            try {
              const { objectUrl, filename } = await downloadStemFile(id);
              setDownloadUrl(objectUrl);
              setDownloadFilename(filename);
              setStatus('completed');
              setProgress(100);
            } catch (err) {
              setError(t('tools.uploader.errors.downloadFailed', { message: errorInfo(err).message }));
            }
            return;
          } else if (isFailedStatus(newStatus)) {
            stopProgressSimulation();
            if (id.startsWith('PRV')) trackFunnel(FUNNEL.PREVIEW_FAILED, { surface: UPLOAD_SOURCE, preview_id: id, instrument: selectedInstrument });
            setError(failureMessage(data) || t('tools.uploader.errors.processingFailed'));
            stopped = true;
            clearActiveJob(SURFACE);
            return;
          }
          // Queue to worker transition
          const previous = statusRef.current;
          if (newStatus === 'worker_processing' && (previous === 'started' || previous === 'pending')) {
            simulateProgress();
            sendNotification('GrooveSheet', { body: t('tools.uploader.notify.stemsTurn') });
          }
          if (newStatus === 'started') {
            stopProgressSimulation();
            setProgress(0);
            requestNotificationPermission();
          }
          setStatus(newStatus);
        }
      } catch (err) {
        const info = errorInfo(err);
        if (info.name !== 'TypeError') {
          setError(t('tools.uploader.errors.statusError', { message: info.message }));
        } else {
          // Network/API blip. The job is server-side and survives this: keep
          // polling, but say so instead of sitting on a stale screen forever.
          setPollFailures((n) => n + 1);
        }
      } finally {
        if (!stopped) setTimeout(poll, intervalMs);
      }
    };
    poll();
  };

  // Coming back to this page (or reloading) while a job is still running used
  // to show an empty upload box, as if nothing had been submitted. Resume it.
  useEffect(() => {
    if (!isLoaded || resumedRef.current) return;
    resumedRef.current = true;
    const saved = loadActiveJob(SURFACE);
    if (!saved) return;
    // A finished preview is only worth showing again shortly after; later the
    // visitor expects an empty upload box.
    if (saved.completed && Date.now() - saved.savedAt > FINISHED_PREVIEW_TTL_MS) {
      clearActiveJob(SURFACE);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a job saved in localStorage, which only the browser can read
    setJobId(saved.jobId);
    if (typeof saved.instrument === 'string') setSelectedInstrument(saved.instrument);
    if (typeof saved.fileName === 'string') setFile(saved.fileName);
    setStatus('started');
    setProgress(0);
    pollStatus(saved.jobId);
    // Once auth has loaded; the poll reads live values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleUpload = async (fileToUpload: File) => {
    if (!isLoaded) {
      setError(t('tools.uploader.errors.loadingUser'));
      return;
    }

    setError(null);
    setStatus('uploading');
    trackFunnel(FUNNEL.UPLOAD_STARTED, {
      surface: UPLOAD_SOURCE,
      instrument: selectedInstrument,
      signed_in: Boolean(isSignedIn),
      file_mb: Math.round((fileToUpload.size / 1048576) * 10) / 10,
      file_type: fileToUpload.type || undefined,
    });
    simulateProgress();

    try {
      // Every run goes through the 10-second preview by default.
      const data = await startPreview<StartPayload>(
        API_BASE_URL,
        'bs_roformer_separate',
        fileToUpload,
        { instrument: selectedInstrument, source: UPLOAD_SOURCE },
        getToken
      );
      const workflowId = data.workflow_id || data.preview_id;

      // Stash for post-signup claim. Cleared on success after claim.
      if (!isSignedIn && workflowId) setPendingPreviewId(workflowId);

      // Cache hit: already completed.
      if (workflowId && (data.cached || data.status === 'completed')) {
        setJobId(workflowId);
        saveActiveJob(SURFACE, workflowId, { instrument: selectedInstrument, fileName: fileToUpload.name, completed: true });
        setResultFiles(data.outputs?.files || null);
        setStatus('completed');
        setProgress(100);
        stopProgressSimulation();
        try {
          const { objectUrl, filename } = await downloadStemFile(workflowId);
          setDownloadUrl(objectUrl);
          setDownloadFilename(filename);
        } catch (dlErr) {
          setError(t('tools.uploader.errors.downloadFailed', { message: errorInfo(dlErr).message }));
        }
        return;
      }

      if (!workflowId) throw new Error('No workflow_id returned from server');

      // Activation step of the funnel, after the backend accepted the job.
      trackWorkflowStarted('bs_roformer_separate', {
        workflow_id: workflowId,
        instrument: selectedInstrument,
      });

      setJobId(workflowId);
      setStatus(data.status || 'pending');
      saveActiveJob(SURFACE, workflowId, { instrument: selectedInstrument });

      setTimeout(() => pollStatus(workflowId), 1000);
    } catch (err) {
      const info = errorInfo(err);
      trackFunnel(FUNNEL.UPLOAD_FAILED, {
        surface: UPLOAD_SOURCE,
        instrument: selectedInstrument,
        status: info.status || 0,
        signed_in: Boolean(isSignedIn),
        message: (info.message || '').slice(0, 120) || undefined,
      });
      if (info.status === 429) {
        setError(info.message || t('tools.uploader.errors.rateLimited', { seconds: info.retryAfterSeconds || 60 }));
      } else if (info.message && (info.message.includes('fetch') || info.name === 'TypeError')) {
        setError(t('tools.uploader.errors.cantConnect'));
      } else {
        setError(info.message || t('tools.uploader.errors.uploadFailed'));
      }
      setStatus(null);
      stopProgressSimulation();
    }
  };

  const handleFileChange = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!isSupportedFileType(selectedFile)) {
      setError(t('hero.errors.fileFormat'));
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(t('tools.uploader.errors.fileTooLarge', { size: MAX_UPLOAD_MB }));
      return;
    }
    setFile(selectedFile.name);
    setError(null);
    handleUpload(selectedFile);
  };

  const resetUpload = () => {
    stopProgressSimulation();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setJobId(null);
    setStatus(null);
    setQueue(null);
    setPollFailures(0);
    clearActiveJob(SURFACE);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    setDownloadFilename(null);
    setResultFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualDownload = () => {
    if (downloadUrl && downloadFilename) triggerDownload(downloadUrl, downloadFilename);
  };

  const handleBrowseClick = () => {
    if (!isLoaded) return;
    fileInputRef.current?.click();
  };

  // Touch devices can't drag; the whole zone becomes the tap target.
  // Clicks on the inner button are skipped so the picker opens once.
  const handleDropZoneTap = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('.browse-files-btn')) return;
    handleBrowseClick();
  };

  // Promote the preview to a full run (no re-upload). The paywall, sign-in and
  // the return trip around it live in useFullSongFlow.
  const handleUpgradeToFull = async (trigger: UpgradeTrigger): Promise<UpgradeOutcome> => {
    if (!jobId || !jobId.startsWith('PRV')) return { kind: 'failed' };
    const previewId = jobId;
    trackFunnel(FUNNEL.FULL_SONG_CLICK, { surface: UPLOAD_SOURCE, preview_id: previewId, instrument: selectedInstrument, trigger });
    try {
      const result = await upgradeToFull<{ workflow_id?: string }>(API_BASE_URL, jobId, getToken);
      const workflowId = result?.workflow_id;
      if (!workflowId) return { kind: 'failed' };
      trackFunnel(FUNNEL.FULL_SONG_STARTED, { surface: UPLOAD_SOURCE, preview_id: previewId, workflow_id: workflowId, trigger });
      // Replace the preview view with the new full workflow polling.
      setJobId(workflowId);
      setStatus('processing');
      setProgress(0);
      setDownloadUrl(null);
      setDownloadFilename(null);
      simulateProgress();
      saveActiveJob(SURFACE, workflowId, { instrument: selectedInstrument });
      setTimeout(() => pollStatus(workflowId), 1000);
      return { kind: 'started' };
    } catch (err) {
      const info = errorInfo(err);
      // Out of minutes: the flow opens the paywall instead of an error banner.
      if (info.status === 402) return { kind: 'out_of_minutes', message: info.message || null };
      setError(info.message || t('tools.uploader.errors.fullSongFailed'));
      return { kind: 'failed' };
    }
  };

  const fullSong = useFullSongFlow({
    surface: UPLOAD_SOURCE,
    jobId,
    ready: uiState === 'success',
    instrument: selectedInstrument,
    fileName,
    // Sign-in and Checkout reload the page; the resume effect above brings the
    // preview back from this.
    persistPreview: () => {
      if (jobId) saveActiveJob(SURFACE, jobId, { instrument: selectedInstrument, fileName: fileName ?? undefined, completed: true });
    },
    upgrade: handleUpgradeToFull,
  });

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  // The drop zone sits inside the card and both listen for drops; without
  // stopPropagation one dropped file was uploaded twice.
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileChange(droppedFile);
  };

  const renderIdleState = () => (
    <>
      <div className="instrument-tabs">
        {INSTRUMENTS.map((instrument) => {
          const IconComp = instrument.icon;
          const isSelected = selectedInstrument === instrument.value;
          return (
            <button
              key={instrument.value}
              className={`instrument-tab ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedInstrument(instrument.value)}
            >
              <IconComp size={22.74} />
              <span>{t(`hero.instruments.${instrument.value === 'vocals' ? 'vocal' : instrument.value}`)}</span>
            </button>
          );
        })}
      </div>

      <div
        className="upload-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={isTouch ? handleDropZoneTap : undefined}
        role={isTouch ? 'button' : undefined}
        tabIndex={isTouch ? 0 : undefined}
      >
        <div className="upload-content-wrapper">
          <div className="upload-visual-group">
            <div className="file-formats-visual">
              <img
                src={isDarkMode ? '/images/hero_upload_img_dark.png' : '/images/hero_upload_img_light.png'}
                alt={t('tools.uploader.formatsAlt')}
              />
            </div>
            <div className="upload-text-group">
              <p className="upload-main-text">{isTouch ? t('hero.tapToUpload') : t('hero.dragDrop')}</p>
              <p className="upload-sub-text">{t('hero.fileTypes', { size: MAX_UPLOAD_MB })}</p>
            </div>
          </div>
          <button className="browse-files-btn" onClick={handleBrowseClick}>
            {isTouch ? t('hero.chooseFile') : t('hero.browseFiles')}
          </button>
        </div>
      </div>
    </>
  );

  const renderUploadingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon">
          <TrayArrowUpIcon clipId="clip0_tray_ss" />
        </div>
        <div className="upload-text">
          <h3>{t('hero.uploading')}</h3>
        </div>
      </div>
      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div className="progress-bar-fill compact" style={{ width: `${Math.min(progress, 100)}%` }}>
            <span className="progress-percentage compact">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar-remaining compact" />
        </div>
        <button className="cancel-btn compact" onClick={resetUpload}>
          {t('hero.cancel')}
        </button>
      </div>
    </>
  );

  // "started" with no position yet: still a queue, never a server booting.
  const renderColdStartState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon cold-start-pulse">
          <ServerIcon />
        </div>
        <div className="upload-text">
          <h3 className="cold-start-message">{t('hero.inQueue')}</h3>
          <p className="cold-start-sub">{t('hero.inQueueBody')}</p>
        </div>
      </div>
      <div className="upload-controls compact">
        <button className="browse-files-btn" onClick={() => router.push('/account/history')}>
          {t('hero.viewHistory')}
        </button>
        <button className="cancel-btn compact" onClick={resetUpload}>
          {t('hero.cancel')}
        </button>
      </div>
    </>
  );

  // Backend reported a real position: say where, and roughly how long.
  const renderQueuedState = () => {
    const summary = queueSummary(queue);
    return (
      <>
        <div className="upload-content-top compact">
          <div className="upload-icon cold-start-pulse">
            <ServerIcon />
          </div>
          <div className="upload-text">
            <h3 className="cold-start-message">{t('hero.inQueue')}</h3>
            <p className="cold-start-sub">
              {summary ? `${summary}. ` : ''}
              {t('hero.inQueueBody')}
            </p>
          </div>
        </div>
        <div className="upload-controls compact">
          <button className="browse-files-btn" onClick={() => router.push('/account/history')}>
            {t('hero.viewHistory')}
          </button>
          <button className="cancel-btn compact" onClick={resetUpload}>
            {t('hero.cancel')}
          </button>
        </div>
      </>
    );
  };

  const renderProcessingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon">
          <MagicWandIcon />
        </div>
        <div className="upload-text">
          <h3>{t('tools.uploader.separating')}</h3>
        </div>
      </div>
      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div className="progress-bar-fill compact" style={{ width: `${Math.min(progress, 100)}%` }}>
            <span className="progress-percentage compact">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar-remaining compact" />
        </div>
        <button className="cancel-btn compact" onClick={resetUpload}>
          {t('hero.cancel')}
        </button>
      </div>
    </>
  );

  return (
    <section className="hero" style={{ flex: 1, position: 'relative', zIndex: 10 }}>
      <div className={`hero-container ${uiState === 'success' ? 'success-expanded' : ''}`}>
        {intro}
        <div
          className={`upload-area state-${uiState} ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseMove={trackPointer}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
          {uiState === 'idle' && renderIdleState()}
          {uiState === 'uploading' && renderUploadingState()}
          {pollFailures >= 3 && uiState !== 'idle' && uiState !== 'success' && (
            <p className="cold-start-sub" style={{ margin: '0 0 10px', opacity: 0.85 }}>
              {t('hero.reconnecting')}
            </p>
          )}
          {uiState === 'queued' && renderQueuedState()}
          {uiState === 'cold_starting' && renderColdStartState()}
          {uiState === 'processing' && renderProcessingState()}
          {uiState === 'success' && (
            /* Same explore-style viewer the homepage shows on success: the
               finished stem is playable here instead of download-only. */
            <ResultView
              workflowId={jobId}
              fileName={fileName || downloadFilename}
              selectedInstrument={selectedInstrument}
              prefetchedFiles={null}
              files={resultFiles}
              onDownloadTranscription={handleManualDownload}
              onDownloadStem={handleManualDownload}
              onReset={resetUpload}
              downloadError={error}
              isSignedIn={isSignedIn}
              onUpgradeToFull={fullSong.requestFullSong}
              onSignUpToUnlock={fullSong.getFullSongSignedOut}
              surface={UPLOAD_SOURCE}
            />
          )}
          {fullSong.paywall}
          {error && uiState !== 'success' && (
            <div className="error-overlay">
              <StatusMessage variant="error">{error}</StatusMessage>
            </div>
          )}
        </div>
        {mobileDisclaimer}
      </div>
    </section>
  );
}
