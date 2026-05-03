/**
 * Preview pipeline API helpers.
 *
 * Anonymous-friendly: previewFetch sends the bearer token *if available*,
 * but doesn't error if it's missing. ``credentials: 'include'`` round-trips
 * the ``gs_anon`` HttpOnly cookie that the backend mints/reads to identify
 * anonymous sessions.
 */

const PENDING_PREVIEW_ID_KEY = 'gs_pending_preview_id';

/**
 * Fetch helper for /preview/* endpoints. Works for signed-in users (sends the
 * bearer) and anonymous visitors (BE identifies them via the gs_anon cookie).
 */
export async function previewFetch(url, options = {}, getToken) {
  const headers = { ...(options.headers || {}) };

  // Best-effort token attach — but a missing token is *not* fatal here.
  try {
    if (getToken) {
      const token = await getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {
    // No session — proceed anonymously.
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * Pick the right fetch helper based on whether an ID is a preview (PRV*) or
 * a full workflow (WF*). Falls back to previewFetch for unprefixed IDs.
 *
 * authenticatedFetch is imported lazily so this module can be used by the
 * anonymous flow without pulling the strict-auth path in.
 */
export async function fetchForId(url, options, id, getToken) {
  if (id && !id.startsWith('PRV')) {
    const { authenticatedFetch } = await import('./api');
    return authenticatedFetch(url, options, getToken);
  }
  return previewFetch(url, options, getToken);
}

export async function startPreview(apiBaseUrl, workflowName, file, metadata, getToken) {
  const formData = new FormData();
  // Sanitize filename to ASCII-safe to keep multipart headers happy.
  const safeName = file.name.normalize('NFC').replace(/[^\x20-\x7E]/g, '_');
  const safeFile = safeName !== file.name ? new File([file], safeName, { type: file.type }) : file;
  formData.append('file', safeFile);
  if (metadata) formData.append('metadata', JSON.stringify(metadata));

  const res = await previewFetch(
    `${apiBaseUrl}/preview/${workflowName}`,
    { method: 'POST', body: formData },
    getToken
  );
  if (!res.ok) {
    let detail = res.statusText;
    let retryAfter = null;
    try {
      const err = await res.json();
      detail = err.detail || detail;
      retryAfter = err.retry_after_seconds || null;
    } catch (_) {}
    const e = new Error(detail);
    e.status = res.status;
    e.retryAfterSeconds = retryAfter;
    throw e;
  }
  return res.json();
}

export async function claimPreview(apiBaseUrl, previewId, getToken) {
  const res = await previewFetch(
    `${apiBaseUrl}/preview/${previewId}/claim`,
    { method: 'POST' },
    getToken
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.detail || `Claim failed: ${res.statusText}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

export async function upgradeToFull(apiBaseUrl, previewId, getToken) {
  const res = await previewFetch(
    `${apiBaseUrl}/preview/${previewId}/upgrade-to-full`,
    { method: 'POST' },
    getToken
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.detail || `Upgrade failed: ${res.statusText}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// --- Pending claim handoff (localStorage) -----------------------------------

export function setPendingPreviewId(previewId) {
  try {
    if (previewId) localStorage.setItem(PENDING_PREVIEW_ID_KEY, previewId);
  } catch (_) { /* localStorage disabled */ }
}

export function getPendingPreviewId() {
  try {
    return localStorage.getItem(PENDING_PREVIEW_ID_KEY);
  } catch (_) {
    return null;
  }
}

export function clearPendingPreviewId() {
  try {
    localStorage.removeItem(PENDING_PREVIEW_ID_KEY);
  } catch (_) {}
}

/**
 * Run the pending-claim flow if we have a preview_id stashed from a pre-signup
 * upload. Safe to call unconditionally on app load / after sign-in. Returns
 * the claimed preview info, or null if there was nothing pending.
 */
export async function claimPendingPreviewIfAny(apiBaseUrl, getToken) {
  const previewId = getPendingPreviewId();
  if (!previewId) return null;
  try {
    const result = await claimPreview(apiBaseUrl, previewId, getToken);
    clearPendingPreviewId();
    return result;
  } catch (err) {
    // Don't loop forever on a stale or unauthorized preview_id.
    if (err.status === 403 || err.status === 404 || err.status === 409) {
      clearPendingPreviewId();
    }
    throw err;
  }
}
