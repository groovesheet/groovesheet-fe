// Remember the job an upload surface is tracking, per surface, so navigating
// away and back (or a reload) resumes polling instead of dropping the user on
// an empty upload box while their song is still in the queue.
//
// The job itself lives server-side; this only stores its id. Cleared when the
// job reaches a terminal state or the user cancels.

const key = (surface) => `gs_active_job:${surface}`;

export function saveActiveJob(surface, jobId, extra = {}) {
  try {
    if (!jobId) return;
    localStorage.setItem(key(surface), JSON.stringify({ jobId, savedAt: Date.now(), ...extra }));
  } catch (_) { /* storage disabled */ }
}

export function loadActiveJob(surface) {
  try {
    const raw = localStorage.getItem(key(surface));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.jobId) return null;
    // Anything older than a day is not worth resuming; the history page has it.
    if (Date.now() - (parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
      clearActiveJob(surface);
      return null;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

export function clearActiveJob(surface) {
  try { localStorage.removeItem(key(surface)); } catch (_) { /* storage disabled */ }
}
