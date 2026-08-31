import React, { useState, useRef, useEffect } from 'react';
import { useUser, useAuth } from '../auth';
import confetti from 'canvas-confetti';
import { authenticatedFetch } from '../utils/api';
import {
  previewFetch,
  startPreview,
  upgradeToFull,
  setPendingPreviewId,
} from '../utils/previewApi';
import { scrollToPricing } from '../utils/scrollToPricing';
import { requestNotificationPermission, sendNotification } from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';
import { LuGuitar, LuDrum } from 'react-icons/lu';
import { Piano } from 'lucide-react';
import { LiaMicrophoneAltSolid } from 'react-icons/lia';
import Header from './layout/Header';
import Footer from './layout/Footer';
import HeroBackground from './HeroBackground';
import Features from './Features';
import Pricing from './Pricing';
import Element from './Element';
import Testimonials from './Testimonials';
import FAQ from './FAQ';
import StatusMessage from './ui/StatusMessage';
import './Hero.css';
import config from '../config';

const SUPPORTED_MIME_TYPES = [
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
  'audio/x-nist'
];

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.au', '.sph'];
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024;

const isSupportedFileType = (selectedFile) => {
  const mime = (selectedFile.type || '').toLowerCase();
  if (mime && SUPPORTED_MIME_TYPES.includes(mime)) return true;
  const name = (selectedFile.name || '').toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

const API_BASE_URL = config.apiBaseUrl;

// NOTE: Download key maps (stemKeyMap) and download handlers are shared across
// Hero.js, MidiConverter.js, StemSplitter.js, and TranscriptionHistory.js.
// When changing download logic here, update those files too.

const TrayArrowUpIcon = () => (
  <svg width="64" height="65" viewBox="0 0 64 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_tray_ss)">
      <path d="M52 8.5H12C10.9391 8.5 9.92172 8.92143 9.17157 9.67157C8.42143 10.4217 8 11.4391 8 12.5V52.5C8 53.5609 8.42143 54.5783 9.17157 55.3284C9.92172 56.0786 10.9391 56.5 12 56.5H52C53.0609 56.5 54.0783 56.0786 54.8284 55.3284C55.5786 54.5783 56 53.5609 56 52.5V12.5C56 11.4391 55.5786 10.4217 54.8284 9.67157C54.0783 8.92143 53.0609 8.5 52 8.5ZM22.585 25.085L30.585 17.085C30.7707 16.899 30.9913 16.7515 31.2341 16.6509C31.4769 16.5502 31.7372 16.4984 32 16.4984C32.2628 16.4984 32.5231 16.5502 32.7659 16.6509C33.0087 16.7515 33.2293 16.899 33.415 17.085L41.415 25.085C41.6008 25.2708 41.7482 25.4914 41.8488 25.7342C41.9494 25.977 42.0011 26.2372 42.0011 26.5C42.0011 26.7628 41.9494 27.023 41.8488 27.2658C41.7482 27.5086 41.6008 27.7292 41.415 27.915C41.2292 28.1008 41.0086 28.2482 40.7658 28.3488C40.523 28.4494 40.2628 28.5011 40 28.5011C39.7372 28.5011 39.477 28.4494 39.2342 28.3488C38.9914 28.2482 38.7708 28.1008 38.585 27.915L34 23.3275V38.5C34 39.0304 33.7893 39.5391 33.4142 39.9142C33.0391 40.2893 32.5304 40.5 32 40.5C31.4696 40.5 30.9609 40.2893 30.5858 39.9142C30.2107 39.5391 30 39.0304 30 38.5V23.3275L25.415 27.915C25.0397 28.2903 24.5307 28.5011 24 28.5011C23.4693 28.5011 22.9603 28.2903 22.585 27.915C22.2097 27.5397 21.9989 27.0307 21.9989 26.5C21.9989 25.9693 22.2097 25.4603 22.585 25.085ZM52 52.5H12V42.5H19.1725L24 47.3275C24.3701 47.7006 24.8106 47.9963 25.296 48.1976C25.7814 48.3989 26.302 48.5017 26.8275 48.5H37.1725C37.698 48.5017 38.2186 48.3989 38.704 48.1976C39.1894 47.9963 39.6299 47.7006 40 47.3275L44.8275 42.5H52V52.5Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_tray_ss">
        <rect width="64" height="64" fill="white" transform="translate(0 0.5)"/>
      </clipPath>
    </defs>
  </svg>
);

const MagicWandIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.3333 42.6667L21.3333 50.6667L50.6667 21.3333L42.6667 13.3333L13.3333 42.6667Z" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 10.6667V5.33337" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M53.3333 32H58.6667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M48 16L51.7333 12.2667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 48L12.2667 51.7333" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.33337 32H10.6667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 16L12.2667 12.2667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M32 58.6667V53.3334" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M48 48L51.7333 51.7333" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="28" fill="white" stroke="white" strokeWidth="4"/>
    <path d="M20 32L28 40L44 24" stroke="#171717" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M27 9L9 27M9 9L27 27" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ServerIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="8" width="40" height="16" rx="3" stroke="white" strokeWidth="3"/>
    <rect x="12" y="28" width="40" height="16" rx="3" stroke="white" strokeWidth="3"/>
    <circle cx="20" cy="16" r="2.5" fill="white"/>
    <circle cx="20" cy="36" r="2.5" fill="white"/>
    <path d="M32 48V56" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <path d="M22 56H42" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const BassIcon = () => (
  <svg className="fill-none stroke-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
    <title>bass-svg</title>
    <g id="Layer 1">
      <path fillRule="evenodd" d="m11.5 12.5l4.9-4.9"></path>
      <path fillRule="evenodd" d="m21.2 2.9c-0.1-0.1-0.5-0.2-0.6-0.2-0.1-0.1-0.1-0.1-0.4-0.1q-0.2 0-0.3 0.1-0.2 0.1-0.4 0.2l-1.9 1.7c-0.2 0-0.4 0.2-0.5 0.3-0.1 0.1-0.2 0.2-0.3 0.3q0 0.2-0.1 0.3 0 0.2 0 0.4l0.2 0.5c0 0 0 0.3 0 0.3 0 0 0 0.1-0.1 0.2q0 0.2-0.1 0.4-0.1 0.1-0.3 0.3 0.2-0.2 0.3-0.3 0.2-0.1 0.4-0.1 0.1-0.1 0.3-0.2c0.2 0 0.5 0.1 0.6 0.1h0.6q0.2 0 0.3 0 0.2 0 0.4-0.1 0.2-0.1 0.4-0.2c0.1-0.1 0.2-0.1 0.3-0.3 0.2-0.3 0.3-0.7 0.6-1.1 0 0 0.1-0.2 0.7-0.6 0.1-0.1 0.6-0.1 0.6-0.2 0-0.2 0.1-0.2 0-0.3 0-0.1 0-0.4-0.1-0.7-0.2-0.4-0.6-0.7-0.6-0.7z"></path>
      <path d="m6 16l2 2"></path>
      <path id="Layer copy" fillRule="evenodd" d="m9 14l1 1"></path>
      <path fillRule="evenodd" d="m8.1 9.2c1.5-3.4 3.5-3.6 4.2-2.5 0.7 1.2-0.9 2.3 0 3.4 0.7 1 2.1-0.2 1 0.7-2 1.7 2.2 0.1 3.2 1.5 0.6 0.8-0.2 2.3-1.4 2.7l-1.7 0.7c-0.6 0.3-0.6 0.4-0.8 0.5-0.1 0.1-0.2 0.6-0.2 0.6-0.1 0.3-0.1 0.3-0.1 0.9 0 0.2 0 0.5 0 0.6 0 0.5 0 0.8-0.2 1.5-0.2 0.5-0.4 1.1-0.9 1.5-0.4 0.5-0.7 0.6-1.2 0.7-0.6 0.2-1.3 0.3-2 0.1-3-0.9-5.8-3.4-6.2-6.3 0-0.5 0.1-1.3 0.3-1.8 0.3-0.4 0.5-0.8 1.1-1.1 0.4-0.2 0.8-0.4 1.3-0.6 0.5-0.2 0.6-0.3 1.1-0.5 0.2-0.1 0.5-0.2 0.7-0.3q0.2-0.1 0.5-0.2 0.2-0.2 0.4-0.4 0.2-0.2 0.3-0.5z"></path>
    </g>
  </svg>
);

function StemSplitter({ onLoginClick }) {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { isDarkMode } = useTheme();
  // eslint-disable-next-line no-unused-vars
  const [file, setFile] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadFilename, setDownloadFilename] = useState(null);
  const [selectedInstrument, setSelectedInstrument] = useState('vocals');
  // Every run is a 10s preview by default (PRV* IDs); status + download
  // endpoints are inferred from the returned ID prefix (PRV* vs WF*).
  const [previewSelection, setPreviewSelection] = useState(null);
  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const progressTimeoutRef = useRef(null);

  const apiPrefixForId = (id) => (id && id.startsWith('PRV') ? '/preview' : '/workflow');

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    };
  }, []);

  const getUIState = () => {
    if (status === 'uploading') return 'uploading';
    if (status === 'started') return 'cold_starting';
    if (status === 'pending' || status === 'running' || status === 'processing' ||
        status === 'separating' || status === 'transcribing' || status === 'generating_sheet' ||
        status === 'worker_processing') return 'processing';
    if (status === 'completed' || status === 'succeeded' || status === 'success') return 'success';
    return 'idle';
  };

  const uiState = getUIState();

  const simulateProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);

    const numSteps = 20;
    const totalDuration = 60000;
    const startProgress = 11;
    const endProgress = 99;
    const totalProgressRange = endProgress - startProgress;

    const intervals = [];
    for (let i = 0; i < numSteps; i++) intervals.push(Math.random() * 2000 + 500);
    const sum = intervals.reduce((a, b) => a + b, 0);
    const normalizedIntervals = intervals.map(interval => (interval / sum) * totalDuration);

    const progressIncrements = [];
    for (let i = 0; i < numSteps; i++) progressIncrements.push(Math.random());
    const progressSum = progressIncrements.reduce((a, b) => a + b, 0);
    const normalizedIncrements = progressIncrements.map(inc => (inc / progressSum) * totalProgressRange);

    let currentStep = 0;
    let currentProgress = startProgress;

    const executeStep = () => {
      if (currentStep >= numSteps) { setProgress(endProgress); return; }
      currentProgress += normalizedIncrements[currentStep];
      setProgress(Math.min(Math.round(currentProgress), endProgress));
      currentStep++;
      if (currentStep < numSteps) progressTimeoutRef.current = setTimeout(executeStep, normalizedIntervals[currentStep]);
    };

    setProgress(startProgress);
    progressTimeoutRef.current = setTimeout(executeStep, normalizedIntervals[0]);
  };

  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
    if (progressTimeoutRef.current) { clearTimeout(progressTimeoutRef.current); progressTimeoutRef.current = null; }
  };

  useEffect(() => {
    if ((status === 'completed' || status === 'succeeded' || status === 'success') && downloadFilename) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min, max) => Math.random() * (max - min) + min;
      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);
      return () => clearInterval(interval);
    }
  }, [status, downloadFilename]);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!isSupportedFileType(selectedFile)) {
      setError('File format not supported. Accepted: .mp3, .wav, .flac, .ogg, .au, .sph');
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError('File size too large. Max 32MB.');
      return;
    }
    setFile(selectedFile);
    setError(null);
    handleUpload(selectedFile);
  };

  const handleUpload = async (fileToUpload) => {
    if (!isLoaded) { setError('Loading user data...'); return; }

    // Every run goes through the 10-second preview by default.
    const usePreview = true;

    setError(null);
    setStatus('uploading');
    simulateProgress();

    try {
      let data;
      let workflowId;

      if (usePreview) {
        data = await startPreview(
          API_BASE_URL,
          'bs_roformer_separate',
          fileToUpload,
          { instrument: selectedInstrument },
          getToken
        );
        workflowId = data.workflow_id || data.preview_id;
        if (data.selection) setPreviewSelection(data.selection);

        // Stash for post-signup claim. Cleared on success after claim.
        if (!isSignedIn && workflowId) setPendingPreviewId(workflowId);

        // Cache hit — already completed.
        if (data.cached || data.status === 'completed') {
          setJobId(workflowId);
          setStatus('completed');
          setProgress(100);
          stopProgressSimulation();
          try {
            const { objectUrl, filename } = await downloadStemFile(workflowId);
            setDownloadUrl(objectUrl);
            setDownloadFilename(filename);
          } catch (dlErr) {
            setError(`Download failed: ${dlErr.message}`);
          }
          return;
        }
      } else {
        const formData = new FormData();
        const safeName = fileToUpload.name.normalize('NFC').replace(/[^\x20-\x7E]/g, '_');
        const safeFile = safeName !== fileToUpload.name ? new File([fileToUpload], safeName, { type: fileToUpload.type }) : fileToUpload;
        formData.append('file', safeFile);
        formData.append('metadata', JSON.stringify({ instrument: selectedInstrument }));

        const response = await authenticatedFetch(
          `${API_BASE_URL}/workflow/bs_roformer_separate`,
          { method: 'POST', body: formData },
          getToken
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
        }

        data = await response.json();
        workflowId = data.workflow_id || data.job_id;
      }

      if (!workflowId) throw new Error('No workflow_id returned from server');
      setJobId(workflowId);
      setStatus(data.status || 'pending');

      setTimeout(() => pollStatus(workflowId), 1000);
    } catch (err) {
      if (err.status === 429) {
        setError(err.message || `Rate limit exceeded. Try again in ${err.retryAfterSeconds || 60}s.`);
      } else if (err.message && (err.message.includes('fetch') || err.name === 'TypeError')) {
        setError('Unable to connect to server. Please check the console for details.');
      } else {
        setError(err.message || 'Failed to upload file. Please try again.');
      }
      setStatus(null);
      stopProgressSimulation();
    }
  };

  const pollStatus = async (id) => {
    let consecutive404s = 0;
    let intervalMs = 3000;
    const max404s = 8;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const isPreview = id && id.startsWith('PRV');
        const fetchFn = isPreview ? previewFetch : authenticatedFetch;
        const response = await fetchFn(
          `${API_BASE_URL}${apiPrefixForId(id)}/status/${id}`,
          isPreview
            ? { method: 'GET', cache: 'no-store' }
            : { mode: 'cors', credentials: 'omit', cache: 'no-store' },
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
          const data = await response.json();
          const newStatus = data.status || data.state || 'processing';

          if (newStatus === 'completed' || newStatus === 'succeeded' || newStatus === 'success') {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
            sendNotification('GrooveSheet', { body: 'Your stem separation is ready!' });
            stopped = true;
            try {
              const { objectUrl, filename } = await downloadStemFile(id);
              setDownloadUrl(objectUrl);
              setDownloadFilename(filename);
              setStatus('completed');
              setProgress(100);
            } catch (err) {
              setError(`Download failed: ${err.message}`);
            }
            return;
          } else if (newStatus === 'failed' || newStatus === 'error') {
            stopProgressSimulation();
            setError(data.message || 'Processing failed.');
            stopped = true;
            return;
          }
          // Handle cold-start → processing transition
          if (newStatus === 'worker_processing' && (status === 'started' || status === 'pending')) {
            simulateProgress();
            sendNotification('GrooveSheet', { body: 'Server is ready! Separating your audio now.' });
          }
          if (newStatus === 'started') {
            stopProgressSimulation();
            setProgress(0);
            requestNotificationPermission();
          }
          setStatus(newStatus);
        }
      } catch (err) {
        if (err.name !== 'TypeError') {
          setError(`Status error: ${err.message}`);
        }
      } finally {
        if (!stopped) setTimeout(poll, intervalMs);
      }
    };
    poll();
  };

  // Download the separated stem audio file (.wav)
  const downloadStemFile = async (id) => {
    // BS-Roformer outputs 6 stems: vocals, drums, bass, guitar, piano, other.
    const stemKeyMap = {
      vocals: 'bs_roformer_vocals_stem',
      drums: 'bs_roformer_drums_stem',
      bass: 'bs_roformer_bass_stem',
      piano: 'bs_roformer_piano_stem',
      guitar: 'bs_roformer_guitar_stem',
      other: 'bs_roformer_other_stem',
    };
    const fileKey = stemKeyMap[selectedInstrument] || `bs_roformer_${selectedInstrument}_stem`;
    const url = `${API_BASE_URL}${apiPrefixForId(id)}/download/${id}/${fileKey}`;
    const isPreview = id && id.startsWith('PRV');
    const fetchFn = isPreview ? previewFetch : authenticatedFetch;
    const res = await fetchFn(url, {}, getToken);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Download failed ${res.status}: ${txt}`);
    }
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const extension = '.wav';
    const suffix = `_${selectedInstrument}`;
    let filename = file?.name
      ? file.name.replace(/\.[^.]+$/, `${suffix}${extension}`)
      : `${selectedInstrument}_${id}${extension}`;
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (match) filename = decodeURIComponent(match[1] || match[2]);

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return { objectUrl, filename };
  };

  const resetUpload = () => {
    stopProgressSimulation();
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFile(null);
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    setDownloadFilename(null);
    setPreviewSelection(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatTimestamp = (sec) => {
    if (sec == null) return '';
    const total = Math.max(0, Math.round(sec));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleManualDownload = () => {
    if (downloadUrl && downloadFilename) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleBrowseClick = () => {
    if (!isLoaded) return;
    fileInputRef.current?.click();
  };

  // Triggered from the success-state CTA when a *signed-in* user wants to
  // promote their preview to a full run (no re-upload).
  const handleUpgradeToFull = async () => {
    if (!jobId || !jobId.startsWith('PRV')) return;
    try {
      const result = await upgradeToFull(API_BASE_URL, jobId, getToken);
      if (result && result.workflow_id) {
        // Replace the preview view with the new full workflow polling.
        setJobId(result.workflow_id);
        setStatus('processing');
        setProgress(0);
        setDownloadUrl(null);
        setDownloadFilename(null);
        setPreviewSelection(null);
        simulateProgress();
        setTimeout(() => pollStatus(result.workflow_id), 1000);
      }
    } catch (err) {
      // Out of minutes: the plans are what they need, not an error banner.
      if (err.status === 402) {
        scrollToPricing();
        return;
      }
      setError(err.message || 'Failed to start full song processing.');
    }
  };

  const handleSignUpToUnlock = () => {
    // preview_id was already stashed in localStorage at upload time; the
    // LoginModal post-signup hook will call /preview/{id}/claim.
    if (onLoginClick) onLoginClick();
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileChange(droppedFile);
  };

  const renderIdleState = () => (
    <>
      <div className="instrument-tabs">
        {[
          { value: 'vocals', label: 'Vocal', icon: LiaMicrophoneAltSolid },
          { value: 'drums', label: 'Drums', icon: LuDrum },
          { value: 'piano', label: 'Piano', icon: Piano },
          { value: 'guitar', label: 'Guitar', icon: LuGuitar },
          { value: 'bass', label: 'Bass', icon: BassIcon }
        ].map((instrument) => {
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
      >
        <div className="upload-content-wrapper">
          <div className="upload-visual-group">
            <div className="file-formats-visual">
              <img
                src={isDarkMode ? "/images/hero_upload_img_dark.png" : "/images/hero_upload_img_light.png"}
                alt="Supported audio formats"
              />
            </div>
            <div className="upload-text-group">
              <p className="upload-main-text">Drag and drop an audio file</p>
              <p className="upload-sub-text">MP3, WAV, FLAC up to 50MB</p>
            </div>
          </div>
          <button className="browse-files-btn" onClick={handleBrowseClick}>
            Browse Files
          </button>
        </div>
      </div>
    </>
  );

  const renderUploadingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon"><TrayArrowUpIcon /></div>
        <div className="upload-text"><h3>Uploading...</h3></div>
      </div>
      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div className="progress-bar-fill compact" style={{ width: `${Math.min(progress, 100)}%` }}>
            <span className="progress-percentage compact">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar-remaining compact" />
        </div>
        <button className="cancel-btn compact" onClick={resetUpload}>Cancel</button>
      </div>
    </>
  );

  const renderColdStartState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon cold-start-pulse"><ServerIcon /></div>
        <div className="upload-text">
          <h3 className="cold-start-message">Waking up our servers...</h3>
          <p className="cold-start-sub">We're in early access! This may take ~5-10 min. We'll notify you when ready.</p>
        </div>
      </div>
      <div className="upload-controls compact">
        <button className="cancel-btn compact" onClick={resetUpload}>Cancel</button>
      </div>
    </>
  );

  const renderProcessingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon"><MagicWandIcon /></div>
        <div className="upload-text"><h3>Separating...</h3></div>
      </div>
      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div className="progress-bar-fill compact" style={{ width: `${Math.min(progress, 100)}%` }}>
            <span className="progress-percentage compact">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar-remaining compact" />
        </div>
        <button className="cancel-btn compact" onClick={resetUpload}>Cancel</button>
      </div>
    </>
  );

  const renderSuccessState = () => {
    const isPreviewResult = jobId && jobId.startsWith('PRV');
    return (
      <>
        <button className="close-btn-corner" onClick={resetUpload} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="upload-content-top compact">
          <div className="upload-icon"><CheckCircleIcon /></div>
          <div className="upload-text success-text">
            <h3>{isPreviewResult ? '10-Second Preview Ready!' : 'Separation Succeeded!'}</h3>
            <p className="filename-text">{file?.name || 'Uploaded_file_name.mp3'}</p>
            {isPreviewResult && previewSelection && (
              <p className="filename-text" style={{ opacity: 0.75, fontSize: '13px', marginTop: '4px' }}>
                Previewing {formatTimestamp(previewSelection.start_sec)} – {formatTimestamp(previewSelection.end_sec)} of your song
              </p>
            )}
          </div>
        </div>
        <div className="upload-controls success-controls compact">
          <button className="download-transcription-btn compact" onClick={handleManualDownload}>
            {isPreviewResult ? 'Download 10s Preview' : 'Download Stem'}
          </button>
          {isPreviewResult && !isSignedIn && (
            <button
              className="download-transcription-btn compact"
              style={{ marginTop: '8px', backgroundColor: 'var(--color-accent, #6366f1)' }}
              onClick={handleSignUpToUnlock}
            >
              Sign up to process the full song
            </button>
          )}
          {isPreviewResult && isSignedIn && (
            <button
              className="download-transcription-btn compact"
              style={{ marginTop: '8px', backgroundColor: 'var(--color-accent, #6366f1)' }}
              onClick={handleUpgradeToFull}
            >
              Process the full song now
            </button>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-background)' }}>
      <div className="dot-grid"></div>
      <HeroBackground />
      <Header onLoginClick={onLoginClick} />
      <section className="hero" style={{ flex: 1, position: 'relative', zIndex: 10 }}>
        <div className="hero-container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">Extract vocals & instruments from any audio.</h1>
              <p className="hero-subtitle">
                Upload an audio. Receive clean, separated & high quality audio stems in minutes.
              </p>
            </div>
            <div className="hero-disclaimer hero-disclaimer-desktop">
              <span>By uploading a file, you agree to our </span>
              <a href="/terms">Terms of Service</a>
            </div>
          </div>
          <div
            className={`upload-area state-${uiState} ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
              e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.flac,.ogg,.au,.sph,audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/x-ogg,audio/basic,audio/x-au,audio/x-nist"
              onChange={(e) => handleFileChange(e.target.files[0])}
              style={{ display: 'none' }}
            />
            {uiState === 'idle' && renderIdleState()}
            {uiState === 'uploading' && renderUploadingState()}
            {uiState === 'cold_starting' && renderColdStartState()}
            {uiState === 'processing' && renderProcessingState()}
            {uiState === 'success' && renderSuccessState()}
            {error && uiState !== 'success' && (
              <div className="error-overlay">
                <StatusMessage variant="error">{error}</StatusMessage>
              </div>
            )}
          </div>
          <div className="hero-disclaimer hero-disclaimer-mobile">
            <span>By uploading a file, you agree to our </span>
            <a href="/terms">Terms of Service</a>
          </div>
        </div>
      </section>
      <div style={{ marginTop: '120px', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '-249px',
          left: 0,
          width: '100%',
          height: '249px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, var(--color-tinted-background) 100%)',
          pointerEvents: 'none',
        }} />
        <Features />
      </div>
      <Pricing onLoginClick={onLoginClick} />
      <Element />
      <Testimonials />
      <FAQ />
      <Footer />
    </div>
  );
}

export default StemSplitter;
