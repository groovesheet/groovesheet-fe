/**
 * The facts block under the player on a track page.
 *
 * Why it exists: before this, everything a crawler could read on a track page
 * came from the chrome and the "recommended scores" rail, so ~300 pages
 * differed by a title and a list of other songs' titles. That is the shape
 * Google's scaled-content guidance describes, and it is the reason the library
 * has one indexed keyword between all of it.
 *
 * Everything here is read off the record: album, year, duration, which parts
 * were separated, which of them carry notation, and what the track can be
 * downloaded as. Nothing is written by hand, so nothing can drift from what
 * the page actually offers.
 *
 * With an `instrument`, it becomes the facts block for /explore/:song/:part:
 * the prose is about that part, the download list is filtered to the files
 * that part actually has, and the links point at the song's other parts. Those
 * pages share a player with the parent, so this block is most of what makes
 * them different from it and from each other.
 *
 * A Server Component, passed into SongDetail (a client component) as a prop,
 * so it is in the server HTML regardless of hydration.
 */
import { Link } from '@/lib/navigation';
import { capitalize, fmtDur } from '@/lib/exploreConstants';
import { hubBySlug, hubLinkLabel, hubPath, hubsForTrack } from '@/lib/seo/instrumentHubs';
import type { LibraryTrack } from '@/lib/types';
import {
  instrumentAdjective,
  scoredInstruments,
  songInstrumentPath,
  trackPath,
  trackAssets,
  trackDurationSec,
} from './songData';
import './TrackFacts.css';

const NOTATION_TYPES = new Set(['musicxml', 'midi']);

interface DownloadRow {
  test: (assetTypes: Set<string>) => boolean;
  label: string;
  note: string;
}

const DOWNLOAD_LABELS: DownloadRow[] = [
  { test: (t) => t.has('musicxml'), label: 'MusicXML', note: 'opens in MuseScore, Sibelius, Dorico or Finale' },
  { test: (t) => t.has('musicxml'), label: 'PDF', note: 'engraved score, ready to print' },
  { test: (t) => t.has('midi'), label: 'MIDI', note: 'editable notes for any DAW' },
  { test: (t) => t.has('stem'), label: 'Stems', note: 'each separated part as its own audio file' },
];

/** The same list, but every note says which part the file holds. */
function partDownloadLabels(adjective: string): DownloadRow[] {
  return [
    { test: (t) => t.has('musicxml'), label: 'MusicXML', note: `the ${adjective} part, for MuseScore, Sibelius, Dorico or Finale` },
    { test: (t) => t.has('musicxml'), label: 'PDF', note: `the ${adjective} score, engraved and ready to print` },
    { test: (t) => t.has('midi'), label: 'MIDI', note: `the ${adjective} notes, editable in any DAW` },
    { test: (t) => t.has('stem'), label: 'Stem', note: `the isolated ${adjective} audio on its own` },
  ];
}

