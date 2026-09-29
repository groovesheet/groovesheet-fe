/**
 * /explore, the library hub. The first page of the catalog is fetched on the
 * server (anonymous, cached) so the rails and their links are in the HTML;
 * searching and filtering then happen in the browser as before.
 *
 * Nothing here reads cookies, headers or the session: the page is ISR-cached
 * and served to everyone (brief 5.9).
 */
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
  const t = await getTranslations({ locale, namespace: 'explore.meta' });
  return pageMetadata({
    title: t('title'),
    description: t('description'),
    path: '/explore',
    locale,
  });
}

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'explore' });
  const tSong = await getTranslations({ locale, namespace: 'song' });

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
    error = t('loadError');
  }

  const pageUrl = `${SITE_URL}${buildLocalePath(locale, '/explore')}`;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: t('meta.collectionName'),
          url: pageUrl,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: tracks.slice(0, 30).map((track, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: `${SITE_URL}${buildLocalePath(locale, `/explore/${encodeURIComponent(track.id)}`)}`,
              name: track.artist
                ? tSong('meta.subject', { title: track.title, artist: track.artist })
                : tSong('meta.subjectNoArtist', { title: track.title }),
            })),
          },
        }}
      />
      <ExploreHub initialTracks={tracks} initialNextCursor={nextCursor} initialError={error} />
    </>
  );
}
