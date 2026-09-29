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
 * The sentences come from messages/{locale}.json (`song.facts`), with the
 * lists joined in the page's language. On /zh-CN and /zh-TW this is the
 * largest block of Chinese on the page, which is what makes those URLs
 * translations rather than the English page declared three times.
 *
 * An async Server Component, passed into SongDetail (a client component) as a
 * prop, so it is in the server HTML regardless of hydration.
 */
import { getTranslations } from 'next-intl/server';
import { Link } from '@/lib/navigation';
import { fmtDur } from '@/lib/exploreConstants';
import { hubPath, hubsForTrack } from '@/lib/seo/instrumentHubs';
import type { LibraryTrack } from '@/lib/types';
import {
  instrumentVars,
  instrumentWord,
  joinList,
  scoredInstruments,
  songInstrumentPath,
  songSubject,
  trackAssets,
  trackDurationSec,
  trackPath,
  type SongT,
} from './songData';
import './TrackFacts.css';

const NOTATION_TYPES = new Set(['musicxml', 'midi']);

interface DownloadRow {
  test: (assetTypes: Set<string>) => boolean;
  label: string;
  note: string;
}

function songDownloads(t: SongT): DownloadRow[] {
  return [
    { test: (x) => x.has('musicxml'), label: 'MusicXML', note: t('facts.downloads.musicxml') },
    { test: (x) => x.has('musicxml'), label: 'PDF', note: t('facts.downloads.pdf') },
    { test: (x) => x.has('midi'), label: 'MIDI', note: t('facts.downloads.midi') },
    { test: (x) => x.has('stem'), label: t('facts.downloads.stemsLabel'), note: t('facts.downloads.stems') },
  ];
}

/** The same list, but every note says which part the file holds. */
function partDownloads(t: SongT, vars: Record<string, string>): DownloadRow[] {
  return [
    { test: (x) => x.has('musicxml'), label: 'MusicXML', note: t('facts.downloads.partMusicxml', vars) },
    { test: (x) => x.has('musicxml'), label: 'PDF', note: t('facts.downloads.partPdf', vars) },
    { test: (x) => x.has('midi'), label: 'MIDI', note: t('facts.downloads.partMidi', vars) },
    { test: (x) => x.has('stem'), label: t('facts.downloads.partStemLabel'), note: t('facts.downloads.partStem', vars) },
  ];
}

interface TrackFactsProps {
  track: LibraryTrack;
  /**
   * The part this page is about, on /explore/:song/:instrument. Omitted on the
   * song page, which covers every part at once.
   */
  instrument?: string | null;
  locale: string;
}

