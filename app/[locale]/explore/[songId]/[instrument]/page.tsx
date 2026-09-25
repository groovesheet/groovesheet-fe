/**
 * /explore/:songId/:instrument — one page per part GrooveSheet transcribed.
 *
 * Why this exists rather than one page per song: the phrase people search is
 * "{song} drum sheet music", and one title cannot carry drums, piano and bass
 * at once. Splitting gives each its own title, heading, description and share
 * card, and the catalog currently supports 250 piano, 242 drum and 181 bass
 * pages where there were 296 generic ones.
 *
 * Two rules keep that on the right side of Google's scaled-content guidance,
 * which targets pages made in bulk that carry no value:
 *
 *  1. A page exists only where the score does. `hasScoreFor` is checked before
 *     anything renders, and /piano on a drums-only track is a 404, not an empty
 *     page. It asks for MusicXML specifically, not any notation: a part with
 *     MIDI alone has a disabled "Sheet music" tab, so a page titled "… Sheet
 *     Music" would be promising something the player cannot show.
 *     `dynamicParams` is on and nothing is prebuilt, so the check runs against
 *     the live record every time.
 *  2. Each page has to differ in more than its title. The score, the
 *     visualizer and the downloads already differ by part; on top of that the
 *     heading names the instrument, and TrackFacts is passed the instrument so
 *     its prose and its links are about that part rather than the track.
 *
 * The parent /explore/:songId keeps its own canonical and stays the page for
 * the song as a whole. These are siblings of it, not replacements.
 */
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getLibraryTrack, getLibraryTracks } from '@/lib/api-server';
import { pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { hubPath, hubsOfKind } from '@/lib/seo/instrumentHubs';
import { buildLocalePath } from '@/lib/locales';
import type { LibraryTrack } from '@/lib/types';
import JsonLd from '../../_components/JsonLd';
import { slimTrack } from '../../_components/trackToCard';
import SongDetail from '../_components/SongDetail';
import TrackFacts from '../_components/TrackFacts';
import {
  hasScoreFor,
  instrumentAdjective,
  isoDuration,
  songInstrumentDescription,
  songInstrumentHeading,
  songInstrumentPath,
  songInstrumentTitle,
  trackDurationSec,
} from '../_components/songData';

export const revalidate = 300;
export const dynamicParams = true;

const RELATED_LIMIT = 24;

/** Nothing is prebuilt: which pages exist depends on the live record. */
export function generateStaticParams(): { instrument: string }[] {
  return [];
}

interface PageProps {
  params: Promise<{ locale: string; songId: string; instrument: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale, songId, instrument } = await params;
  const part = instrument.toLowerCase();
  const track = await getLibraryTrack(songId);
  if (!track || !hasScoreFor(track, part)) {
    return { title: 'Not found', robots: { index: false, follow: false } };
  }
  return pageMetadata({
    title: songInstrumentTitle(track, part),
    description: songInstrumentDescription(track, part),
    path: songInstrumentPath(track, part),
    locale,
    image: track.cover_url || null,
    ogType: 'music.song',
  });
}

/**
 * MusicComposition for this part specifically, so the markup describes the
 * same thing the page does.
 */
function instrumentJsonLd(track: LibraryTrack, instrument: string, locale: string): Record<string, unknown> {
  const url = `${SITE_URL}${buildLocalePath(locale, songInstrumentPath(track, instrument))}`;
  const duration = isoDuration(trackDurationSec(track));
  return {
    '@context': 'https://schema.org',
    '@type': 'MusicComposition',
    name: `${track.title} (${instrumentAdjective(instrument)} transcription)`,
    url,
    description: songInstrumentDescription(track, instrument),
    musicalKey: undefined,
    ...(track.cover_url ? { image: track.cover_url } : {}),
    ...(track.published_at ? { datePublished: track.published_at } : {}),
    encodingFormat: ['application/vnd.recordare.musicxml+xml', 'audio/midi'],
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    recordedAs: {
      '@type': 'MusicRecording',
      name: track.title,
      ...(track.artist ? { byArtist: { '@type': 'MusicGroup', name: track.artist } } : {}),
      ...(track.album ? { inAlbum: { '@type': 'MusicAlbum', name: track.album } } : {}),
      ...(duration ? { duration } : {}),
    },
  };
}

export default async function SongInstrumentPage({ params }: PageProps) {
  const { locale, songId, instrument } = await params;
  const part = instrument.toLowerCase();
  setRequestLocale(locale);

  const track = await getLibraryTrack(songId);
  // No track, or no score for this part: this page does not exist. Deliberately
  // a 404 rather than a thin page or a redirect, so the catalog never
  // advertises a score it does not have.
  if (!track || !hasScoreFor(track, part)) notFound();

  let related: LibraryTrack[] = [];
  try {
    const page = await getLibraryTracks({ limit: RELATED_LIMIT });
    related = (page.tracks || []).filter((t) => t.id !== track.id && t.id !== songId).map(slimTrack);
  } catch (err) {
    console.error('Song instrument page: related tracks fetch failed', err);
  }

  const hub = hubsOfKind('notation').find((h) => h.slug === part);
  const crumbs = [
    { name: SITE_NAME, path: '/' },
    { name: 'Explore', path: '/explore' },
    ...(hub ? [{ name: hub.noun, path: hubPath(hub) }] : []),
    { name: track.artist ? `${track.title} by ${track.artist}` : track.title, path: songInstrumentPath(track, part) },
  ];

  return (
    <>
      <JsonLd data={instrumentJsonLd(track, part, locale)} />
      <JsonLd data={breadcrumbJsonLd(locale, crumbs)} />
      <SongDetail
        key={`${track.id}-${part}`}
        track={track}
        related={related}
        initialInstrument={part}
        instrumentHeading={songInstrumentHeading(part)}
        facts={<TrackFacts track={track} instrument={part} />}
      />
    </>
  );
}