function titleCaseList(values: string[]): string {
  const parts = values.map(capitalize);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Instruments as the adjectives that go before "part": "drum", "piano and
 * bass". Naming the parts this way also sidesteps the agreement problem in
 * "drums was transcribed": the verb agrees with "part"/"parts", which follows
 * the count, while "Drums" is plural at a count of one.
 */
function adjectiveList(instruments: string[]): string {
  const words = instruments.map((i) => instrumentAdjective(i).toLowerCase());
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

interface TrackFactsProps {
  track: LibraryTrack;
  /**
   * The part this page is about, on /explore/:song/:instrument. Omitted on the
   * song page, which covers every part at once.
   */
  instrument?: string | null;
}

export default function TrackFacts({ track, instrument = null }: TrackFactsProps) {
  const assets = trackAssets(track);
  const assetTypes = new Set(assets.map((a) => a.asset_type).filter(Boolean) as string[]);

  // Parts that were separated, and the subset that also carries notation.
  const stemParts = [...new Set(assets.filter((a) => a.asset_type === 'stem').map((a) => a.stem_name))].filter(
    (n): n is string => Boolean(n)
  );
  const notatedParts = [...new Set(assets.filter((a) => NOTATION_TYPES.has(a.asset_type || '')).map((a) => a.stem_name))].filter(
    (n): n is string => Boolean(n)
  );
  // Of those, the ones with an engraved score. The rest came out as MIDI, and
  // the page has to say so: the player's sheet-music tab is disabled for them,
  // so "transcribed to notation you can read" would not be true of that part.
  const scoredParts = [...new Set(assets.filter((a) => a.asset_type === 'musicxml').map((a) => a.stem_name))].filter(
    (n): n is string => Boolean(n)
  );
  const midiOnlyParts = notatedParts.filter((n) => !scoredParts.includes(n));

  const duration = trackDurationSec(track);
  const subject = track.artist ? `${track.title} by ${track.artist}` : track.title;

  const part = instrument ? instrument.toLowerCase() : null;
  const adjective = part ? instrumentAdjective(part).toLowerCase() : null;

  // On a part page, the download list is filtered to the files that part has,
  // rather than everything on the record. A track can be transcribed for one
  // instrument and only separated for another.
  const partAssetTypes = part
    ? new Set(
        assets
          .filter((a) => (a.stem_name || '').toLowerCase() === part)
          .map((a) => a.asset_type)
          .filter(Boolean) as string[]
      )
    : assetTypes;

  const downloads =
    part && adjective
      ? partDownloadLabels(adjective).filter((d) => d.test(partAssetTypes))
      : DOWNLOAD_LABELS.filter((d) => d.test(assetTypes));

  // Hubs this track belongs to, so every track page links up to its parents.
  // A part page links to its own hub only: the others are reachable through
  // the sibling links below, which are about this song.
  const ownHub = part ? hubBySlug('notation', part) : undefined;
  const parentHubs = part ? (ownHub ? [ownHub] : []) : hubsForTrack({ notated: notatedParts, stems: stemParts });

  // Parts of this song with a page of their own. On a part page these are the
  // siblings; on the song page they are the children, and this block is how a
  // crawler reaches them at all. Scored, not merely transcribed: these links
  // must not lead anywhere the route 404s.
  const partPages = scoredInstruments(track);
  const siblings = part ? partPages.filter((i) => i !== part) : partPages;

  const rows: { label: string; value: string }[] = [
    ...(part ? [{ label: 'Part', value: instrumentAdjective(part) }] : []),
    ...(track.album ? [{ label: 'Album', value: track.album }] : []),
    ...(track.year ? [{ label: 'Released', value: String(track.year) }] : []),
    ...(duration ? [{ label: 'Length', value: fmtDur(duration) }] : []),
    ...(stemParts.length ? [{ label: 'Separated parts', value: titleCaseList(stemParts) }] : []),
    ...(scoredParts.length ? [{ label: 'Sheet music', value: titleCaseList(scoredParts) }] : []),
    ...(midiOnlyParts.length ? [{ label: 'MIDI only', value: titleCaseList(midiOnlyParts) }] : []),
  ];

  if (!rows.length && !downloads.length) return null;

  return (
    <section className="tf" aria-labelledby="tf-heading">
      <h2 id="tf-heading" className="tf-heading">
        {adjective ? `About this ${adjective} transcription` : 'About this transcription'}
      </h2>

      <p className="tf-lede">
        {adjective ? (
          <>
            GrooveSheet separated {subject} and transcribed the {adjective} part to notation you can read, hear played
            back against the recording, and export.{' '}
            {siblings.length > 0 ? (
              <>
                It transcribed the {adjectiveList(siblings)} {siblings.length === 1 ? 'part' : 'parts'} too, on{' '}
                {siblings.length === 1 ? 'a page of its own' : 'pages of their own'}.
              </>
            ) : (
              <>It is the only part of this track with notation so far.</>
            )}
          </>
        ) : scoredParts.length > 0 ? (
          <>
            GrooveSheet separated {subject} into {stemParts.length || 'its'} isolated{' '}
            {stemParts.length === 1 ? 'part' : 'parts'} and transcribed {titleCaseList(scoredParts).toLowerCase()} to
            notation you can read, hear played back against the recording, and export.
            {midiOnlyParts.length > 0 && (
              <> The {adjectiveList(midiOnlyParts)} {midiOnlyParts.length === 1 ? 'part' : 'parts'} came out as MIDI, without an engraved score.</>
            )}
          </>
        ) : notatedParts.length > 0 ? (
          <>
            GrooveSheet separated {subject} into {stemParts.length || 'its'} isolated{' '}
            {stemParts.length === 1 ? 'part' : 'parts'} and transcribed {titleCaseList(notatedParts).toLowerCase()} to
            MIDI you can play back and edit. No part of this track has an engraved score yet.
          </>
        ) : (
          <>
            GrooveSheet separated {subject} into {stemParts.length || 'its'} isolated{' '}
            {stemParts.length === 1 ? 'part' : 'parts'} you can solo, mute and download. This track has no notation yet.
          </>
        )}
      </p>

      {rows.length > 0 && (
        <dl className="tf-grid">
          {rows.map((row) => (
            <div className="tf-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {downloads.length > 0 && (
        <div className="tf-block">
          <h3>What you can download</h3>
          <ul className="tf-list">
            {downloads.map((d) => (
              <li key={d.label}>
                <strong>{d.label}</strong>
                <span>{d.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {siblings.length > 0 && (
        <div className="tf-block">
          <h3>{part ? 'Other parts of this song' : 'Read one part on its own'}</h3>
          <ul className="tf-links">
            {siblings.map((sibling) => (
              <li key={sibling}>
                <Link href={songInstrumentPath(track, sibling)}>
                  {instrumentAdjective(sibling)} sheet music for {track.title}
                </Link>
              </li>
            ))}
            {part && (
              <li>
                <Link href={trackPath(track)}>Every part of {track.title} on one page</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {parentHubs.length > 0 && (
        <div className="tf-block">
          <h3>More like this</h3>
          <ul className="tf-links">
            {parentHubs.map((h) => (
              <li key={h.slug}>
                <Link href={hubPath(h)}>{hubLinkLabel(h)}</Link>
              </li>
            ))}
            {track.artist && (
              <li>
                <Link href={`/explore/search?q=${encodeURIComponent(track.artist)}`}>
                  Every transcription by {track.artist}
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="tf-note">
        Transcribed automatically from the recording, so treat it as a strong first draft rather than an official
        edition. Every export is editable, and you can{' '}
        <Link href="/">run your own audio through the same models</Link> with a free ten-second preview.
      </p>
    </section>
  );
}
