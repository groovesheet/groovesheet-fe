/**
 * Public library API helpers (Explore page).
 *
 * These endpoints are public — no auth header needed. All requests use
 * relative `/api/...` paths so the CRA dev proxy (src/setupProxy.js) and the
 * Vercel rewrite both resolve the backend base URL.
 *
 * Dev fallback: when the backend is unreachable (network error) or returns a
 * 5xx in development, `fetchLibraryTracks` falls back to a local fixture
 * (src/mocks/libraryFixture.json). Fixture responses are clearly flagged with
 * `_fixture: true` and a console warning so they are never mistaken for real
 * data.
 */

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Error class for library API failures. Mirrors the style of errors thrown in
 * api.js / previewApi.js: carries the HTTP status and backend `detail`.
 */
export class LibraryApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'LibraryApiError';
    this.status = status;
  }
}

async function parseErrorDetail(response) {
  let detail = response.statusText || `Request failed (${response.status})`;
  try {
    const data = await response.clone().json();
    detail = data.detail || data.message || detail;
  } catch (_) {
    // Non-JSON error body — keep the status text.
  }
  return detail;
}

async function loadFixture(reason) {
  // Lazy import keeps the ~60kB fixture out of the bundle's hot path.
  const fixture = await import('../mocks/libraryFixture.json');
  console.warn(
    `[libraryApi] DEV FIXTURE FALLBACK — serving src/mocks/libraryFixture.json (${reason}). ` +
      'This is fake data; the real /api/library backend was unavailable.'
  );
  return { ...(fixture.default || fixture), _fixture: true };
}

function fixtureFilter(data, q) {
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

/**
 * Fetch a page of public library tracks.
 *
 * @param {Object} params
 * @param {string} [params.q] - Server-side search query.
 * @param {string} [params.cursor] - Pagination cursor from `next_cursor`.
 * @param {number} [params.limit] - Page size.
 * @returns {Promise<{tracks: Array, next_cursor: string|null}>}
 * @throws {LibraryApiError} on non-OK responses (prod, or 4xx in dev).
 */
export async function fetchLibraryTracks({ q = '', cursor = null, limit = null } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const url = `/api/library/tracks${qs ? `?${qs}` : ''}`;

  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    // Network-level failure (backend down, proxy not running).
    if (IS_DEV) return fixtureFilter(await loadFixture(`network error: ${err.message}`), q);
    throw new LibraryApiError('Could not reach the library. Check your connection.', 0);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    if (IS_DEV && response.status >= 500) {
      return fixtureFilter(await loadFixture(`HTTP ${response.status}: ${detail}`), q);
    }
    throw new LibraryApiError(detail, response.status);
  }

  return response.json();
}

/**
 * Fetch a single public library track by id.
 *
 * @param {string} id - Track UUID.
 * @returns {Promise<Object>} The track record.
 * @throws {LibraryApiError} on non-OK responses.
 */
export async function fetchLibraryTrack(id) {
  let response;
  try {
    response = await fetch(`/api/library/tracks/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (IS_DEV) {
      const fixture = await loadFixture(`network error: ${err.message}`);
      const track = (fixture.tracks || []).find((t) => t.id === id);
      if (track) return { ...track, _fixture: true };
    }
    throw new LibraryApiError('Could not reach the library. Check your connection.', 0);
  }

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new LibraryApiError(detail, response.status);
  }

  return response.json();
}
