/**
 * Public library API helpers (Explore page), browser side.
 *
 * These endpoints are public: no auth header needed. All requests use
 * relative `/api/...` paths, which next.config.ts rewrites in dev and
 * vercel.json rewrites in production. Server Components use the cached
 * equivalents in lib/api-server.ts instead.
 *
 * Dev fallback: when the backend is unreachable (network error) or returns a
 * 5xx in development, the fetchers fall back to a local fixture
 * (lib/fixtures/libraryFixture.json). Fixture responses are clearly flagged
 * with `_fixture: true` and a console warning so they are never mistaken for
 * real data.
 */
import type { GetToken, LibraryTrack, LibraryTracksPage, JsonObject } from '@/lib/types';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Error class for library API failures. Mirrors the style of errors thrown in
 * api.ts / previewApi.ts: carries the HTTP status and backend `detail`.
 */
export class LibraryApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'LibraryApiError';
    this.status = status;
  }
}

/** Turn a non-OK response into a readable message, FastAPI validation errors included. */
export async function parseErrorDetail(response: Response): Promise<string> {
  let detail = response.statusText || `Request failed (${response.status})`;
  try {
    const data = (await response.clone().json()) as { detail?: unknown; message?: unknown };
    const raw = data.detail || data.message;
    if (typeof raw === 'string') {
      detail = raw;
    } else if (Array.isArray(raw)) {
      // FastAPI validation errors: [{loc, msg, type}, ...]; surface the
      // messages, not "[object Object]".
      detail =
        raw
          .map((e: unknown) =>
            e && typeof e === 'object' && 'msg' in e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)
          )
          .join('; ') || detail;
    } else if (raw) {
      detail = JSON.stringify(raw);
    }
  } catch {
    // Non-JSON error body: keep the status text.
  }
  return detail;
}

async function loadFixture(reason: string): Promise<LibraryTracksPage> {
  // Lazy import keeps the ~60kB fixture out of the bundle's hot path.
  const fixture = (await import('@/lib/fixtures/libraryFixture.json')).default as unknown as LibraryTracksPage;
  console.warn(
    `[libraryApi] DEV FIXTURE FALLBACK: serving lib/fixtures/libraryFixture.json (${reason}). ` +
      'This is fake data; the real /api/library backend was unavailable.'
  );
  return { ...fixture, _fixture: true };
}

/** Offset-page a fixture response so the dev fallback matches the paged API. */
function fixturePage(data: LibraryTracksPage, { q, page = 1, limit = 24 }: { q?: string; page?: number; limit?: number | null }): LibraryTracksPage {
  const filtered = fixtureFilter(data, q);
  const size = limit || 24;
  const total = filtered.tracks.length;
  return {
    ...filtered,
    tracks: filtered.tracks.slice((page - 1) * size, page * size),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / size)),
    limit: size,
    next_cursor: null,
  };
}

function fixtureFilter(data: LibraryTracksPage, q?: string): LibraryTracksPage {
  if (!q) return data;
  const needle = q.trim().toLowerCase();
  if (!needle) return data;
  return {
    ...data,
    tracks: data.tracks.filter(
      (t) =>
        (t.title || '').toLowerCase().includes(needle) ||
        (t.artist || '').toLowerCase().includes(needle) ||
        (t.album || '').toLowerCase().includes(needle)
    ),
  };
}

export interface LibraryTracksParams {
  q?: string;
  cursor?: string | null;
  limit?: number | null;
}

/**
 * Fetch a page of public library tracks.
 * @throws {LibraryApiError} on non-OK responses (prod, or 4xx in dev).
 */
export async function fetchLibraryTracks({ q = '', cursor = null, limit = null }: LibraryTracksParams = {}): Promise<LibraryTracksPage> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const url = `/api/library/tracks${qs ? `?${qs}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    // Network-level failure (backend down, dev rewrite target unreachable).
    if (IS_DEV) return fixtureFilter(await loadFixture(`network error: ${(err as Error).message}`), q);
    throw new LibraryApiError('Could not reach the library. Check your connection.', 0);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    if (IS_DEV && response.status >= 500) {
      return fixtureFilter(await loadFixture(`HTTP ${response.status}: ${detail}`), q);
    }
    throw new LibraryApiError(detail, response.status);
  }

  return response.json() as Promise<LibraryTracksPage>;
}

