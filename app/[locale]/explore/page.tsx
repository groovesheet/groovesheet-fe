/**
 * /explore, the library hub. The first page of the catalog is fetched on the
 * server (anonymous, cached) so the rails and their links are in the HTML;
 * searching and filtering then happen in the browser as before.
 *
 * Nothing here reads cookies, headers or the session: the page is ISR-cached
 * and served to everyone (brief 5.9).
 */
import { setRequestLocale } from 'next-intl/server';
import { getLibraryTracks } from '@/lib/api-server';
import { pageMetadata, SITE_URL } from '@/lib/seo/metadata';
import { buildLocalePath } from '@/lib/locales';
import ExploreHub from './_components/ExploreHub';
import JsonLd from './_components/JsonLd';
import { serverCard, type SongCardModel } from './_components/trackToCard';

export const revalidate = 300;

const PAGE_LIMIT = 60;

interface ExplorePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ExplorePageProps) {
  const { locale } = await params;
  return pageMetadata({
    title: 'Explore Free Sheet Music, MIDI and Stems',
    description:
      'Browse AI transcriptions from the GrooveSheet library: sheet music, MIDI files, and isolated stems for drums, piano, bass and more.',
    path: '/explore',
    locale,
  });
}

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  let tracks: SongCardModel[] = [];
  let nextCursor: string | null = null;
  let error: string | null = null;
  try {
    const page = await getLibraryTracks({ limit: PAGE_LIMIT });
    tracks = (page.tracks || []).map(serverCard);
    nextCursor = page.next_cursor || null;
  } catch (err) {
    // Render the shell and let the browser retry, rather than failing the
    // page. The next revalidation replaces this render once the API is back.
    console.error('Explore: library fetch failed', err);
    error = 'Failed to load the library.';
  }

  const pageUrl = `${SITE_URL}${buildLocalePath(locale, '/explore')}`;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Explore the GrooveSheet library',
          url: pageUrl,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: tracks.slice(0, 30).map((t, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}${buildLocalePath(locale, `/explore/${encodeURIComponent(t.id)}`)}`,
              name: t.artist ? `${t.title} by ${t.artist}` : t.title,
            })),
          },
        }}
      />
      <ExploreHub initialTracks={tracks} initialNextCursor={nextCursor} initialError={error} />
    </>
  );
}
