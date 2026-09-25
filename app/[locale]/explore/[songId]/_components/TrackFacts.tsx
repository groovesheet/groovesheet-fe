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
 * A Server Component, passed into SongDetail (a client component) as a prop,
 * so it is in the server HTML regardless of hydration.
 */
import { Link } from '@/lib/navigation';
import { capitalize, fmtDur } from '@/lib/exploreConstants';
import { hubLinkLabel, hubPath, hubsForTrack } from '@/lib/seo/instrumentHubs';
import type { LibraryTrack } from '@/lib/types';
import { trackAssets, trackDurationSec } from './songData';
import './TrackFacts.css';

const NOTATION_TYPES = new Set(['musicxml', 'midi']);

const DOWNLOAD_LABELS: { test: (assetTypes: Set<string>) => boolean; label: string; note: string }[] = [
  { test: (t) => t.has('musicxml'), label: 'MusicXML', note: 'opens in MuseScore, Sibelius, Dorico or Finale' },
  { test: (t) => t.has('musicxml'), label: 'PDF', note: 'engraved score, ready to print' },
  { test: (t) => t.has('midi'), label: 'MIDI', note: 'editable notes for any DAW' },
  { test: (t) => t.has('stem'), label: 'Stems', note: 'each separated part as its own audio file' },
];

function titleCaseList(values: string[]): string {
  const parts = values.map(capitalize);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export default function TrackFacts({ track }: { track: LibraryTrack }) {
  const assets = trackAssets(track);
  const assetTypes = new Set(assets.map((a) => a.asset_type).filter(Boolean) as string[]);

  // Parts that were separated, and the subset that also carries notation.
  const stemParts = [...new Set(assets.filter((a) => a.asset_type === 'stem').map((a) => a.stem_name))].filter(
    (n): n is string => Boolean(n)
  );
  const notatedParts = [...new Set(assets.filter((a) => NOTATION_TYPES.has(a.asset_type || '')).map((a) => a.stem_name))].filter(
    (n): n is string => Boolean(n)
  );

  const duration = trackDurationSec(track);
  const downloads = DOWNLOAD_LABELS.filter((d) => d.test(assetTypes));
  const subject = track.artist ? `${track.title} by ${track.artist}` : track.title;

  // Hubs this track belongs to, so every track page links up to its parents.
  const parentHubs = hubsForTrack({ notated: notatedParts, stems: stemParts });

  const rows: { label: string; value: string }[] = [
    ...(track.album ? [{ label: 'Album', value: track.album }] : []),
    ...(track.year ? [{ label: 'Released', value: String(track.year) }] : []),
    ...(duration ? [{ label: 'Length', value: fmtDur(duration) }] : []),
    ...(stemParts.length ? [{ label: 'Separated parts', value: titleCaseList(stemParts) }] : []),
    ...(notatedParts.length ? [{ label: 'Transcribed to notation', value: titleCaseList(notatedParts) }] : []),
  ];

  if (!rows.length && !downloads.length) return null;

  return (
    <section className="tf" aria-labelledby="tf-heading">
      <h2 id="tf-heading" className="tf-heading">
        About this transcription
      </h2>

      <p className="tf-lede">
        {notatedParts.length > 0 ? (
          <>
            GrooveSheet separated {subject} into {stemParts.length || 'its'} isolated{' '}
            {stemParts.length === 1 ? 'part' : 'parts'} and transcribed {titleCaseList(notatedParts).toLowerCase()} to
            notation you can read, hear played back against the recording, and export.
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
