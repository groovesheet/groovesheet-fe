'use client';

/* eslint-disable @next/next/no-img-element -- the format artwork swaps with the theme; same markup as the CRA card */
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { LuGuitar, LuDrum } from 'react-icons/lu';
import { LiaMicrophoneAltSolid } from 'react-icons/lia';
import { Piano } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useRouter } from '@/lib/navigation';
import { useUser, useAuth } from '@/lib/auth';
import { queueSummary } from '@/lib/queue';
import { authenticatedFetch, scoreKeysFor, downloadScorePdf, downloadWorkflowFile, SCORE_INSTRUMENTS } from '@/lib/api';
import { trackWorkflowStarted } from '@/lib/analytics';
import { previewFetch, startPreview, setPendingPreviewId, upgradeToFull } from '@/lib/previewApi';
import { scrollToPricing } from '@/lib/scrollToPricing';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { useTheme } from '@/lib/theme';
import { useIsTouch } from '@/lib/hooks/useMediaQuery';
import { useWorkflowPersistence } from '@/lib/hooks/useWorkflowPersistence';
import config from '@/lib/config';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/constants';
import type { DownloadedFile, WorkflowMetadata, WorkflowQueue } from '@/lib/types';
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
  readDetail,
  statusError,
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
  // The MPEG-4 family, which is what phones record: iPhone Voice Memos and
  // most Android recorders write .m4a. Browsers label it inconsistently
  // (audio/mp4, audio/x-m4a, and sometimes video/mp4 for the same file), so
  // all three are listed. Decoded server-side by the ffmpeg fallback in
  // services/segment_selector.py; do not add formats ahead of that.
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/aacp',
  'video/mp4',
]);

const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_BYTES;

const API_BASE_URL = config.apiBaseUrl;

// Which surface started the job. Stored in the workflow metadata so
// /account/history can label a row by where it came from: the backend
// workflow name alone can't tell a MIDI conversion from a transcription.
const UPLOAD_SOURCE = 'transcribe';

// TODO(launch): piano, drums and bass are production-ready today. The other
// instruments are temporarily hidden from the picker; add them back here once
// their pipelines ship.
const VISIBLE_INSTRUMENTS = ['piano', 'drums', 'bass'];

const SCORE_CAPABLE = ['drums', 'jazz_bass', 'bass', 'piano'];

