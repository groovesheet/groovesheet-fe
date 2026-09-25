'use client';

/* eslint-disable @next/next/no-img-element -- the format artwork swaps with the theme; same markup as the CRA card */
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { LuGuitar, LuDrum } from 'react-icons/lu';
import { LiaMicrophoneAltSolid } from 'react-icons/lia';
import { Piano } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from '@/lib/navigation';
import { useUser, useAuth } from '@/lib/auth';
import { authenticatedFetch, apiPrefixForId, downloadScorePdf, downloadWorkflowFile, SCORE_INSTRUMENTS } from '@/lib/api';
import { queueSummary } from '@/lib/queue';
import { saveActiveJob, loadActiveJob, clearActiveJob } from '@/lib/activeJob';
import { trackWorkflowStarted } from '@/lib/analytics';
import { previewFetch, startPreview, setPendingPreviewId, upgradeToFull } from '@/lib/previewApi';
import { scrollToPricing } from '@/lib/scrollToPricing';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/constants';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { useIsTouch } from '@/lib/hooks/useMediaQuery';
import config from '@/lib/config';
import type { DownloadedFile, WorkflowQueue } from '@/lib/types';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import StatusMessage from '@/components/ui/StatusMessage';
import { BassIcon, MagicWandIcon, ServerIcon, TrayArrowUpIcon } from './icons';
import ResultView from './ResultView';
import {
  UPLOAD_ACCEPT,
  errorInfo,
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
const UPLOAD_SOURCE = 'midi_converter';

// Key for the resumable job in localStorage (lib/activeJob).
const SURFACE = 'midi-converter';

// NOTE: Download key maps and download handlers are shared across the home,
// MIDI converter and stem splitter cards and TranscriptionHistory. When
// changing download logic here, update those too.
const STEM_KEYS: Record<string, string> = {
  drums: 'bs_roformer_drums_stem',
  piano: 'bs_roformer_piano_stem',
  bass: 'bs_roformer_bass_stem',
  jazz_bass: 'bs_roformer_bass_stem',
  vocals: 'bs_roformer_vocals_stem',
  guitar: 'bs_roformer_guitar_stem',
  other: 'bs_roformer_other_stem',
};

const MIDI_KEYS: Record<string, string> = {
  drums: 'adtof_plus_drums_quantized_midi',
  jazz_bass: 'bassunet_jazz_bass_midi',
  bass: 'fcpe_bass_midi',
  piano: 'transkun_v2_piano_midi',
};

// The stems a separation-only pick downloads in place of MIDI.
const SEPARATION_KEYS: Record<string, string> = {
  vocals: 'bs_roformer_vocals_stem',
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

// Map the selected instrument to a workflow name (without the /workflow or
// /preview prefix; the upload picks that from the run type).
function workflowNameFor(instrument: string): string {
  switch (instrument) {
    case 'drums':
      return 'separate_to_drumscore_v2';
    case 'jazz_bass':
      return 'separate_to_jazz_bass_score';
    case 'bass':
      return 'separate_to_bass_score';
    case 'piano':
      return 'separate_to_piano_score_full';
    case 'guitar':
      return 'separate_to_guitar_stem';
    default:
      return 'bs_roformer_separate';
  }
}

interface MidiConverterUploaderProps {
  /** Server-rendered heading block (h1, subtitle, desktop disclaimer). */
  intro: ReactNode;
  /** Server-rendered disclaimer shown under the card on mobile. */
  mobileDisclaimer: ReactNode;
}

/**
 * The /midi-converter upload card. Every run starts as the 10-second preview
 * (routed through /preview/{name}); the result opens on the note view because
 * this page sells MIDI.
 */
export default function MidiConverterUploader({ intro, mobileDisclaimer }: MidiConverterUploaderProps) {
  const { t } = useTranslation();
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  const { openLoginModal } = useLoginModal();
  const router = useRouter();
  const isTouch = useIsTouch();

  const [fileName, setFileName] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatusState] = useState<string | null>(null);
  // Queue block from /workflow/status while the job waits for a free worker.
  const [queue, setQueue] = useState<WorkflowQueue | null>(null);
  // Consecutive failed polls. The old code swallowed network errors silently,
  // so an API restart left this screen on "waking up our servers" forever.
  const [pollFailures, setPollFailures] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  // The finished job's output file map. The result view reads every separated
  // stem out of it; with only the prefetched blobs it knows about the one
  // instrument that was asked for and can't build the "everything else" row.
  const [resultFiles, setResultFiles] = useState<Record<string, unknown> | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState('drums');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefetchedFilesRef = useRef<Record<string, DownloadedFile>>({});

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

  // Same download logic as the home page card
  const downloadInstrumentFile = async (id: string): Promise<{ objectUrl: string; filename: string }> => {
    const fileKey =
      MIDI_KEYS[selectedInstrument] || SEPARATION_KEYS[selectedInstrument] || `bs_roformer_${selectedInstrument}_stem`;
    const url = `${API_BASE_URL}${apiPrefixForId(id)}/download/${id}/${fileKey}`;
    const isPreview = id.startsWith('PRV');
    const fetchFn = isPreview ? previewFetch : authenticatedFetch;
    const res = await fetchFn(url, {}, getToken);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Download failed ${res.status}: ${txt}`);
    }
    const blob = await res.blob();
    const extension =
      selectedInstrument === 'drums' || selectedInstrument === 'bass' || selectedInstrument === 'piano' ? '.mid' : '.wav';
    const suffix =
      selectedInstrument === 'drums'
        ? '_transcription'
        : selectedInstrument === 'bass'
          ? '_bass_transcription'
          : selectedInstrument === 'piano'
            ? '_piano_transcription'
            : `_${selectedInstrument}`;
    const currentName = fileNameRef.current;
    const filename = filenameFromResponse(
      res,
      currentName ? currentName.replace(/\.[^.]+$/, `${suffix}${extension}`) : `${selectedInstrument}_groovesheet${extension}`
    );

    const objectUrl = URL.createObjectURL(blob);
    triggerDownload(objectUrl, filename);
    return { objectUrl, filename };
  };

  // MusicXML lands in the browser's downloads on completion, but it needs an
  // editor to look at. Send the engraved, page-by-page PDF with it: the copy
  // you can actually print. Best-effort: a failed engraving must not turn a
  // finished transcription into an error.
  const downloadScorePdfFile = async (id: string | null) => {
    if (!id || !SCORE_INSTRUMENTS.includes(selectedInstrument)) return;
    try {
      const result = await downloadScorePdf(API_BASE_URL, id, getToken);
      if (!result?.blob) return;
      const objectUrl = URL.createObjectURL(result.blob);
      triggerDownload(objectUrl, result.filename || `${selectedInstrument}_score_groovesheet.pdf`);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.warn('Score PDF download failed:', err);
    }
  };

  // Pre-fetch secondary download files (stem, MIDI) in the background after job completes
  const prefetchSecondaryFiles = async (id: string) => {
    const fetches: Promise<void>[] = [];
    for (const key of [STEM_KEYS[selectedInstrument], MIDI_KEYS[selectedInstrument]]) {
      if (!key) continue;
      fetches.push(
        downloadWorkflowFile(API_BASE_URL, id, key, getToken)
          .then((result) => {
            if (result) prefetchedFilesRef.current[key] = result;
          })
          .catch(() => {})
      );
    }
    await Promise.allSettled(fetches);
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
            setError('Job not found after repeated attempts. Please re-upload.');
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
          // A good poll clears the "reconnecting" banner and refreshes where
          // we sit in line (null once a worker claims the job).
          setPollFailures(0);
          setQueue(data.queue || null);

          if (isCompletedStatus(newStatus)) {
            stopProgressSimulation();
            sendNotification('GrooveSheet', { body: 'Your MIDI conversion is ready!' });
            stopped = true;
            clearActiveJob(SURFACE);
            setResultFiles(data.outputs?.files || null);
            try {
              const { objectUrl, filename } = await downloadInstrumentFile(id);
              setDownloadUrl(objectUrl);
              setDownloadFilename(filename);
              setStatus('completed');
              setProgress(100);
              downloadScorePdfFile(id);
              // Pre-fetch secondary files (stem, MIDI) in background for instant downloads
              prefetchSecondaryFiles(id);
            } catch (err) {
              setError(`Download failed: ${errorInfo(err).message}`);
            }
            return;
          } else if (isFailedStatus(newStatus)) {
            stopProgressSimulation();
            setError(data.message || 'Processing failed.');
            stopped = true;
            clearActiveJob(SURFACE);
            return;
          }
          // Queue to worker transition
          const previous = statusRef.current;
          if (newStatus === 'worker_processing' && (previous === 'started' || previous === 'pending')) {
            simulateProgress();
            sendNotification('GrooveSheet', { body: "It's your turn \u2014 converting your audio now." });
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
          setError(`Status error: ${info.message}`);
        } else {
          // Network/API blip. Keep polling (the job is server-side and
          // survives this) but surface it instead of sitting on a stale
          // screen forever, which is what used to happen when the API
          // restarted mid-job.
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a job saved in localStorage, which only the browser can read
    setJobId(saved.jobId);
    if (typeof saved.instrument === 'string') setSelectedInstrument(saved.instrument);
    setStatus('started');
    setProgress(0);
    pollStatus(saved.jobId);
    // Once auth has loaded; the poll reads live values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const handleUpload = async (fileToUpload: File) => {
    if (!isLoaded) {
      setError('Loading user data...');
      return;
    }

    const workflowName = workflowNameFor(selectedInstrument);

    setError(null);
    setStatus('uploading');
    simulateProgress();

    try {
      // Every run goes through the 10-second preview by default.
      const data = await startPreview<StartPayload>(
        API_BASE_URL,
        workflowName,
        fileToUpload,
        { instrument: selectedInstrument, source: UPLOAD_SOURCE },
        getToken
      );
      const workflowId = data.workflow_id || data.preview_id;

      if (!isSignedIn && workflowId) setPendingPreviewId(workflowId);

      if (workflowId && (data.cached || data.status === 'completed')) {
        setJobId(workflowId);
        setResultFiles(data.outputs?.files || null);
        setStatus('completed');
        setProgress(100);
        stopProgressSimulation();
        try {
          const { objectUrl, filename } = await downloadInstrumentFile(workflowId);
          setDownloadUrl(objectUrl);
          setDownloadFilename(filename);
          downloadScorePdfFile(workflowId);
          prefetchSecondaryFiles(workflowId);
        } catch (dlErr) {
          setError(`Download failed: ${errorInfo(dlErr).message}`);
        }
        return;
      }

      if (!workflowId) throw new Error('No workflow_id returned from server');

      // Activation step of the funnel, after the backend accepted the job.
      trackWorkflowStarted(workflowName, {
        workflow_id: workflowId,
        instrument: selectedInstrument,
      });

      setJobId(workflowId);
      setStatus(data.status || 'pending');
      saveActiveJob(SURFACE, workflowId, { instrument: selectedInstrument });

      setTimeout(() => pollStatus(workflowId), 1000);
    } catch (err) {
      const info = errorInfo(err);
      if (info.status === 429) {
        setError(info.message || `Rate limit exceeded. Try again in ${info.retryAfterSeconds || 60}s.`);
      } else if (info.message && (info.message.includes('fetch') || info.name === 'TypeError')) {
        setError('Unable to connect to server. Please check the console for details.');
      } else {
        setError(info.message || 'Failed to upload file. Please try again.');
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
      setError(`File size too large. Max ${MAX_UPLOAD_MB}MB.`);
      return;
    }
    setFile(selectedFile.name);
    setError(null);
    handleUpload(selectedFile);
  };

  const resetUpload = () => {
    stopProgressSimulation();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    prefetchedFilesRef.current = {};
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

  // Generic file download helper for secondary download buttons
  const handleDownloadFile = async (fileKey: string, defaultExtension: string, labelForFilename: string) => {
    if (!jobId) return;
    try {
      // Use pre-fetched data if available, otherwise fetch on demand
      const result =
        prefetchedFilesRef.current[fileKey] || (await downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken));
      if (!result) {
        setError('File not available for download.');
        return;
      }
      const fallback = fileName
        ? fileName.replace(/\.[^.]+$/, `_${labelForFilename}${defaultExtension}`)
        : `${labelForFilename}_groovesheet${defaultExtension}`;
      const objectUrl = URL.createObjectURL(result.blob);
      triggerDownload(objectUrl, result.filename || fallback);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Download error:', err);
      setError(errorInfo(err).message || 'Failed to download file.');
    }
  };

  // Download the separated stem (.wav) for the selected instrument
  const handleDownloadStem = async () => {
    if (!jobId) return;
    const stemKey = STEM_KEYS[selectedInstrument] || selectedInstrument;
    await handleDownloadFile(stemKey, '.wav', `${selectedInstrument}_stem`);
  };

  // Download MIDI (only for transcription instruments)
  const handleDownloadMidi = () => {
    const midiKey = MIDI_KEYS[selectedInstrument];
    if (!midiKey) return;
    handleDownloadFile(midiKey, '.mid', 'midi');
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

  const handleUpgradeToFull = async () => {
    if (!jobId || !jobId.startsWith('PRV')) return;
    try {
      const result = await upgradeToFull<{ workflow_id?: string }>(API_BASE_URL, jobId, getToken);
      const workflowId = result?.workflow_id;
      if (workflowId) {
        setJobId(workflowId);
        setStatus('processing');
        setProgress(0);
        setDownloadUrl(null);
        setDownloadFilename(null);
        prefetchedFilesRef.current = {};
        simulateProgress();
        setTimeout(() => pollStatus(workflowId), 1000);
      }
    } catch (err) {
      const info = errorInfo(err);
      // Out of minutes: the plans are what they need, not an error banner.
      if (info.status === 402) {
        scrollToPricing({ tab: 'topups' });
        return;
      }
      setError(info.message || 'Failed to start full song processing.');
    }
  };

  const handleSignUpToUnlock = () => {
    openLoginModal();
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
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
              <span>{instrument.label}</span>
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
                alt="Supported audio formats"
              />
            </div>
            <div className="upload-text-group">
              <p className="upload-main-text">{isTouch ? 'Tap to upload an audio file' : 'Drag and drop an audio file'}</p>
              <p className="upload-sub-text">{`MP3, WAV, FLAC, M4A up to ${MAX_UPLOAD_MB}MB`}</p>
            </div>
          </div>
          <button className="browse-files-btn" onClick={handleBrowseClick}>
            {isTouch ? 'Choose File' : 'Browse Files'}
          </button>
        </div>
      </div>
    </>
  );

  const renderProgressBar = () => (
    <div className="progress-bar-row">
      <div className="progress-bar-fill compact" style={{ width: `${Math.min(progress, 100)}%` }}>
        {progress >= 10 && <span className="progress-percentage compact">{Math.round(progress)}%</span>}
      </div>
      <div className="progress-bar-remaining compact" />
    </div>
  );

  const renderUploadingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon">
          <TrayArrowUpIcon clipId="clip0_tray_mc" />
        </div>
        <div className="upload-text">
          <h3>Uploading...</h3>
        </div>
      </div>
      <div className="upload-controls compact">
        {renderProgressBar()}
        <button className="cancel-btn compact" onClick={resetUpload}>
          Cancel
        </button>
      </div>
    </>
  );

  const renderColdStartState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon cold-start-pulse">
          <ServerIcon />
        </div>
        <div className="upload-text">
          <h3 className="cold-start-message">{t('hero.inQueue')}</h3>
          <p className="cold-start-sub">
            GrooveSheet is busy right now and your song is waiting its turn. You can safely close this page
            {' \u2014 '}it keeps going, and you can check back any time on your Transcription History.
          </p>
        </div>
      </div>
      <div className="upload-controls compact">
        <button className="browse-files-btn" onClick={() => router.push('/account/history')}>
          View Transcription History
        </button>
        <button className="cancel-btn compact" onClick={resetUpload}>
          Cancel
        </button>
      </div>
    </>
  );

  // Waiting behind other people's jobs. The wait is routinely longer than the
  // work itself (separations run 20-30 min and the worker pool is small), so
  // this screen's job is to say the work is safe and let the user leave.
  const renderQueuedState = () => {
    const summary = queueSummary(queue);
    return (
      <>
        <div className="upload-content-top compact">
          <div className="upload-icon cold-start-pulse">
            <ServerIcon />
          </div>
          <div className="upload-text">
            <h3 className="cold-start-message">You&apos;re in the queue</h3>
            <p className="cold-start-sub">
              {summary ? `${summary}. ` : ''}
              {t('hero.inQueueBody')}
            </p>
          </div>
        </div>
        <div className="upload-controls compact">
          <button className="browse-files-btn" onClick={() => router.push('/account/history')}>
            View Transcription History
          </button>
          <button className="cancel-btn compact" onClick={resetUpload}>
            Cancel
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
          <h3>Converting to MIDI...</h3>
        </div>
      </div>
      <div className="upload-controls compact">
        {renderProgressBar()}
        <button className="cancel-btn compact" onClick={resetUpload}>
          Cancel
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
          {/* The job lives server-side, so a dropped connection is not a
              dropped job; say so, instead of leaving a frozen screen. */}
          {pollFailures >= 3 && uiState !== 'idle' && uiState !== 'success' && (
            <p className="cold-start-sub" style={{ margin: '0 0 10px', opacity: 0.85 }}>
              Reconnecting to the server{'…'} your transcription is still running and will appear in your
              Transcription History.
            </p>
          )}
          {uiState === 'idle' && renderIdleState()}
          {uiState === 'uploading' && renderUploadingState()}
          {uiState === 'queued' && renderQueuedState()}
          {uiState === 'cold_starting' && renderColdStartState()}
          {uiState === 'processing' && renderProcessingState()}
          {uiState === 'success' && (
            /* Same explore-style viewer the homepage shows on success: sheet,
               piano roll and stem on one transport, not a bare download button. */
            <ResultView
              workflowId={jobId}
              fileName={fileName || downloadFilename}
              selectedInstrument={selectedInstrument}
              // The viewer keys its loads on this object's identity, and the
              // prefetch fills it in place after render, as in the CRA card.
              // eslint-disable-next-line react-hooks/refs
              prefetchedFiles={prefetchedFilesRef.current}
              files={resultFiles}
              onDownloadTranscription={handleManualDownload}
              onDownloadStem={handleDownloadStem}
              onDownloadMidi={handleDownloadMidi}
              onDownloadPdf={() => downloadScorePdfFile(jobId)}
              onReset={resetUpload}
              downloadError={error}
              isSignedIn={isSignedIn}
              onUpgradeToFull={handleUpgradeToFull}
              onSignUpToUnlock={handleSignUpToUnlock}
              // This page sells MIDI: open on the note view (piano roll /
              // fretboard / drum kit), with the engraving one tab over.
              defaultView="midi"
              statusLabel="MIDI conversion complete"
            />
          )}
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
