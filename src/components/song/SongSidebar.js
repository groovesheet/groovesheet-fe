// Right sidebar for the song detail page — restored from the design prototype
// (song-sidebar.jsx) but fed entirely with real library-track data, including
// the real plays/downloads counters.
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  DownloadSimple,
  Printer,
  BookmarkSimple,
  Share,
  Flag,
  Play,
} from '@phosphor-icons/react';
import { creatorHandleForTrack } from '../../utils/creatorApi';
import { reportTrack } from '../../utils/libraryApi';
import { LocalizedLink } from '../../i18n/locale';

/** Report dialog — portal to <body> (LoginModal pattern). Launch DMCA path. */
function ReportModal({ track, onClose }) {
  const [reason, setReason] = useState('copyright');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const field = { width: '100%', background: 'var(--color-input-bg)', border: '1px solid var(--color-input-border)', borderRadius: 8, padding: '10px 13px', fontFamily: 'var(--font-family-sans)', fontSize: 14, color: 'var(--color-text)', outline: 'none' };
  const label = { fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 6, display: 'block' };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await reportTrack(track.id, {
        reason,
        details: details.trim() || undefined,
        contact: contact.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not send the report');
    } finally {
      setBusy(false);
    }
  };

  return ReactDOM.createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <form role="dialog" aria-modal="true" aria-label="Report this track" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: '100%', maxWidth: 420, background: 'var(--color-panel1)', borderRadius: 13, padding: 26, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: 19, fontWeight: 500, color: 'var(--color-text)' }}>Report This Track</div>
        {done ? (
          <>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--color-muted-foreground)' }}>
              Thanks — your report was received and this track has been flagged for review.
              For formal DMCA notices, email <a href="mailto:support@groovesheet.net" style={{ color: 'var(--color-primary)' }}>support@groovesheet.net</a>.
            </p>
            <button type="button" className="gs-btn gs-btn-primary" onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            {error && <p style={{ margin: 0, fontSize: 13, color: '#FF6B7A' }}>{error}</p>}
            <div>
              <label htmlFor="report-reason" style={label}>Reason</label>
              <select id="report-reason" style={{ ...field, cursor: 'pointer' }} value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="copyright">Copyright infringement</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Something else</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-details" style={label}>Details (optional)</label>
              <textarea id="report-details" style={{ ...field, height: 84, resize: 'vertical' }} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} placeholder="What's the issue? For copyright claims, tell us who owns the work." />
            </div>
            <div>
              <label htmlFor="report-contact" style={label}>Contact email (optional, for follow-up)</label>
              <input id="report-contact" type="email" style={field} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="gs-btn gs-btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="gs-btn gs-btn-primary" style={{ flex: 1 }} disabled={busy}>{busy ? 'Sending…' : 'Send Report'}</button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body
  );
}

