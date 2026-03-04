import React, { useState, useRef, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import confetti from 'canvas-confetti';
import { authenticatedFetch } from '../utils/api';
import { requestNotificationPermission, sendNotification } from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';
import { LuGuitar, LuMusic4, LuDrum } from 'react-icons/lu';
import { Piano } from 'lucide-react';
import { LiaMicrophoneAltSolid } from 'react-icons/lia';
import './Hero.css';

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
  if (mime && SUPPORTED_MIME_TYPES.includes(mime)) {
    return true;
  }

  const name = (selectedFile.name || '').toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
};

// Base URL for the new Orchestrator backend
// Use /api in both dev and production - Vercel rewrites handle the proxy
const API_BASE_URL = '/api';

// SVG Icons as components
const TrayArrowUpIcon = () => (
  <svg width="64" height="65" viewBox="0 0 64 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0_tray)">
      <path d="M52 8.5H12C10.9391 8.5 9.92172 8.92143 9.17157 9.67157C8.42143 10.4217 8 11.4391 8 12.5V52.5C8 53.5609 8.42143 54.5783 9.17157 55.3284C9.92172 56.0786 10.9391 56.5 12 56.5H52C53.0609 56.5 54.0783 56.0786 54.8284 55.3284C55.5786 54.5783 56 53.5609 56 52.5V12.5C56 11.4391 55.5786 10.4217 54.8284 9.67157C54.0783 8.92143 53.0609 8.5 52 8.5ZM22.585 25.085L30.585 17.085C30.7707 16.899 30.9913 16.7515 31.2341 16.6509C31.4769 16.5502 31.7372 16.4984 32 16.4984C32.2628 16.4984 32.5231 16.5502 32.7659 16.6509C33.0087 16.7515 33.2293 16.899 33.415 17.085L41.415 25.085C41.6008 25.2708 41.7482 25.4914 41.8488 25.7342C41.9494 25.977 42.0011 26.2372 42.0011 26.5C42.0011 26.7628 41.9494 27.023 41.8488 27.2658C41.7482 27.5086 41.6008 27.7292 41.415 27.915C41.2292 28.1008 41.0086 28.2482 40.7658 28.3488C40.523 28.4494 40.2628 28.5011 40 28.5011C39.7372 28.5011 39.477 28.4494 39.2342 28.3488C38.9914 28.2482 38.7708 28.1008 38.585 27.915L34 23.3275V38.5C34 39.0304 33.7893 39.5391 33.4142 39.9142C33.0391 40.2893 32.5304 40.5 32 40.5C31.4696 40.5 30.9609 40.2893 30.5858 39.9142C30.2107 39.5391 30 39.0304 30 38.5V23.3275L25.415 27.915C25.0397 28.2903 24.5307 28.5011 24 28.5011C23.4693 28.5011 22.9603 28.2903 22.585 27.915C22.2097 27.5397 21.9989 27.0307 21.9989 26.5C21.9989 25.9693 22.2097 25.4603 22.585 25.085ZM52 52.5H12V42.5H19.1725L24 47.3275C24.3701 47.7006 24.8106 47.9963 25.296 48.1976C25.7814 48.3989 26.302 48.5017 26.8275 48.5H37.1725C37.698 48.5017 38.2186 48.3989 38.704 48.1976C39.1894 47.9963 39.6299 47.7006 40 47.3275L44.8275 42.5H52V52.5Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_tray">
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

function Hero({ onLoginRequired }) {
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
  const [selectedInstrument, setSelectedInstrument] = useState('drums');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const fileInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const dropdownMenuRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const progressTimeoutRef = useRef(null);

  const _instruments = [
    { value: 'drums', label: 'Drums', IconComponent: LuDrum },
    { value: 'piano', label: 'Piano', IconComponent: Piano },
    { value: 'jazz_bass', label: 'Jazz Bass', IconComponent: LuMusic4 },
    { value: 'bass', label: 'Bass\u00a0\u00a0(FCPE F0)', IconComponent: BassIcon },
    // Use non-breaking spaces so the gap shows in rendered HTML
    { value: 'bass_separation', label: 'Bass', IconComponent: BassIcon },
    { value: 'vocals', label: 'Vocal\u00a0\u00a0(Separation only)', IconComponent: LiaMicrophoneAltSolid },
    { value: 'other', label: 'Other\u00a0\u00a0(Separation only)', IconComponent: LuGuitar }
  ];

  // Cleanup progress simulation on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  // Determine the current UI state based on status
  const getUIState = () => {
    console.log('🎯 getUIState - current status:', status, 'progress:', progress);
    
    if (status === 'uploading') {
      console.log('📤 UI State: UPLOADING');
      return 'uploading';
    }
    
    if (status === 'started') {
      console.log('🧊 UI State: COLD_STARTING');
      return 'cold_starting';
    }

    if (status === 'pending' || status === 'running' || status === 'processing' ||
        status === 'separating' || status === 'transcribing' || status === 'generating_sheet' ||
        status === 'worker_processing') {
      console.log('⚙️ UI State: PROCESSING');
      return 'processing';
    }
    
    if (status === 'completed' || status === 'succeeded' || status === 'success') {
      console.log('✅ UI State: SUCCESS');
      return 'success';
    }
    
    console.log('💤 UI State: IDLE (default)');
    return 'idle'; // Default idle state
  };

  const uiState = getUIState();
  console.log('🎨 Current UI State:', uiState);

  // Simulate progress from 11-99% over 30 seconds
  const simulateProgress = () => {
    // Clear any existing intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }

    // 60 seconds for both upload and processing phases (slower perceived processing)
    const numSteps = 20;
    const totalDuration = 60000; // 60 seconds
    const startProgress = 11; // Start at 11%
    const endProgress = 99; // End at 99% until actual completion
    const totalProgressRange = endProgress - startProgress; // 88%
    
    // Generate random intervals
    const intervals = [];
    for (let i = 0; i < numSteps; i++) {
      intervals.push(Math.random() * 2000 + 500); // Random between 500-2500ms
    }
    
    // Normalize to sum to totalDuration
    const sum = intervals.reduce((a, b) => a + b, 0);
    const normalizedIntervals = intervals.map(interval => (interval / sum) * totalDuration);
    
    // Generate random progress increments that sum to totalProgressRange
    const progressIncrements = [];
    for (let i = 0; i < numSteps; i++) {
      progressIncrements.push(Math.random());
    }
    const progressSum = progressIncrements.reduce((a, b) => a + b, 0);
    const normalizedIncrements = progressIncrements.map(inc => (inc / progressSum) * totalProgressRange);
    
    let currentStep = 0;
    let currentProgress = startProgress;
    
    const executeStep = () => {
      if (currentStep >= numSteps) {
        setProgress(endProgress);
        return;
      }
      
      currentProgress += normalizedIncrements[currentStep];
      setProgress(Math.min(Math.round(currentProgress), endProgress));
      
      currentStep++;
      
      if (currentStep < numSteps) {
        progressTimeoutRef.current = setTimeout(executeStep, normalizedIntervals[currentStep]);
      }
    };
    
    // Start at 11%
    setProgress(startProgress);
    progressTimeoutRef.current = setTimeout(executeStep, normalizedIntervals[0]);
  };

  // Stop progress simulation
  const stopProgressSimulation = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
    // Don't set to 100% - keep at current progress (99%)
  };

  // Update dropdown position when it opens or on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (dropdownRef.current && isDropdownOpen) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width
        });
      }
    };

    if (isDropdownOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside both the button and the portaled dropdown menu
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Trigger confetti when download completes
  useEffect(() => {
    if ((status === 'completed' || status === 'succeeded' || status === 'success') && downloadFilename) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [status, downloadFilename]);

  // Handle file selection
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
    
    // Auto-upload after file selection
    handleUpload(selectedFile);
  };

  // Handle upload -> start demucs_separate workflow
  const handleUpload = async (fileToUpload) => {
    // Check if user is logged in
    if (!isLoaded) {
      setError('Loading user data...');
      return;
    }

    if (!isSignedIn) {
      // Trigger login modal
      if (onLoginRequired) {
        onLoginRequired();
      }
      return;
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);  // Changed from 'audio_file' to 'file'
    // Add metadata with selected instrument
    formData.append('metadata', JSON.stringify({ 
      instrument: selectedInstrument 
    }));

    setError(null);
    console.log('🚀 Starting upload - setting status to uploading');
    setStatus('uploading');
    
    // Start simulated progress for upload (60 seconds)
    simulateProgress();
    
    // Auto-transition to processing after 60 seconds
    setTimeout(() => {
      if (status === 'uploading') {
        console.log('⏰ 60 seconds elapsed, switching to processing state');
        setStatus('processing');
        simulateProgress(); // Restart progress for processing phase
      }
    }, 60000);

    try {
      // Workflow selection logic
      let workflowEndpoint = '/workflow/demucs_separate';
      if (selectedInstrument === 'drums') {
        workflowEndpoint = '/workflow/separate_to_drumscore_full';
      } else if (selectedInstrument === 'jazz_bass') {
        workflowEndpoint = '/workflow/separate_to_jazz_bass_score_full';
      } else if (selectedInstrument === 'bass') {
        workflowEndpoint = '/workflow/separate_to_bass_score_full';
      } else if (selectedInstrument === 'piano') {
        workflowEndpoint = '/workflow/separate_to_piano_score_full';
      }
      
      const response = await authenticatedFetch(
        `${API_BASE_URL}${workflowEndpoint}`,
        {
          method: 'POST',
          body: formData
        },
        getToken
      );

      console.log('Upload response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Upload failed:', errorData);
        throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✨ Workflow started:', data);
      const workflowId = data.workflow_id || data.job_id; // fallback if backend returns job_id
      if (!workflowId) {
        throw new Error('No workflow_id returned from server');
      }
      setJobId(workflowId);
      const initialStatus = data.status || 'pending';
      console.log('📝 Setting initial status after upload:', initialStatus);
      setStatus(initialStatus);
      
      // Give backend a moment to save job data before polling
      // This helps avoid race conditions with Cloud Run scaling
      setTimeout(() => {
        pollStatus(workflowId);
      }, 1000);
    } catch (err) {
      console.error('Upload error:', err);
      
      // Check if it's a CORS error
      if (err.message.includes('fetch') || err.name === 'TypeError') {
        setError('Unable to connect to server. This may be a CORS issue. Please check the console for details.');
      } else {
        setError(err.message || 'Failed to upload file. Please try again.');
      }
      setStatus(null);
    }
  };

  // Poll workflow status
  const pollStatus = async (id) => {
    console.log('Starting resilient polling for job:', id);
    let attempts = 0;
    let consecutive404s = 0;
    let intervalMs = 3000; // start at 3s
    const max404s = 8; // tolerate more 404s (cold starts & eventual consistency)
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      attempts++;
      console.log(`Poll attempt ${attempts} (interval=${intervalMs}ms)`);
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/workflow/status/${id}`,
          { mode: 'cors', credentials: 'omit', cache: 'no-store' },
          getToken
        );
        if (response.status === 404) {
          consecutive404s++;
          console.warn(`404 (job not yet visible) ${consecutive404s}/${max404s}`);
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
          console.log('📊 Status data:', data);
          const newStatus = data.status || data.state || 'processing';
          console.log('🔄 Status transition:', status, '→', newStatus);
          // Optional granular message from backend
          if (data.last_progress_message) {
            console.log('Progress message:', data.last_progress_message);
          }
          
          if (newStatus === 'completed' || newStatus === 'succeeded' || newStatus === 'success') {
            // Stop simulation but DON'T set to 100% yet - wait for download
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
            }
            if (progressTimeoutRef.current) {
              clearTimeout(progressTimeoutRef.current);
            }
            console.log('Workflow completed, downloading transcription output');
            sendNotification('GrooveSheet', { body: 'Your transcription is ready!' });
            stopped = true;
            // Download first, then batch all state updates together
            try {
              const { objectUrl, filename } = await downloadInstrumentFile(id);
              // Batch state updates - React will batch these together in one render
              setDownloadUrl(objectUrl);
              setDownloadFilename(filename);
              setStatus('completed');
              setProgress(100); // Only set to 100% after download completes
            } catch (err) {
              console.error('Download error:', err);
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
            console.log('🔥 Worker woke up! Restarting progress simulation.');
            simulateProgress();
            sendNotification('GrooveSheet', { body: 'Server is ready! Processing your audio now.' });
          }
          // Pause progress sim during cold start
          if (newStatus === 'started') {
            stopProgressSimulation();
            setProgress(0);
            requestNotificationPermission();
          }
          // Only update status (progress is handled by simulation)
          console.log('💾 Setting status to:', newStatus);
          setStatus(newStatus);
        }
      } catch (err) {
        console.error('Polling error:', err);
        if (err.name === 'TypeError') {
          // Network glitch; continue
          console.warn('Network issue, will retry');
        } else {
          setError(`Status error: ${err.message}`);
        }
      } finally {
        // Exponential backoff up to 20s once progress > 60 to reduce load
        if (!stopped) {
          if (progress >= 60 && intervalMs < 20000) intervalMs = Math.min(intervalMs * 2, 20000);
          setTimeout(poll, intervalMs);
        }
      }
    };
    poll();
  };

  // Download transcription for drums, separated track for other instruments
  const downloadInstrumentFile = async (id) => {
    // For drums: download transcription
    // For jazz_bass: download jazz_bass_transcription
    // For bass: download midi
    // For piano: download midi
    // For others: download separated instrument track
    // For transcription instruments, download the MusicXML output from the full pipeline
    let fileKey = selectedInstrument;
    if (['drums', 'jazz_bass', 'bass', 'piano'].includes(selectedInstrument)) {
      fileKey = 'musicxml';
    }
    const url = `${API_BASE_URL}/workflow/download/${id}/${fileKey}`;
    console.log('Fetching from:', url);
    const res = await authenticatedFetch(url, {}, getToken);
    console.log('Download response:', res.status, res.statusText);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('Download failed response:', txt);
      throw new Error(`Download failed ${res.status}: ${txt}`);
    }
    const blob = await res.blob();
    console.log('Blob received:', blob.size, 'bytes');
    // Try to get filename from Content-Disposition header
    const cd = res.headers.get('content-disposition') || '';
    const extension = ['drums', 'jazz_bass', 'bass', 'piano'].includes(selectedInstrument) ? '.musicxml' : '.wav';
    const suffix = selectedInstrument === 'drums' ? '_transcription' : selectedInstrument === 'bass' ? '_bass_transcription' : selectedInstrument === 'piano' ? '_piano_transcription' : `_${selectedInstrument}`;
    let filename = file?.name ? file.name.replace(/\.[^.]+$/, `${suffix}${extension}`) : `${selectedInstrument}_${id}${extension}`;
    const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    if (match) {
      filename = decodeURIComponent(match[1] || match[2]);
    }
    console.log('Download filename:', filename);
    
    // Store for manual download
    const objectUrl = URL.createObjectURL(blob);
    
    // Auto-download
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Return the data to set state in parent
    return { objectUrl, filename };
  };

  // Reset upload state
  const resetUpload = () => {
    // Stop any ongoing progress simulation
    stopProgressSimulation();
    
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setFile(null);
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);
    setDownloadFilename(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Manual download handler
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

  // Handle browse button click
  const handleBrowseClick = () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // Trigger login modal
      if (onLoginRequired) {
        onLoginRequired();
      }
      return;
    }

    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  // Get status message
  // eslint-disable-next-line no-unused-vars
  const getStatusMessage = () => {
    if (error) return error;
    
    switch (status) {
      case 'uploading':
        return `Uploading file... ${progress}%`;
      case 'pending':
        return 'Job queued...';
      case 'queued':
        return 'Job queued...';
      case 'running':
      case 'processing':
        return `Processing... ${progress}%`;
      case 'separating':
        return selectedInstrument === 'drums' 
          ? 'Separating drum track from audio...' 
          : 'Separating track from audio...';
      case 'transcribing':
        return selectedInstrument === 'bass'
          ? 'Extracting F0 contour from bass track...'
          : 'Transcribing to MIDI notation...';
      case 'generating_sheet':
        return 'Generating notation...';
      case 'completed':
      case 'succeeded':
      case 'success':
        return selectedInstrument === 'drums'
          ? '✓ Download started! Transcription complete.'
          : selectedInstrument === 'bass'
          ? '✓ Download started! Bass F0 extraction complete.'
          : '✓ Download started! Separation complete.';
      case 'failed':
        return selectedInstrument === 'drums'
          ? 'Transcription failed. Please try again.'
          : 'Processing failed. Please try again.';
      default:
        return '';
    }
  };

  // Render functions for each state
  const renderIdleState = () => (
    <>
      <div className="instrument-tabs">
        {[
          { value: 'vocals', label: 'Vocal', icon: LiaMicrophoneAltSolid },
          { value: 'drums', label: 'Drums', icon: LuDrum },
          { value: 'piano', label: 'Piano', icon: Piano },
          { value: 'jazz_bass', label: 'Guitar', icon: LuGuitar },
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

          <button 
            className="browse-files-btn" 
            onClick={handleBrowseClick}
          >
            Browse Files
          </button>
        </div>
      </div>
    </>
  );

  const renderUploadingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon">
          <TrayArrowUpIcon />
        </div>
        <div className="upload-text">
          <h3>Uploading...</h3>
        </div>
      </div>

      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div
            className="progress-bar-fill compact"
            style={{ width: `${Math.min(progress, 100)}%` }}
          >
            {progress >= 10 && <span className="progress-percentage compact">{Math.round(progress)}%</span>}
          </div>
          <div className="progress-bar-remaining compact" />
        </div>

        <button className="cancel-btn compact" onClick={resetUpload}>
          Cancel
        </button>
      </div>
    </>
  );

  const renderProcessingState = () => (
    <>
      <div className="upload-content-top compact">
        <div className="upload-icon">
          <MagicWandIcon />
        </div>
        <div className="upload-text">
          <h3>Transcribing...</h3>
        </div>
      </div>

      <div className="upload-controls compact">
        <div className="progress-bar-row">
          <div
            className="progress-bar-fill compact"
            style={{ width: `${Math.min(progress, 100)}%` }}
          >
            {progress >= 10 && <span className="progress-percentage compact">{Math.round(progress)}%</span>}
          </div>
          <div className="progress-bar-remaining compact" />
        </div>

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
          <h3 className="cold-start-message">Waking up our servers...</h3>
          <p className="cold-start-sub">We're in early access! This may take ~5-10 min. We'll notify you when ready.</p>
        </div>
      </div>

      <div className="upload-controls compact">
        <button className="cancel-btn compact" onClick={resetUpload}>
          Cancel
        </button>
      </div>
    </>
  );

  const renderSuccessState = () => (
    <>
      <button className="close-btn-corner" onClick={resetUpload} aria-label="Close">
        <CloseIcon />
      </button>

      <div className="upload-content-top compact">
        <div className="upload-icon">
          <CheckCircleIcon />
        </div>
        <div className="upload-text success-text">
          <h3>Transcription Succussed!</h3>
          <p className="filename-text">{file?.name || 'Uploaded_file_name.mp3'}</p>
        </div>
      </div>

      <div className="upload-controls success-controls compact">
        <button className="download-transcription-btn compact" onClick={handleManualDownload}>
          Download Transcription
        </button>
        <div className="download-options-row">
          <button className="download-option-btn" onClick={() => {}}>
            Stem
          </button>
          <button className="download-option-btn" onClick={() => {}}>
            MIDI
          </button>
        </div>
      </div>
    </>
  );

  return (
    <section className="hero">
      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Audio In. Music Notation Out.</h1>
            <p className="hero-subtitle">
              Upload an audio. Receive accurate, editable & printable music notation in minutes.
            </p>
          </div>
          <div className="hero-disclaimer hero-disclaimer-desktop">
            <span>By uploading a file, you agree to our </span>
            <a href="#terms">Terms of Service</a>
          </div>
        </div>
        <div 
          className={`upload-area state-${uiState} ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
          }}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.flac,.ogg,.au,.sph,audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/x-ogg,audio/basic,audio/x-au,audio/x-nist"
            onChange={(e) => handleFileChange(e.target.files[0])}
            style={{ display: 'none' }}
          />

          {/* Render based on UI state */}
          {uiState === 'idle' && renderIdleState()}
          {uiState === 'uploading' && renderUploadingState()}
          {uiState === 'cold_starting' && renderColdStartState()}
          {uiState === 'processing' && renderProcessingState()}
          {uiState === 'success' && renderSuccessState()}

          {/* Error message overlay */}
          {error && uiState !== 'success' && (
            <div className="error-overlay">
              <p className="error-message">{error}</p>
            </div>
          )}
        </div>
        <div className="hero-disclaimer hero-disclaimer-mobile">
          <span>By uploading a file, you agree to our </span>
          <a href="#terms">Terms of Service</a>
        </div>
      </div>
    </section>
  );
}

export default Hero;