export default async function TrackFacts({ track, instrument = null, locale }: TrackFactsProps) {
  const t = (await getTranslations({ locale, namespace: 'song' })) as unknown as SongT;
  const assets = trackAssets(track);
  const assetTypes = new Set(assets.map((a) => a.asset_type).filter(Boolean) as string[]);

  const partsWith = (types: (type: string) => boolean) =>
    [...new Set(assets.filter((a) => types(a.asset_type || '')).map((a) => (a.stem_name || '').toLowerCase()))].filter(
      Boolean
    );
  // Parts that were separated, and the subset that also carries notation.
  const stemParts = partsWith((type) => type === 'stem');
  const notatedParts = partsWith((type) => NOTATION_TYPES.has(type));
  // Of those, the ones with an engraved score. The rest came out as MIDI, and
  // the page has to say so: the player's sheet-music tab is disabled for them,
  // so "transcribed to notation you can read" would not be true of that part.
  const scoredParts = partsWith((type) => type === 'musicxml');
  const midiOnlyParts = notatedParts.filter((n) => !scoredParts.includes(n));

  // Lists in the page's language, in the form each sentence needs.
  const list = (parts: string[], form: 'name' | 'noun' | 'adjective') =>
    joinList(
      locale,
      parts.map((p) => instrumentWord(t, p, form))
    );

  const duration = trackDurationSec(track);
  const subject = songSubject(t, track);
  const stems = t('facts.stemCount', { count: stemParts.length });

  const part = instrument ? instrument.toLowerCase() : null;
  const vars = part ? instrumentVars(t, part) : null;

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

  const downloads = vars
    ? partDownloads(t, vars).filter((d) => d.test(partAssetTypes))
    : songDownloads(t).filter((d) => d.test(assetTypes));

  // Hubs this track belongs to, so every track page links up to its parents.
  // A part page links to its own hub only: the others are reachable through
  // the sibling links below, which are about this song.
  const parentHubs = part
    ? hubsForTrack({ notated: [part], stems: [] })
    : hubsForTrack({ notated: notatedParts, stems: stemParts });

  // Parts of this song with a page of their own. On a part page these are the
  // siblings; on the song page they are the children, and this block is how a
  // crawler reaches them at all. Scored, not merely transcribed: these links
  // must not lead anywhere the route 404s.
  const partPages = scoredInstruments(track);
  const siblings = part ? partPages.filter((i) => i !== part) : partPages;

  const rows: { label: string; value: string }[] = [
    ...(part ? [{ label: t('facts.rows.part'), value: instrumentWord(t, part, 'name') }] : []),
    ...(track.album ? [{ label: t('facts.rows.album'), value: track.album }] : []),
    ...(track.year ? [{ label: t('facts.rows.released'), value: String(track.year) }] : []),
    ...(duration ? [{ label: t('facts.rows.length'), value: fmtDur(duration) }] : []),
    ...(stemParts.length ? [{ label: t('facts.rows.separated'), value: list(stemParts, 'name') }] : []),
    ...(scoredParts.length ? [{ label: t('facts.rows.scored'), value: list(scoredParts, 'name') }] : []),
    ...(midiOnlyParts.length ? [{ label: t('facts.rows.midiOnly'), value: list(midiOnlyParts, 'name') }] : []),
  ];

  if (!rows.length && !downloads.length) return null;

  // Lists of other parts, passed in every form a locale's sentence may use.
  const partList = (parts: string[]) => ({
    count: parts.length,
    names: list(parts, 'name'),
    adjectives: list(parts, 'adjective'),
  });

  let lede: string;
  if (vars) {
    lede =
      t('facts.ledePart', { ...vars, subject }) +
      (siblings.length ? t('facts.ledeSiblings', partList(siblings)) : t('facts.ledeOnly'));
  } else if (scoredParts.length) {
    lede =
      t('facts.ledeScored', { subject, stems, scored: list(scoredParts, 'noun') }) +
      (midiOnlyParts.length ? t('facts.ledeMidiTail', partList(midiOnlyParts)) : '');
  } else if (notatedParts.length) {
    lede = t('facts.ledeMidi', { subject, stems, notated: list(notatedParts, 'noun') });
  } else {
    lede = t('facts.ledeStems', { subject, stems });
  }

  return (
    <section className="tf" aria-labelledby="tf-heading">
      <h2 id="tf-heading" className="tf-heading">
        {vars ? t('facts.headingPart', vars) : t('facts.heading')}
      </h2>

      <p className="tf-lede">{lede}</p>

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
          <h3>{t('facts.downloads.heading')}</h3>
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
          <h3>{part ? t('facts.siblings.headingPart') : t('facts.siblings.headingSong')}</h3>
          <ul className="tf-links">
            {siblings.map((sibling) => (
              <li key={sibling}>
                <Link href={songInstrumentPath(track, sibling)}>
                  {t('facts.siblings.link', { ...instrumentVars(t, sibling), title: track.title })}
                </Link>
              </li>
            ))}
            {part && (
              <li>
                <Link href={trackPath(track)}>{t('facts.siblings.everyPart', { title: track.title })}</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {parentHubs.length > 0 && (
        <div className="tf-block">
          <h3>{t('facts.more.heading')}</h3>
          <ul className="tf-links">
            {parentHubs.map((h) => (
              <li key={h.slug}>
                <Link href={hubPath(h)}>
                  {h.kind === 'notation'
                    ? t('facts.more.notationHub', instrumentVars(t, h.slug))
                    : t('facts.more.stemsHub', instrumentVars(t, h.slug))}
                </Link>
              </li>
            ))}
            {track.artist && (
              <li>
                <Link href={`/explore/search?q=${encodeURIComponent(track.artist)}`}>
                  {t('facts.more.byArtist', { artist: track.artist })}
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <p className="tf-note">
        {t('facts.note.before')}
        <Link href="/">{t('facts.note.link')}</Link>
        {t('facts.note.after')}
      </p>
    </section>
  );
}
