/**
 * /explore/:songId, one library track. Tier B: server-rendered with ISR, so the
 * title, artist, score info and related links are in the HTML for every
 * crawler (no user-agent rewrite needed), and the player hydrates on top.
 *
 * Nothing here reads cookies, headers, the session or searchParams: the page
 * is cached and identical for every visitor (brief 5.9). ?view= and
 * ?instrument= are read in the browser (see _components/UrlIntent).
 */
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getLibraryTrack, getLibraryTracks } from '@/lib/api-server';
import { pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { buildLocalePath } from '@/lib/locales';
import { hubPath, hubsForTrack } from '@/lib/seo/instrumentHubs';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import type { LibraryTrack } from '@/lib/types';
import JsonLd from '../_components/JsonLd';
import { slimTrack } from '../_components/trackToCard';
import SongDetail from './_components/SongDetail';
import TrackFacts from './_components/TrackFacts';
import {
  instrumentWord,
  isoDuration,
  songDescription,
  songSubject,
  songTitle,
  trackAssets,
  trackDurationSec,
  trackPath,
  type SongT,
} from './_components/songData';

export const revalidate = 300;
export const dynamicParams = true;

// Nothing is prerendered at build: /library/tracks is rate limited, and every
// song page is generated on its first request, then cached.
export function generateStaticParams(): { songId: string }[] {
  return [];
}

const RELATED_LIMIT = 24;

interface SongPageProps {
  params: Promise<{ locale: string; songId: string }>;
}

export async function generateMetadata({ params }: SongPageProps) {
  const { locale, songId } = await params;
  const t = await getTranslations({ locale, namespace: 'song' });
  const track = await getLibraryTrack(songId);
  if (!track) {
    return { title: t('meta.notFound'), robots: { index: false, follow: false } };
  }
  // A track whose processing produced nothing has no score, no stems and no
  // downloads: an empty page Google's guidance says to keep out of the index
  // until it carries something. It stays reachable, and the next successful
  // run makes it indexable again on the next revalidation.
  const noindex = trackAssets(track).length === 0;
  return pageMetadata({
    title: songTitle(t, track),
    description: songDescription(t, track),
    path: trackPath(track),
    locale,
    image: track.cover_url || null,
    ogType: 'music.song',
    noindex,
  });
}

function songJsonLd(t: SongT, track: LibraryTrack, locale: string): Record<string, unknown> {
  const url = `${SITE_URL}${buildLocalePath(locale, trackPath(track))}`;
  const assets = trackAssets(track);
  const encodings = [
    assets.some((a) => a.asset_type === 'musicxml') ? 'application/vnd.recordare.musicxml+xml' : null,
    assets.some((a) => a.asset_type === 'midi') ? 'audio/midi' : null,
  ].filter(Boolean);
  const artist = track.artist ? { '@type': 'MusicGroup', name: track.artist } : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicComposition',
    name: track.title,
    url,
    description: songDescription(t, track),
    inLanguage: locale,
    ...(track.cover_url ? { image: track.cover_url } : {}),
    ...(track.published_at ? { datePublished: track.published_at } : {}),
    ...(encodings.length ? { encodingFormat: encodings } : {}),
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    recordedAs: {
      '@type': 'MusicRecording',
      name: track.title,
      ...(artist ? { byArtist: artist } : {}),
      ...(track.album ? { inAlbum: { '@type': 'MusicAlbum', name: track.album } } : {}),
      ...(isoDuration(trackDurationSec(track)) ? { duration: isoDuration(trackDurationSec(track)) } : {}),
    },
  };
}

/**
 * Home > Explore > <instrument hub, when the track has one> > the track.
 * Naming the section is what turns the crumb trail Google shows from a URL
 * into something a reader can place.
 */
function trackCrumbs(t: SongT, track: LibraryTrack) {
  const assets = trackAssets(track);
  const partsOf = (types: string[]) =>
    [...new Set(assets.filter((a) => types.includes(a.asset_type || '')).map((a) => a.stem_name))].filter(
      (n): n is string => Boolean(n)
    );
  const [hub] = hubsForTrack({ notated: partsOf(['musicxml', 'midi']), stems: partsOf(['stem']) });
  return [
    { name: SITE_NAME, path: '/' },
    { name: t('meta.explore'), path: '/explore' },
    ...(hub ? [{ name: instrumentWord(t, hub.slug, 'name'), path: hubPath(hub) }] : []),
    { name: songSubject(t, track), path: trackPath(track) },
  ];
}

export default async function SongPage({ params }: SongPageProps) {
  const { locale, songId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'song' });

  // A 404 is "no such track"; any other API failure throws to error.tsx, so an
  // outage is never cached as a missing page.
  const track = await getLibraryTrack(songId);
  if (!track) notFound();

  // The rails are garnish: a failure hides them rather than failing the page.
  let related: LibraryTrack[] = [];
  try {
    const page = await getLibraryTracks({ limit: RELATED_LIMIT });
    related = (page.tracks || []).filter((t) => t.id !== track.id && t.id !== songId).map(slimTrack);
  } catch (err) {
    console.error('Song page: related tracks fetch failed', err);
  }

  return (
    <>
      <JsonLd data={songJsonLd(t, track, locale)} />
      <JsonLd data={breadcrumbJsonLd(locale, trackCrumbs(t, track))} />
      <SongDetail
        key={track.id}
        track={track}
        related={related}
        facts={<TrackFacts track={track} locale={locale} />}
      />
    </>
  );
}
