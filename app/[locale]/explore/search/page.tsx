/**
 * /explore/search, the paginated results page. The URL is the whole state
 * (see _components/resultsParams), so the server renders the exact page asked
 * for and later changes happen in the browser.
 *
 * Reading searchParams makes this route dynamic. That is fine: it never reads
 * cookies or the session, and the API response itself is cached for 5 minutes
 * per distinct query, so crawlers replaying a URL do not re-hit the
 * rate-limited search endpoint.
 */
import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { searchLibraryTracksServer } from '@/lib/api-server';
import { pageMetadata } from '@/lib/seo/metadata';
import SearchResults, { type InitialResults } from '../_components/SearchResults';
import {
  readerFromRecord,
  resultsTitle,
  singleFormatOf,
  resultsStateFromParams,
  searchRequestFor,
  searchRequestKey,
} from '../_components/resultsParams';
import { serverCard } from '../_components/trackToCard';

type SearchParams = Record<string, string | string[] | undefined>;

const NOINDEX_FOLLOW = { index: false, follow: true };

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
}

export async function generateMetadata({ params, searchParams }: SearchPageProps) {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  const state = resultsStateFromParams(readerFromRecord(raw));
  const singleFormat = singleFormatOf(state);
  const filtered = state.instruments.length > 0 || state.lengths.length > 0 || state.formats.length > 1;

  if (state.q) {
    return {
      ...pageMetadata({
        title: resultsTitle(state),
        description: `Transcriptions matching \u201c${state.q}\u201d: sheet music, MIDI, and isolated stems.`,
        path: '/explore/search',
        locale,
      }),
      // Internal search results are not landing pages; the song pages they
      // link to are what should rank, so crawlers still follow the links.
      robots: NOINDEX_FOLLOW,
    };
  }

  const metadata = pageMetadata({
    title: resultsTitle(state),
    description: 'Browse every AI transcription in the GrooveSheet library: sheet music, MIDI, and stems.',
    // A single-format browse is its own listing; everything else collapses
    // onto the unfiltered page.
    path: singleFormat ? `/explore/search?format=${singleFormat}` : '/explore/search',
    locale,
  });
  return filtered || state.page > 1 ? { ...metadata, robots: NOINDEX_FOLLOW } : metadata;
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const [{ locale }, raw] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const state = resultsStateFromParams(readerFromRecord(raw));
  const initial: InitialResults = { key: searchRequestKey(state), data: null, error: null };
  try {
    const body = await searchLibraryTracksServer(searchRequestFor(state));
    initial.data = {
      tracks: (body.tracks || []).map(serverCard),
      total: typeof body.total === 'number' ? body.total : null,
      pages: body.pages || 1,
      facets: body.facets || null,
    };
  } catch (err) {
    // A rate-limited or failing API must not fail the page: render the shell
    // with the error, and the Try again button refetches from the browser.
    console.error('Explore search: library fetch failed', err);
    initial.error = 'Failed to load results.';
  }

  return (
    <Suspense>
      <SearchResults initial={initial} />
    </Suspense>
  );
}