function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Small row thumbnail: real cover art when available, gradient tile otherwise. */
function RowThumb({ track }) {
  if (track.cover_url) {
    return (
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

function SongSidebar({ track, stems, relatedTracks = [], onSongClick, isSignedIn, onDownload, onLoginClick, downloading, instrumentOptions = [], instrument, onInstrument, scoreAsset }) {
  const id = track.id;
  const durationSec = track.thumb_data?.duration_sec || track.duration_sec || 0;

  const formats = new Set((track.assets || []).map((a) => a.format));
  const assetTypes = new Set((track.assets || []).map((a) => a.asset_type));
  const hasXml = formats.has('musicxml') || assetTypes.has('musicxml');
  const hasMidi = formats.has('mid') || assetTypes.has('midi');
  // The score the viewer is looking at, engraved on demand. Falls back to any
  // MusicXML on the track so the mobile drawer — which renders before a part
  // has been chosen — still offers one.
  const pdfAsset =
    scoreAsset || (track.assets || []).find((a) => a.asset_type === 'musicxml' && a.id) || null;
  const pdfUrl = pdfAsset ? `/api/library/assets/${pdfAsset.id}/pdf` : null;

  const formatList = [];
  if (hasXml) formatList.push('PDF');
  if (hasXml) formatList.push('MusicXML');
  if (hasMidi) formatList.push('MIDI');
  if (formats.has('flac')) formatList.push('FLAC');
  if (formats.has('opus')) formatList.push('Opus');
  const formatLabel = formatList.length ? formatList.join(' · ') : 'Stems';

  const [reportOpen, setReportOpen] = useState(false);

  const subtitle = [
    track.album,
    stems.length ? `${stems.length} stems` : null,
    durationSec ? fmtTime(durationSec) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const tags = [
    ...stems.map((s) => s.label),
    track.year ? String(track.year) : null,
    track.artist,
    'Stems',
    hasXml ? 'MusicXML' : null,
    hasMidi ? 'MIDI' : null,
  ].filter(Boolean);

  const moreByArtist = relatedTracks
    .filter((t) => t.artist === track.artist && t.id !== track.id)
    .slice(0, 5);

  return (
    <aside className="gs-rsidebar">
      {/* Header / hero block */}
      <div className="gs-rs-section">
        {(() => {
          // Publisher row: circular profile picture + linked handle. Prefer
          // the real owner from the track payload; fall back to the
          // deterministic handle for unattributed tracks.
          const handle = (track.owner && track.owner.username) || creatorHandleForTrack(track);
          if (!handle) return null;
          const avatarUrl = track.owner && track.owner.avatar_url;
          const displayName = (track.owner && track.owner.display_name) || handle;
          return (
            <LocalizedLink
              to={`/u/${handle}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                textDecoration: 'none',
                marginBottom: 10,
              }}
            >
              {avatarUrl ? (
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
              <span style={{ fontSize: 15, color: 'var(--color-text)', fontWeight: 500 }}>
                @{handle}
              </span>
            </LocalizedLink>
          );
        })()}
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
          {track.title}{' '}
          <span style={{ color: 'var(--color-muted-foreground)', fontWeight: 400 }}>
            — {track.artist}
          </span>
        </h1>
        {subtitle && (
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-muted-foreground)' }}>
            {subtitle}
          </p>
        )}

        {/* Stats — real engagement counters */}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 8,
            marginTop: 16,
          }}
        >
          {/* Two-way synced with the viewer toolbar's instrument dropdown —
              both write the same page-level state, so no extra wiring. */}
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
          onClick={() => (isSignedIn ? onDownload && onDownload() : onLoginClick && onLoginClick())}
          style={{ marginTop: 14, cursor: downloading ? 'wait' : 'pointer' }}
        >
          <DownloadSimple size={18} weight="bold" />
          {downloading ? 'Preparing ZIP…' : isSignedIn ? 'Download All (ZIP)' : 'Sign in to Download'}
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

        {/* Quad of secondary actions */}
        <div className="gs-quad">
          {/* Was a <button> with no handler, while the page advertised the
              score as "downloadable as PDF". Opens in a tab so it can be read
              and saved; the endpoint engraves the MusicXML and caches it. */}
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noreferrer" title="Engraved PDF score">
              <Printer size={14} />
              PDF
            </a>
          ) : (
            <button type="button" disabled title="No score to engrave for this track">
              <Printer size={14} />
              PDF
            </button>
          )}
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
        {reportOpen && <ReportModal track={track} onClose={() => setReportOpen(false)} />}
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
          <dd>{fmtDate(track.published_at)}</dd>
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

      {/* More by this artist — real related tracks only */}
      {moreByArtist.length > 0 && (
        <div className="gs-rs-section">
          <h3>More by {track.artist}</h3>
          <div>
            {moreByArtist.map((t) => (
              <div
                className="gs-rs-row"
                key={t.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onSongClick && onSongClick(t)}
              >
                <div className="gs-rs-row-thumb">
                  <RowThumb track={t} />
                </div>
                <div className="gs-rs-row-body">
                  <div className="gs-rs-row-title">{t.title}</div>
                  <div className="gs-rs-row-meta">
                    <span style={{ fontFamily: 'var(--font-family-mono)' }}>
                      {fmtTime(t.thumb_data?.duration_sec || t.duration_sec)}
                    </span>
                  </div>
                </div>
                <span className="gs-rs-row-rating">
                  <Play size={11} weight="fill" />
                  {fmtNum(t.plays || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default SongSidebar;
