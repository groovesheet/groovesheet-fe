/**
 * Preview pipeline API helpers.
 *
 * Anonymous-friendly: previewFetch sends the bearer token *if available*,
 * but doesn't error if it's missing. `credentials: 'include'` round-trips
 * the `gs_anon` HttpOnly cookie that the backend mints/reads to identify
 * anonymous sessions.
 */
import type { GetToken, HttpError, JsonObject } from '@/lib/types';

const PENDING_PREVIEW_ID_KEY = 'gs_pending_preview_id';

function httpError(message: string, status: number, retryAfterSeconds: number | null = null): HttpError {
  const e: HttpError = new Error(message);
  e.status = status;
  e.retryAfterSeconds = retryAfterSeconds;
  return e;
}

/**
 * Fetch helper for /preview/* endpoints. Works for signed-in users (sends the
 * bearer) and anonymous visitors (BE identifies them via the gs_anon cookie).
 */
export async function previewFetch(url: string, options: RequestInit = {}, getToken?: GetToken | null): Promise<Response> {
  const headers = new Headers(options.headers);

  // Best-effort token attach, but a missing token is *not* fatal here.
  try {
    if (getToken) {
      const token = await getToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
  } catch {
    // No session: proceed anonymously.
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
export async function fetchForId(url: string, options: RequestInit, id: string | null | undefined, getToken: GetToken): Promise<Response> {
  if (id && !id.startsWith('PRV')) {
    const { authenticatedFetch } = await import('@/lib/api');
    return authenticatedFetch(url, options, getToken);
  }
  return previewFetch(url, options, getToken);
}

export async function startPreview<T = JsonObject>(
  apiBaseUrl: string,
  workflowName: string,
  file: File,
  metadata: JsonObject | null | undefined,
  getToken?: GetToken | null
): Promise<T> {
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
    let retryAfter: number | null = null;
    try {
      const err = (await res.json()) as { detail?: unknown; retry_after_seconds?: unknown };
      if (typeof err.detail === 'string' && err.detail) detail = err.detail;
      if (typeof err.retry_after_seconds === 'number') retryAfter = err.retry_after_seconds;
    } catch {
      /* non-JSON error body */
    }
    throw httpError(detail, res.status, retryAfter);
  }
  return res.json() as Promise<T>;
}

async function detailOf(res: Response): Promise<string | undefined> {
  const err = (await res.json().catch(() => ({}))) as { detail?: unknown };
  return typeof err.detail === 'string' ? err.detail : undefined;
}

export async function claimPreview<T = JsonObject>(apiBaseUrl: string, previewId: string, getToken?: GetToken | null): Promise<T> {
  const res = await previewFetch(
    `${apiBaseUrl}/preview/${previewId}/claim`,
    { method: 'POST' },
    getToken
  );
  if (!res.ok) {
    throw httpError((await detailOf(res)) || `Claim failed: ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

export async function upgradeToFull<T = JsonObject>(apiBaseUrl: string, previewId: string, getToken?: GetToken | null): Promise<T> {
  const res = await previewFetch(
    `${apiBaseUrl}/preview/${previewId}/upgrade-to-full`,
    { method: 'POST' },
    getToken
  );
  if (!res.ok) {
    throw httpError((await detailOf(res)) || `Upgrade failed: ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

// --- Pending claim handoff (localStorage) -----------------------------------

export function setPendingPreviewId(previewId: string | null | undefined): void {
  try {
    if (previewId) localStorage.setItem(PENDING_PREVIEW_ID_KEY, previewId);
  } catch { /* localStorage disabled */ }
}

export function getPendingPreviewId(): string | null {
  try {
    return localStorage.getItem(PENDING_PREVIEW_ID_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPreviewId(): void {
  try {
    localStorage.removeItem(PENDING_PREVIEW_ID_KEY);
  } catch { /* localStorage disabled */ }
}

/**
 * Run the pending-claim flow if we have a preview_id stashed from a pre-signup
 * upload. Safe to call unconditionally on app load / after sign-in. Returns
 * the claimed preview info, or null if there was nothing pending.
 */
export async function claimPendingPreviewIfAny<T = JsonObject>(apiBaseUrl: string, getToken: GetToken): Promise<T | null> {
  const previewId = getPendingPreviewId();
  if (!previewId) return null;
  try {
    const result = await claimPreview<T>(apiBaseUrl, previewId, getToken);
    clearPendingPreviewId();
    return result;
  } catch (err) {
    // Don't loop forever on a stale or unauthorized preview_id.
    const status = (err as HttpError).status;
    if (status === 403 || status === 404 || status === 409) {
      clearPendingPreviewId();
    }
    throw err;
  }
}
