/**
 * Server-only API access for Server Components, generateMetadata and route
 * handlers.
 *
 * Rules, because these responses end up in ISR pages served to everyone:
 *  - never forward a user's token or cookies (brief 5.9); these are the
 *    anonymous views of public data
 *  - always cache (`next.revalidate`), so a page render is not an API call
 *  - never enumerate the catalog at build time: /library/tracks is rate
 *    limited to 60/min per IP. Tier B pages return [] from
 *    generateStaticParams and render on first request (ISR on demand)
 *
 * api.groovesheet.net sits behind Cloudflare, so requests carry a browser-like
 * User-Agent; a bare Node UA is the kind of traffic its bot rules challenge.
 */
import 'server-only';
import { mapCreatorResponse, normalizeHandle, type CreatorResponse } from '@/lib/creatorApi';
import { searchLibraryQuery, type SearchLibraryParams } from '@/lib/libraryApi';
import type { BillingCatalog, CreatorProfile, LibraryTrack, LibraryTracksPage } from '@/lib/types';

export const API_ORIGIN = (process.env.API_ORIGIN || 'https://api.groovesheet.net').replace(/\/+$/, '');

const SERVER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Safari/537.36 GrooveSheetWeb/1.0';

/** Default ISR window for public library data, in seconds. */
export const DEFAULT_REVALIDATE = 300;

export class ServerApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ServerApiError';
    this.status = status;
  }
}

export interface ServerFetchOptions {
  /** Seconds before the cached response is revalidated. Default 300. */
  revalidate?: number | false;
  /** Cache tags, for revalidateTag() from a route handler. */
  tags?: string[];
}

/**
 * GET a JSON document from the API origin. Returns null on 404 so pages can
 * call notFound(); throws ServerApiError on any other failure so a transient
 * outage is not cached as "not found".
 */
export async function serverFetchJson<T>(path: string, { revalidate = DEFAULT_REVALIDATE, tags }: ServerFetchOptions = {}): Promise<T | null> {
  const url = `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': SERVER_USER_AGENT,
    },
    next: { revalidate, ...(tags ? { tags } : {}) },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ServerApiError(`GET ${path} failed: ${response.status} ${response.statusText}`, response.status);
  }
  return (await response.json()) as T;
}

/** One public library track by id (or slug, if the API accepts it). Null when it does not exist. */
export async function getLibraryTrack(id: string, options?: ServerFetchOptions): Promise<LibraryTrack | null> {
  return serverFetchJson<LibraryTrack>(`/library/tracks/${encodeURIComponent(id)}`, {
    tags: [`track:${id}`],
    ...options,
  });
}

/** A cursor page of the public library, as the Explore hub shows it. */
export async function getLibraryTracks(
  { q = '', cursor = null, limit = null }: { q?: string; cursor?: string | null; limit?: number | null } = {},
  options?: ServerFetchOptions
): Promise<LibraryTracksPage> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  const page = await serverFetchJson<LibraryTracksPage>(`/library/tracks${qs ? `?${qs}` : ''}`, {
    tags: ['library'],
    ...options,
  });
  return page ?? { tracks: [], next_cursor: null };
}

/** An offset page of search results, as /explore/search shows it. */
export async function searchLibraryTracksServer(params: SearchLibraryParams = {}, options?: ServerFetchOptions): Promise<LibraryTracksPage> {
  const page = await serverFetchJson<LibraryTracksPage>(`/library/tracks?${searchLibraryQuery(params)}`, {
    tags: ['library'],
    ...options,
  });
  return page ?? { tracks: [], total: 0, page: params.page ?? 1, pages: 1 };
}

/**
 * The anonymous view of a creator profile: public songs only, is_owner and
 * is_following always false. Null when the creator does not exist.
 */
export async function getCreatorProfile(username: string, options?: ServerFetchOptions): Promise<CreatorProfile | null> {
  const handle = normalizeHandle(username);
  if (!handle || handle === 'unknown') return null;
  const data = await serverFetchJson<CreatorResponse>(`/creators/${encodeURIComponent(handle)}`, {
    tags: [`creator:${handle}`],
    ...options,
  });
  return data ? mapCreatorResponse(data) : null;
}

/**
 * The billing catalog as priced for the server's own location (USD). Only for
 * static copy such as metadata; visible prices must come from
 * useBillingCatalog() in the browser, because the currency follows the visitor.
 */
export async function getBillingPlans(options?: ServerFetchOptions): Promise<BillingCatalog | null> {
  return serverFetchJson<BillingCatalog>('/billing/plans', { revalidate: 3600, ...options });
}