export interface SearchLibraryParams {
  q?: string;
  /** relevance|popular|newest|plays|downloads|title */
  sort?: string | null;
  /** Param values: sheet|midi|stems */
  formats?: string[];
  /** Lowercase stem names. */
  instruments?: string[];
  /**
   * Keep only tracks that carry notation (MusicXML/MIDI) for this part, e.g.
   * 'drums'. The instrument filter alone matches a separated stem, which is a
   * superset: a track can have a bass stem and only drum notation. An API
   * that predates this parameter ignores it and answers the instrument filter,
   * so sending it is safe before the backend ships.
   */
  notation?: string | null;
  /** under2|2to5|over5 */
  lengths?: string[];
  /** 1-based page number. */
  page?: number;
  /** Page size (max 60). */
  limit?: number | null;
  /** Ask for sidebar facet counts. */
  facets?: boolean;
}

/** Build the /library/tracks query string for offset (page=) mode. Shared with lib/api-server. */
export function searchLibraryQuery({
  q = '',
  sort = null,
  formats = [],
  instruments = [],
  lengths = [],
  notation = null,
  page = 1,
  limit = null,
  facets = false,
}: SearchLibraryParams = {}): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort) params.set('sort', sort);
  if (formats.length) params.set('format', formats.join(','));
  if (instruments.length) params.set('instrument', instruments.join(','));
  if (notation) params.set('notation', notation);
  if (lengths.length) params.set('length', lengths.join(','));
  params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  if (facets) params.set('facets', 'true');
  return params.toString();
}

/**
 * Fetch one page of results for the /explore/search page.
 *
 * Uses the API's offset mode (`page=`), which, unlike the hub's cursor mode,
 * returns `total`/`pages` and is stable under any sort, so numbered pagination
 * and a real result count are possible. Filtering and sorting happen
 * server-side: the hub's client-side filtering only ever saw the first page,
 * so a facet there silently hid matching tracks further down the catalog.
 *
 * @throws {LibraryApiError} on non-OK responses (prod, or 4xx in dev).
 */
export async function searchLibraryTracks(params: SearchLibraryParams = {}): Promise<LibraryTracksPage> {
  const { q = '', page = 1, limit = null } = params;

  let response: Response;
  try {
    response = await fetch(`/api/library/tracks?${searchLibraryQuery(params)}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (IS_DEV) {
      // The fixture has no server-side filtering; page it locally so the
      // results page is still developable with the backend down.
      return fixturePage(await loadFixture(`network error: ${(err as Error).message}`), { q, page, limit });
    }
    throw new LibraryApiError('Could not reach the library. Check your connection.', 0);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    if (IS_DEV && response.status >= 500) {
      return fixturePage(await loadFixture(`HTTP ${response.status}: ${detail}`), { q, page, limit });
    }
    throw new LibraryApiError(detail, response.status);
  }

  return response.json() as Promise<LibraryTracksPage>;
}

/**
 * Fetch a single public library track by id.
 * @throws {LibraryApiError} on non-OK responses.
 */
export async function fetchLibraryTrack(id: string): Promise<LibraryTrack> {
  let response: Response;
  try {
    response = await fetch(`/api/library/tracks/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (IS_DEV) {
      const fixture = await loadFixture(`network error: ${(err as Error).message}`);
      const track = (fixture.tracks || []).find((t) => t.id === id);
      if (track) return { ...track, _fixture: true };
    }
    throw new LibraryApiError('Could not reach the library. Check your connection.', 0);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new LibraryApiError(detail, response.status);
  }

  return response.json() as Promise<LibraryTrack>;
}

/**
 * Record a play event for a track (anonymous-capable, deduped server-side).
 * Fire-and-forget: engagement tracking must never break playback.
 */
export function postTrackPlay(id: string): void {
  try {
    fetch(`/api/library/tracks/${encodeURIComponent(id)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'play' }),
    }).catch(() => {});
  } catch {
    /* never throw from analytics */
  }
}

/**
 * Download every asset of a track as one ZIP. Requires sign-in.
 * @throws {LibraryApiError} on non-OK responses.
 */
export async function downloadLibraryTrackZip(id: string, getToken: GetToken): Promise<{ blob: Blob; filename: string }> {
  const token = await getToken();
  if (!token) throw new LibraryApiError('Sign in to download', 401);
  const response = await fetch(`/api/library/tracks/${encodeURIComponent(id)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new LibraryApiError(detail, response.status);
  }
  const blob = await response.blob();
  const cd = response.headers.get('content-disposition') || '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  return { blob, filename: match ? match[1] : `${id}.zip` };
}

export interface TrackReport {
  reason: string;
  details?: string;
  contact?: string;
}

/**
 * Report a published track (copyright / abuse). Anonymous-capable.
 */
export async function reportTrack<T = JsonObject>(id: string, payload: TrackReport): Promise<T> {
  const response = await fetch(`/api/library/tracks/${encodeURIComponent(id)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new LibraryApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}
