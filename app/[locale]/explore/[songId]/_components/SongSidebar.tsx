'use client';

// Right sidebar for the song page, restored from the design prototype
// (song-sidebar.jsx) but fed entirely with real library-track data, including
// the real plays/downloads counters.
import { useState } from 'react';
import { DownloadSimple, Printer, BookmarkSimple, Share, Flag, Play } from '@phosphor-icons/react';
import { creatorHandleForTrack } from '@/lib/creatorApi';
import { trackExploreUploadCta } from '@/lib/analytics';
import { Link } from '@/lib/navigation';
import { useLocale } from '@/lib/i18n';
import { LOCALE_HTML_LANG } from '@/lib/locales';
import { songPath } from '@/lib/exploreConstants';
import type { InstrumentOption, StemRow } from '@/components/player';
import type { LibraryTrack } from '@/lib/types';
import ReportModal from './ReportModal';
import { trackAssets, trackDurationSec, type SongAsset } from './songData';

function fmtNum(n: number | null | undefined): string {
  if (n == null) return '\u2013';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function fmtTime(sec: number | null | undefined): string {
  const s = Number.isFinite(sec) && (sec as number) > 0 ? (sec as number) : 0;
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

/**
 * Publish date in the page's locale and in UTC. Both are fixed on purpose: the
 * server renders this, and the browser must hydrate to the same string.
 */
function fmtDate(iso: string | null | undefined, lang: string): string {
  if (!iso) return '\u2013';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Small row thumbnail: real cover art when available, gradient tile otherwise. */
function RowThumb({ track }: { track: LibraryTrack }) {
  if (track.cover_url) {
    return (
      // Remote cover art from arbitrary hosts; see SongCard.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={track.cover_url}
        alt={`${track.title} cover`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  }
  const hue = (track.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'serif',
        fontSize: 16,
        fontWeight: 500,
        background: `linear-gradient(135deg, hsl(${hue} 60% 55%), hsl(${(hue + 60) % 360} 55% 35%))`,
      }}
    >
      {(track.title || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
}

export interface SongSidebarProps {
  track: LibraryTrack;
  stems: StemRow[];
  relatedTracks?: LibraryTrack[];
  /** Signed in: the download button downloads. Signed out: it opens sign-in. */
  isSignedIn: boolean;
  /** False until the browser knows; the server always renders the neutral label. */
  authLoaded: boolean;
  onDownload: () => void;
  onLoginClick: () => void;
  downloading: boolean;
  instrumentOptions?: InstrumentOption[];
  instrument: string | null;
  onInstrument?: (name: string) => void;
  /** The score the viewer shows, engraved to PDF on demand. */
  scoreAsset: SongAsset | null;
}

export default function SongSidebar({
  track,
  stems,
  relatedTracks = [],
  isSignedIn,
  authLoaded,
  onDownload,
  onLoginClick,
  downloading,
  instrumentOptions = [],
  instrument,
  onInstrument,
  scoreAsset,
}: SongSidebarProps) {
  const locale = useLocale();
  const durationSec = trackDurationSec(track);
  const assets = trackAssets(track);

  const formats = new Set(assets.map((a) => a.format));
  const assetTypes = new Set(assets.map((a) => a.asset_type));
  const hasXml = formats.has('musicxml') || assetTypes.has('musicxml');
  const hasMidi = formats.has('mid') || assetTypes.has('midi');
  // The score the viewer is looking at, engraved on demand. Falls back to any
  // MusicXML on the track so the mobile drawer still offers one.
  const pdfAsset = scoreAsset || assets.find((a) => a.asset_type === 'musicxml' && a.id) || null;
  const pdfUrl = pdfAsset && pdfAsset.id ? `/api/library/assets/${pdfAsset.id}/pdf` : null;

  const formatList: string[] = [];
  if (hasXml) formatList.push('PDF');
  if (hasXml) formatList.push('MusicXML');
  if (hasMidi) formatList.push('MIDI');
  if (formats.has('flac')) formatList.push('FLAC');
  if (formats.has('opus')) formatList.push('Opus');
  const formatLabel = formatList.length ? formatList.join(' · ') : 'Stems';

  const [reportOpen, setReportOpen] = useState(false);

  const subtitle = [track.album, stems.length ? `${stems.length} stems` : null, durationSec ? fmtTime(durationSec) : null]
    .filter(Boolean)
    .join(' · ');

  const tags = [
    ...stems.map((s) => s.label),
    track.year ? String(track.year) : null,
    track.artist,
    'Stems',
    hasXml ? 'MusicXML' : null,
    hasMidi ? 'MIDI' : null,
  ].filter((t): t is string => Boolean(t));

  const moreByArtist = relatedTracks.filter((t) => t.artist === track.artist && t.id !== track.id).slice(0, 5);

  // Publisher row: prefer the real owner from the track payload; fall back to
  // the deterministic handle for unattributed tracks.
  const handle = (track.owner && track.owner.username) || creatorHandleForTrack(track);
  const avatarUrl = track.owner && track.owner.avatar_url;
  const displayName = (track.owner && track.owner.display_name) || handle || '';

  // Until the browser knows who is signed in, show the neutral label: the
  // server HTML is cached and shared, so it must not say "Sign in".
  const signedOut = authLoaded && !isSignedIn;

  return (
    <aside className="gs-rsidebar">
      {/* Header / hero block */}
      <div className="gs-rs-section">
        {handle && (
          <Link
            href={`/u/${handle}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              marginBottom: 10,
            }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={`@${handle} profile`}
                style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }}
              />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #0139C7, var(--color-primary))',
                }}
              >
                {displayName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span style={{ fontSize: 15, color: 'var(--color-text)', fontWeight: 500 }}>@{handle}</span>
          </Link>
        )}
        <h1
          style={{
            fontSize: 22,
            lineHeight: '28px',
            fontWeight: 500,
            color: 'var(--color-text)',
            margin: 0,
            letterSpacing: '-0.2px',
          }}
        >
          {track.title}
          {track.artist && (
            <>
              {' '}
              <span style={{ color: 'var(--color-muted-foreground)', fontWeight: 400 }}>by {track.artist}</span>
            </>
          )}
        </h1>
        {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted-foreground)' }}>{subtitle}</p>}

        {/* Stats: real engagement counters */}
        <div className="gs-statrow">
          <span className="gs-stat" aria-label={`${track.plays || 0} plays`}>
            <Play size={13} />
            <strong>{fmtNum(track.plays || 0)}</strong>
            <span style={{ opacity: 0.7 }}>plays</span>
          </span>
          <span className="gs-stat" aria-label={`${track.downloads || 0} downloads`}>
            <DownloadSimple size={13} />
            <strong>{fmtNum(track.downloads || 0)}</strong>
            <span style={{ opacity: 0.7 }}>downloads</span>
          </span>
        </div>

        {/* Selects row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 16 }}>
          {/* Two-way synced with the viewer toolbar's instrument dropdown:
              both write the same page-level state. */}
          {instrumentOptions.length > 0 && onInstrument && (
            <select
              className="gs-select"
              aria-label="Instrument"
              value={instrument || instrumentOptions[0].name}
              onChange={(e) => onInstrument(e.target.value)}
            >
              {instrumentOptions.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Big CTA */}
        <button
          className="gs-cta-download"
          type="button"
          disabled={downloading}
          onClick={() => (isSignedIn ? onDownload() : onLoginClick())}
          style={{ marginTop: 14, cursor: downloading ? 'wait' : 'pointer' }}
        >
          <DownloadSimple size={18} weight="bold" />
          {downloading ? 'Preparing ZIP…' : signedOut ? 'Sign in to Download' : 'Download All (ZIP)'}
        </button>
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: 'var(--color-muted-foreground)',
            textAlign: 'center',
            letterSpacing: 0.2,
          }}
        >
          {formatLabel}
        </div>

        {/* Bridge to the paid flow. Library downloads are free, and every
            marketing channel points here, so without this there is no route
            from a song page into the product people actually pay for. */}
        <Link
          href="/"
          onClick={() => trackExploreUploadCta(track, { placement: 'sidebar' })}
          style={{
            display: 'block',
            marginTop: 14,
            padding: '11px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            textAlign: 'center',
            textDecoration: 'none',
            color: 'var(--color-text)',
            fontSize: 12,
            lineHeight: 1.45,
          }}
        >
          <span style={{ display: 'block', fontWeight: 600 }}>Not the song you needed?</span>
          <span style={{ color: 'var(--color-muted-foreground)' }}>Transcribe your own audio &rarr;</span>
        </Link>

        {/* Quad of secondary actions */}
        <div className="gs-quad">
          {/* Opens in a tab so it can be read and saved; the endpoint engraves
              the MusicXML and caches it. */}
          <button
            type="button"
            disabled={!pdfUrl}
            title={pdfUrl ? 'Engraved PDF score' : 'No score to engrave for this track'}
            onClick={() => pdfUrl && window.open(pdfUrl, '_blank', 'noopener')}
          >
            <Printer size={14} />
            PDF
          </button>
          <button type="button">
            <BookmarkSimple size={14} />
            Save
          </button>
          <button type="button">
            <Share size={14} />
            Share
          </button>
          <button type="button" onClick={() => setReportOpen(true)}>
            <Flag size={14} />
            Report
          </button>
        </div>
        {reportOpen && <ReportModal trackId={track.id} onClose={() => setReportOpen(false)} />}
      </div>

      {/* Score info */}
      <div className="gs-rs-section">
        <h3>Score info</h3>
        <dl className="gs-kv">
          <dt>Artist</dt>
          <dd>{track.artist}</dd>
          {track.album && (
            <>
              <dt>Album</dt>
              <dd>{track.album}</dd>
            </>
          )}
          {track.year && (
            <>
              <dt>Year</dt>
              <dd>{track.year}</dd>
            </>
          )}
          <dt>Duration</dt>
          <dd>{fmtTime(durationSec)}</dd>
          <dt>Stems</dt>
          <dd>{stems.length}</dd>
          <dt>Published</dt>
          <dd>{fmtDate(track.published_at, LOCALE_HTML_LANG[locale])}</dd>
          <dt>Source</dt>
          <dd>{track.source}</dd>
        </dl>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="gs-rs-section">
          <h3>Tags</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((t) => (
              <span key={t} className="gs-tag">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* More by this artist: real related tracks only */}
      {moreByArtist.length > 0 && (
        <div className="gs-rs-section">
          <h3>More by {track.artist}</h3>
          <div>
            {moreByArtist.map((t) => (
              <Link className="gs-rs-row" key={t.id} href={songPath(t.id)} style={{ textDecoration: 'none' }}>
                <div className="gs-rs-row-thumb">
                  <RowThumb track={t} />
                </div>
                <div className="gs-rs-row-body">
                  <div className="gs-rs-row-title">{t.title}</div>
                  <div className="gs-rs-row-meta">
                    <span style={{ fontFamily: 'var(--font-family-mono)' }}>{fmtTime(trackDurationSec(t))}</span>
                  </div>
                </div>
                <span className="gs-rs-row-rating">
                  <Play size={11} weight="fill" />
                  {fmtNum(t.plays || 0)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
