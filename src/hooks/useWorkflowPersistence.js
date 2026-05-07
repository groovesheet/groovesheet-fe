const STORAGE_KEY = 'groovesheet_active_workflow';
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function useWorkflowPersistence() {
  const persist = ({ jobId, status, progress, instrument, fileName }) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        jobId,
        status,
        progress,
        instrument,
        fileName,
        startedAt: existing.startedAt || Date.now(),
      }));
    } catch {
      // localStorage unavailable or full — silently skip
    }
  };

  const recover = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.jobId) return null;
      if (Date.now() - data.startedAt > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data;
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
