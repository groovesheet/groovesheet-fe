'use client';

import { useCallback, useEffect, useRef, type MouseEvent } from 'react';
import confetti from 'canvas-confetti';
import type { Workflow, WorkflowOutputs, WorkflowQueue } from '@/lib/types';

// Pieces the three upload cards (home, stem splitter, MIDI converter) had as
// identical copies in the CRA app. The upload and polling flows themselves
// stay in each card, because each one handles its own outputs.

/** The file input's accept list, the same on all three cards. */
export const UPLOAD_ACCEPT =
  '.mp3,.wav,.flac,.ogg,.m4a,.aac,.mp4,.au,.sph,audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/ogg,audio/x-ogg,audio/basic,audio/x-au,audio/x-nist,audio/mp4,audio/x-m4a,audio/aac,video/mp4';

export const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.au', '.sph'];

export function makeFileTypeCheck(mimeTypes: readonly string[]): (file: File) => boolean {
  return (selectedFile) => {
    const mime = (selectedFile.type || '').toLowerCase();
    if (mime && mimeTypes.includes(mime)) return true;
    const name = (selectedFile.name || '').toLowerCase();
    return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
  };
}

/** /workflow/status and /preview/status payloads. */
export type StatusPayload = Workflow & { state?: string; message?: string; last_progress_message?: string };

/** What POST /workflow/:name and POST /preview/:name return. */
export interface StartPayload {
  workflow_id?: string;
  preview_id?: string;
  job_id?: string;
  status?: string;
  cached?: boolean;
  selection?: unknown;
  outputs?: WorkflowOutputs;
  [key: string]: unknown;
}

export type UploadUiState = 'idle' | 'uploading' | 'queued' | 'cold_starting' | 'processing' | 'success';

const PROCESSING_STATUSES = new Set([
  'pending',
  'running',
  'processing',
  'separating',
  'transcribing',
  'generating_sheet',
  'worker_processing',
]);

export const isCompletedStatus = (status: string | null | undefined): boolean =>
  status === 'completed' || status === 'succeeded' || status === 'success';

export const isFailedStatus = (status: string | null | undefined): boolean =>
  status === 'failed' || status === 'error';

/**
 * Which screen the card shows. "started" means published and waiting behind
 * other jobs: a queue, never a server booting. With a reported position it is
 * the queue screen whatever step the job is on.
 */
export function uiStateFor(status: string | null, queue: WorkflowQueue | null): UploadUiState {
  if (status === 'uploading') return 'uploading';
  if (queue?.state === 'queued') return 'queued';
  if (status === 'started') return 'cold_starting';
  if (status && PROCESSING_STATUSES.has(status)) return 'processing';
  if (isCompletedStatus(status)) return 'success';
  return 'idle';
}

export interface ErrorInfo {
  message: string;
  name: string;
  status?: number;
  retryAfterSeconds?: number | null;
}

/** The fields the cards branch on, read off whatever was thrown. */
export function errorInfo(err: unknown): ErrorInfo {
  if (err instanceof Error) {
    const extra = err as Error & { status?: unknown; retryAfterSeconds?: unknown };
    return {
      message: err.message,
      name: err.name,
      status: typeof extra.status === 'number' ? extra.status : undefined,
      retryAfterSeconds: typeof extra.retryAfterSeconds === 'number' ? extra.retryAfterSeconds : null,
    };
  }
  return { message: String(err), name: 'Error' };
}

/** An Error carrying the HTTP status, for the 402 branch. */
export function statusError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/** Save a URL (usually an object URL) through a temporary anchor. */
export function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** The server's filename from Content-Disposition, else the fallback. */
export function filenameFromResponse(res: Response, fallback: string): string {
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  if (match) return decodeURIComponent(match[1] || match[2]);
  return fallback;
}

export async function readDetail(response: Response): Promise<string | undefined> {
  const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
  return typeof body.detail === 'string' && body.detail ? body.detail : undefined;
}

/**
 * The fake progress bar: 11% to 99% over about a minute in uneven steps, held
 * at 99% until the real result arrives. Timers are cleared on unmount.
 */
export function useProgressSimulation(setProgress: (value: number) => void): {
  simulateProgress: () => void;
  stopProgressSimulation: () => void;
} {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopProgressSimulation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const simulateProgress = useCallback(() => {
    stopProgressSimulation();

    const numSteps = 20;
    const totalDuration = 60000;
    const startProgress = 11;
    const endProgress = 99;
    const totalProgressRange = endProgress - startProgress;

    const intervals: number[] = [];
    for (let i = 0; i < numSteps; i++) intervals.push(Math.random() * 2000 + 500);
    const sum = intervals.reduce((a, b) => a + b, 0);
    const normalizedIntervals = intervals.map((interval) => (interval / sum) * totalDuration);

    const progressIncrements: number[] = [];
    for (let i = 0; i < numSteps; i++) progressIncrements.push(Math.random());
    const progressSum = progressIncrements.reduce((a, b) => a + b, 0);
    const normalizedIncrements = progressIncrements.map((inc) => (inc / progressSum) * totalProgressRange);

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
        timeoutRef.current = setTimeout(executeStep, normalizedIntervals[currentStep]);
      }
    };

    setProgress(startProgress);
    timeoutRef.current = setTimeout(executeStep, normalizedIntervals[0]);
  }, [setProgress, stopProgressSimulation]);

  useEffect(() => stopProgressSimulation, [stopProgressSimulation]);

  return { simulateProgress, stopProgressSimulation };
}

/** Three seconds of confetti from both sides once a finished file has landed. */
export function useCompletionConfetti(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    return () => clearInterval(interval);
  }, [active]);
}

/** Mouse position on the card, for its radial highlight. */
export function trackPointer(e: MouseEvent<HTMLDivElement>): void {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
}
