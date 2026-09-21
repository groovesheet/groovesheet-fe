'use client';

const STORAGE_KEY = 'groovesheet_active_workflow';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface PersistedWorkflow {
  jobId: string;
  status?: string;
  progress?: number;
  instrument?: string;
  fileName?: string;
  startedAt: number;
}

export function useWorkflowPersistence(): {
  persist: (state: Omit<PersistedWorkflow, 'startedAt'>) => void;
  recover: () => PersistedWorkflow | null;
  clear: () => void;
} {
  const persist = ({ jobId, status, progress, instrument, fileName }: Omit<PersistedWorkflow, 'startedAt'>) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<PersistedWorkflow>;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        jobId,
        status,
        progress,
        instrument,
        fileName,
        startedAt: existing.startedAt || Date.now(),
      }));
    } catch {
      // localStorage unavailable or full: silently skip
    }
  };

  const recover = (): PersistedWorkflow | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<PersistedWorkflow>;
      if (!data.jobId) return null;
      if (Date.now() - (data.startedAt || 0) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return { ...data, jobId: data.jobId, startedAt: data.startedAt || 0 };
    } catch {
      return null;
    }
  };

  const clear = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  return { persist, recover, clear };
}