// NOTE: Download key maps (STEM_KEYS, MIDI_KEYS) and download handlers are shared across
// the home, MIDI converter and stem splitter cards and TranscriptionHistory.
// When changing download logic here, update those too.
const STEM_KEYS: Record<string, string> = {
  drums: 'bs_roformer_drums_stem',
  piano: 'bs_roformer_piano_stem',
  bass: 'bs_roformer_bass_stem',
  jazz_bass: 'bs_roformer_bass_stem',
  bass_separation: 'bs_roformer_bass_stem',
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

function workflowNameFor(instrument: string): string {
  switch (instrument) {
    case 'drums':
      return 'separate_to_drumscore_v2_full';
    case 'jazz_bass':
      return 'separate_to_jazz_bass_score_full';
    case 'bass':
      return 'separate_to_bass_score_full';
    case 'piano':
      return 'separate_to_piano_score_full';
    case 'guitar':
      return 'separate_to_guitar_stem';
    default:
      return 'bs_roformer_separate';
  }
}

interface HeroUploaderProps {
  /** Server-rendered heading block (h1, subtitle, desktop disclaimer). */
  intro: ReactNode;
  /** Server-rendered disclaimer shown under the card on mobile. */
  mobileDisclaimer: ReactNode;
}

/**
 * The landing page's upload card: pick an instrument, drop a file, watch it
 * queue and transcribe, then open the result in place. Anonymous visitors get
 * the 10-second preview; signed-in visitors run the full song. Everything
 * here depends on the visitor, so it is the page's client island; the heading
 * around it stays server-rendered.
 */
export default function HeroUploader({ intro, mobileDisclaimer }: HeroUploaderProps) {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  const { openLoginModal } = useLoginModal();
  const { t } = useTranslation();
  const router = useRouter();
  const isTouch = useIsTouch();

  const [fileName, setFileName] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatusState] = useState<string | null>(null);
  // Queue block from the status endpoint while the job waits for a worker.
  const [queue, setQueue] = useState<WorkflowQueue | null>(null);
  // Consecutive failed polls, so an API blip is visible instead of a frozen screen.
  const [pollFailures, setPollFailures] = useState(0);
  const [progress, setProgressState] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  const [resultMetadata, setResultMetadata] = useState<WorkflowMetadata>({});
  // The finished job's output file map. The result view reads every separated
  // stem out of it; with only the prefetched blobs it knows about the one
  // instrument that was asked for and can't build the "everything else" row.
  const [resultFiles, setResultFiles] = useState<Record<string, unknown> | null>(null);
  const [selectedInstrument, setSelectedInstrument] = useState('piano');

  // The polling loop and the download helpers run long after the render that
  // started them, so they read the live values from refs, not from the
  // closure (the CRA card read stale state there: its "worker picked it up"
  // notification and its poll backoff never fired).
  const statusRef = useRef<string | null>(null);
  const progressRef = useRef(0);
  const fileNameRef = useRef<string | null>(null);
  // Same map as resultFiles, readable synchronously: the download runs in the
  // poll callback, before a setState from the same tick is visible.
  const resultFilesRef = useRef<Record<string, unknown> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefetchedFilesRef = useRef<Record<string, DownloadedFile>>({});
  const { persist, recover, clear: clearPersistence } = useWorkflowPersistence();
  const recoveredRef = useRef(false);

  const setStatus = useCallback((value: string | null) => {
    statusRef.current = value;
    setStatusState(value);
  }, []);
  const setProgress = useCallback((value: number) => {
    progressRef.current = value;
    setProgressState(value);
  }, []);
  const setFile = (name: string | null) => {
    fileNameRef.current = name;
    setFileName(name);
  };

  const { simulateProgress, stopProgressSimulation } = useProgressSimulation(setProgress);

  const uiState = uiStateFor(status, queue);

  useCompletionConfetti(isCompletedStatus(status) && Boolean(downloadFilename));

  // Download transcription for score instruments, the separated track for the rest.
  const downloadInstrumentFile = async (id: string): Promise<{ objectUrl: string; filename: string }> => {
    // A score instrument has several possible MusicXML names and only one of
    // them exists for any given job: the drums chain writes
    // midi2score_drums_v2_musicxml / adtof_plus_drums_musicxml and never a
    // bare `musicxml`, which is what this used to ask for unconditionally.
    // Try the key the finished job reported first, then the rest, and only
    // fail if none resolve.
    let fileKeys: string[];
    if (SCORE_CAPABLE.includes(selectedInstrument)) {
      const candidates = scoreKeysFor(selectedInstrument);
      const reported = resultFilesRef.current;
      fileKeys = reported
        ? [...candidates.filter((k) => reported[k]), ...candidates.filter((k) => !reported[k])]
        : candidates;
    } else if (selectedInstrument === 'vocals') {
      fileKeys = ['bs_roformer_vocals_stem'];
    } else if (selectedInstrument === 'guitar') {
      fileKeys = ['bs_roformer_guitar_stem'];
    } else if (selectedInstrument === 'other') {
      fileKeys = ['bs_roformer_other_stem'];
    } else if (selectedInstrument === 'bass_separation') {
      fileKeys = ['bs_roformer_bass_stem'];
    } else {
      fileKeys = [selectedInstrument];
    }
    const isPreview = id.startsWith('PRV');
    const dlPrefix = isPreview ? '/preview' : '/workflow';
    const fetchFn = isPreview ? previewFetch : authenticatedFetch;
    let res: Response | null = null;
    let lastBody = '';
    for (const key of fileKeys) {
      const attempt = await fetchFn(`${API_BASE_URL}${dlPrefix}/download/${id}/${key}`, {}, getToken);
      if (attempt.ok) {
        res = attempt;
        break;
      }
      lastBody = await attempt.text().catch(() => '');
      // Anything other than "this job doesn't have that file" is a real error.
      if (attempt.status !== 404) {
        throw new Error(`Download failed ${attempt.status}: ${lastBody}`);
      }
    }
    if (!res) {
      throw new Error(`Download failed 404: ${lastBody}`);
    }
    const blob = await res.blob();
    const extension = SCORE_CAPABLE.includes(selectedInstrument) ? '.musicxml' : '.wav';
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

    // Kept for the manual download button, and saved right away.
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

  // Poll workflow status
  const pollStatus = (id: string) => {
    let consecutive404s = 0;
    let intervalMs = 3000; // start at 3s
    const max404s = 8; // tolerate more 404s (cold starts & eventual consistency)
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        // Use preview or authenticated fetch based on job ID prefix
        const isPreview = id.startsWith('PRV');
        const fetchFn = isPreview ? previewFetch : authenticatedFetch;
        const statusPrefix = isPreview ? '/preview' : '/workflow';
        const response = await fetchFn(
          `${API_BASE_URL}${statusPrefix}/status/${id}`,
          { mode: 'cors', cache: 'no-store' },
          getToken
        );
        if (response.status === 404) {
          consecutive404s++;
          if (consecutive404s >= max404s) {
            setError('Job not found after repeated attempts. Please re-upload.');
            stopped = true;
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
            setResultMetadata(data.outputs?.metadata || data.metadata || {});
            resultFilesRef.current = data.outputs?.files || null;
            setResultFiles(resultFilesRef.current);
            // Stop the simulation but don't show 100% until the download lands.
            stopProgressSimulation();
            sendNotification('GrooveSheet', { body: 'Your transcription is ready!' });
            stopped = true;
            try {
              const { objectUrl, filename } = await downloadInstrumentFile(id);
              setDownloadUrl(objectUrl);
              setDownloadFilename(filename);
              setStatus('completed');
              setProgress(100);
              downloadScorePdfFile(id);
              persist({ jobId: id, status: 'completed', progress: 100, instrument: selectedInstrument, fileName: fileNameRef.current ?? undefined });
              // Pre-fetch secondary files (stem, MIDI) in background for instant downloads
              prefetchSecondaryFiles(id);
            } catch (err) {
              console.error('Download error:', err);
              setError(`Download failed: ${errorInfo(err).message}`);
            }
            return;
          } else if (isFailedStatus(newStatus)) {
            stopProgressSimulation();
            setError(data.message || 'Processing failed.');
            stopped = true;
            return;
          }
          // Queue to worker transition
          const previous = statusRef.current;
          if (newStatus === 'worker_processing' && (previous === 'started' || previous === 'pending')) {
            simulateProgress();
            sendNotification('GrooveSheet', { body: "It's your turn \u2014 processing your audio now." });
          }
          // Pause the progress simulation while queued
          if (newStatus === 'started') {
            stopProgressSimulation();
            setProgress(0);
            requestNotificationPermission();
          }
          // Only update status (progress is handled by the simulation)
          setStatus(newStatus);
          persist({ jobId: id, status: newStatus, progress: progressRef.current, instrument: selectedInstrument, fileName: fileNameRef.current ?? undefined });
        }
      } catch (err) {
        console.error('Polling error:', err);
        const info = errorInfo(err);
        if (info.name === 'TypeError') {
          // Network glitch; keep polling (the job is server-side) but count
          // it so the page can say it is reconnecting rather than freezing.
          setPollFailures((n) => n + 1);
        } else {
          setError(`Status error: ${info.message}`);
        }
      } finally {
        // Exponential backoff up to 20s once progress > 60 to reduce load
        if (!stopped) {
          if (progressRef.current >= 60 && intervalMs < 20000) intervalMs = Math.min(intervalMs * 2, 20000);
          setTimeout(poll, intervalMs);
        }
      }
    };
    poll();
  };

  // Handle upload: start the workflow (signed in) or a preview (anonymous/free)
  const handleUpload = async (fileToUpload: File) => {
    if (!isLoaded) {
      setError('Loading user data...');
      return;
    }

    // Determine whether to use preview (anonymous/free) or full workflow
    const usePreview = !isSignedIn;

    setError(null);
    setStatus('uploading');

    // Start simulated progress for upload
    simulateProgress();

    try {
      const workflowName = workflowNameFor(selectedInstrument);

      let data: StartPayload;
      if (usePreview) {
        // Anonymous/free user: use preview API (no auth required)
        data = await startPreview<StartPayload>(
          API_BASE_URL,
          workflowName,
          fileToUpload,
          { instrument: selectedInstrument, source: UPLOAD_SOURCE },
          getToken
        );
      } else {
        // Authenticated user: use full workflow API
        const formData = new FormData();
        const safeName = fileToUpload.name.normalize('NFC').replace(/[^\x20-\x7E]/g, '_');
        const safeFile =
          safeName !== fileToUpload.name ? new File([fileToUpload], safeName, { type: fileToUpload.type }) : fileToUpload;
        formData.append('file', safeFile);
        formData.append('metadata', JSON.stringify({ instrument: selectedInstrument, source: UPLOAD_SOURCE }));

        const response = await authenticatedFetch(
          `${API_BASE_URL}/workflow/${workflowName}`,
          { method: 'POST', body: formData },
          getToken
        );

        if (!response.ok) {
          const detail = await readDetail(response);
          console.error('Upload failed:', response.status, detail);
          throw statusError(detail || `Upload failed: ${response.statusText}`, response.status);
        }

        data = (await response.json()) as StartPayload;
      }

      const workflowId = data.workflow_id || data.preview_id || data.job_id;
      if (!workflowId) {
        throw new Error('No workflow_id returned from server');
      }

      // Activation step of the funnel. Fired after the backend accepted the
      // job, on both the preview and the authenticated path, so an anonymous
      // first transcription counts too. Never-throw.
      trackWorkflowStarted(workflowName, {
        workflow_id: workflowId,
        instrument: selectedInstrument,
        is_preview: Boolean(usePreview),
      });

      // Stash preview ID for post-signup claim if anonymous
      if (usePreview && workflowId.startsWith('PRV')) {
        setPendingPreviewId(workflowId);
      }

      setJobId(workflowId);
      const initialStatus = data.status || 'pending';
      setStatus(initialStatus);
      persist({
        jobId: workflowId,
        status: initialStatus,
        progress: progressRef.current,
        instrument: selectedInstrument,
        fileName: fileToUpload.name,
      });

      // Give the backend a moment to save job data before polling; this
      // avoids races with Cloud Run scaling.
      setTimeout(() => {
        pollStatus(workflowId);
      }, 1000);
    } catch (err) {
      console.error('Upload error:', err);
      const info = errorInfo(err);

      // Out of minutes: the plans are what they need, not an error banner.
      if (info.status === 402) {
        setStatus(null);
        stopProgressSimulation();
        scrollToPricing({ tab: 'topups' });
        return;
      }

      if (info.message.includes('fetch') || info.name === 'TypeError') {
        setError('Unable to connect to server. This may be a CORS issue. Please check the console for details.');
      } else {
        setError(info.message || 'Failed to upload file. Please try again.');
      }
      setStatus(null);
    }
  };

  // Handle file selection
  const handleFileChange = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;

    if (!isSupportedFileType(selectedFile)) {
      setError(t('hero.errors.fileFormat'));
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(t('hero.errors.fileSize'));
      return;
    }

    setFile(selectedFile.name);
    setError(null);

    // Auto-upload after file selection
    handleUpload(selectedFile);
  };

  // Recover a persisted workflow on mount: a reload mid-job resumes polling
  // instead of showing an empty card while the song is still processing.
  useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;

    const saved = recover();
    if (!saved || !saved.jobId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a job saved in localStorage, which only the browser can read
    setJobId(saved.jobId);
    setStatus(saved.status ?? null);
    setProgress(saved.progress || 0);
    setSelectedInstrument(saved.instrument || 'piano');
    if (saved.fileName) setFile(saved.fileName);

    // If the job was still in progress, resume polling
    const terminalStatuses = ['completed', 'succeeded', 'success', 'failed', 'error'];
    if (!terminalStatuses.includes(saved.status ?? '')) {
      // Resume progress simulation for non-queued states
      if (saved.status !== 'started') {
        simulateProgress();
      }
      setTimeout(() => pollStatus(saved.jobId), 1000);
    }
    // Runs once on mount; the handlers it calls read live values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset upload state
  const resetUpload = () => {
    stopProgressSimulation();

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    prefetchedFilesRef.current = {};
    setFile(null);
    setJobId(null);
    setStatus(null);
    setQueue(null);
    setPollFailures(0);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    setDownloadFilename(null);
    setResultMetadata({});
    setResultFiles(null);
    resultFilesRef.current = null;
    clearPersistence();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Manual download handler
  const handleManualDownload = () => {
    if (downloadUrl && downloadFilename) {
      triggerDownload(downloadUrl, downloadFilename);
    }
  };

  // Generic file download helper for secondary download buttons
  const handleDownloadFile = async (fileKey: string, defaultExtension: string, labelForFilename: string) => {
    if (!jobId) return;
    setDownloadError(null);
    try {
      // Use pre-fetched data if available, otherwise fetch on demand
      const result =
        prefetchedFilesRef.current[fileKey] || (await downloadWorkflowFile(API_BASE_URL, jobId, fileKey, getToken));
      if (!result) {
        setDownloadError(`"${fileKey}" not found \u2014 this file may not have been generated yet.`);
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
      setDownloadError(errorInfo(err).message || 'Failed to download file.');
    }
  };

  // Download stem WAV using backend descriptive BS-Roformer keys
  const handleDownloadStem = () => {
    const stemKey = STEM_KEYS[selectedInstrument] || selectedInstrument;
    handleDownloadFile(stemKey, '.wav', `${selectedInstrument}_stem`);
  };

  // Download MIDI using backend descriptive keys
  const handleDownloadMidi = () => {
    const midiKey = MIDI_KEYS[selectedInstrument];
    if (!midiKey) return;
    handleDownloadFile(midiKey, '.mid', 'midi');
  };

  // Promote a signed-in user's preview to a full run (no re-upload).
  const handleUpgradeToFull = async () => {
    if (!jobId || !jobId.startsWith('PRV')) return;
    try {
      const result = await upgradeToFull<{ workflow_id?: string }>(API_BASE_URL, jobId, getToken);
      const workflowId = result?.workflow_id;
      if (workflowId) {
        // Replace the preview result with the new full workflow's polling.
        prefetchedFilesRef.current = {};
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
        setDownloadFilename(null);
        setJobId(workflowId);
        setStatus('processing');
        setProgress(0);
        simulateProgress();
        persist({ jobId: workflowId, status: 'processing', progress: 0, instrument: selectedInstrument, fileName: fileName ?? undefined });
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

  // preview_id is already stashed in localStorage at upload time; after
  // signup the app-level hook claims it via /preview/{id}/claim.
  const handleSignUpToUnlock = () => {
    openLoginModal();
  };

  // Browse is open to anonymous visitors too: they get the preview.
  const handleBrowseClick = () => {
    if (!isLoaded) return;
    fileInputRef.current?.click();
  };

  // Drag and drop handlers, inert while a finished result is on screen.
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (uiState === 'success') return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (uiState === 'success') return;

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  // On touch there is nothing to drag, so the whole drop zone becomes the tap
  // target and the copy stops telling people to do something they can't.
  // Clicks landing on the inner button are left alone: it opens the picker
  // itself, and letting them bubble here would fire it twice.
  const handleDropZoneTap = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest('.browse-files-btn')) return;
    handleBrowseClick();
  };

  const renderIdleState = () => (
    <>
      <div className="instrument-tabs">
        {[
          { value: 'vocals', label: t('hero.instruments.vocal'), icon: LiaMicrophoneAltSolid },
          { value: 'drums', label: t('hero.instruments.drums'), icon: LuDrum },
          { value: 'piano', label: t('hero.instruments.piano'), icon: Piano },
          { value: 'guitar', label: t('hero.instruments.guitar'), icon: LuGuitar },
          { value: 'bass', label: t('hero.instruments.bass'), icon: BassIcon },
        ]
          .filter((instrument) => VISIBLE_INSTRUMENTS.includes(instrument.value))
          .map((instrument) => {
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
          <TrayArrowUpIcon clipId="clip0_tray" />
        </div>
        <div className="upload-text">
          <h3>{t('hero.uploading')}</h3>
        </div>
      </div>

      <div className="upload-controls compact">
        {renderProgressBar()}
        <button className="cancel-btn compact" onClick={resetUpload}>
          {t('hero.cancel')}
        </button>
      </div>
    </>
  );

  // Waiting for a worker. With a real position from the backend, say where
  // in line and roughly how long; without one, just that it is queued.
  const renderQueueState = (withPosition: boolean) => {
    const summary = withPosition ? queueSummary(queue) : null;
    return (
      <>
        <div className="upload-content-top compact">
          <div className="upload-icon">
            <ServerIcon />
          </div>
          <div className="upload-text">
            <h3>{t('hero.inQueue')}</h3>
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
          <h3>{t('hero.transcribing')}</h3>
        </div>
      </div>

      <div className="upload-controls compact">
        {renderProgressBar()}
        <button className="cancel-btn compact" onClick={resetUpload}>
          {t('hero.cancel')}
        </button>
      </div>
    </>
  );

  // On success the upload card expands over the hero copy and fills the
  // viewport, showing the /explore-style viewer for the fresh transcription.
  const isSuccess = uiState === 'success';

  return (
    <section className="hero">
      <div className={`hero-container ${isSuccess ? 'success-expanded' : ''}`}>
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
          {uiState === 'queued' && renderQueueState(true)}
          {uiState === 'cold_starting' && renderQueueState(false)}
          {uiState === 'processing' && renderProcessingState()}
          {isSuccess && (
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
              downloadError={downloadError}
              isSignedIn={isSignedIn}
              onUpgradeToFull={handleUpgradeToFull}
              onSignUpToUnlock={handleSignUpToUnlock}
              title={typeof resultMetadata.title === 'string' ? resultMetadata.title : undefined}
            />
          )}

          {/* Error message overlay */}
          {error && (
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
