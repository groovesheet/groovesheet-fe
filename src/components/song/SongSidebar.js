import React from 'react';
import {
  DownloadSimple,
  Printer,
  BookmarkSimple,
  Share,
  PencilSimple,
  Eye,
  ChatCircle,
  Heart,
  Star,
  SealCheck,
} from '@phosphor-icons/react';

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

function CoverArt({ track }) {
  if (track.cover_url) {
    return (
      <div className="gs-rs-cover-thumb" style={{ overflow: 'hidden' }}>
        <img
          src={track.cover_url}
          alt={`${track.title} cover`}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }
  if (track.cover_r2_key) {
    // Cover bytes aren't behind a public CDN yet; fall back to the gradient
    // tile until we have a public-cover URL builder.
  }
  const hue = (track.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initial = (track.title || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="gs-rs-cover-thumb"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 60% 55%), hsl(${(hue + 60) % 360} 55% 35%))`,
      }}
    >
      <span
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'serif',
          fontSize: 28,
          fontWeight: 500,
        }}
      >
        {initial}
      </span>
    </div>
  );
}

function SongSidebar({ track, stems }) {
  const formats = new Set((track.assets || []).map((a) => a.format));
  const formatList = [];
  if (formats.has('musicxml')) formatList.push('MusicXML');
  if (formats.has('mid')) formatList.push('MIDI');
  if (formats.has('flac')) formatList.push('FLAC');
  if (formats.has('opus')) formatList.push('Opus');
  const formatLabel = formatList.length ? formatList.join(' · ') : 'Stems';

  return (
    <aside className="gs-rsidebar">
      <div className="gs-rs-section">
        <div className="gs-rs-publisher">
          {track.source === 'social_pipeline' ? (
            <>
              <SealCheck size={13} weight="fill" style={{ color: 'var(--color-primary)' }} />
              <span>GrooveSheet auto-transcription</span>
            </>
          ) : (
            <span>{track.source}</span>
          )}
        </div>

        <div className="gs-rs-cover">
          <CoverArt track={track} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="gs-rs-title">{track.title}</h1>
            <p className="gs-rs-artist">{track.artist}</p>
            {track.album && <p className="gs-rs-album">{track.album}</p>}
          </div>
        </div>

        <div className="gs-statrow">
          <span className="gs-stat">
            <Eye size={13} />
            <strong>{fmtNum(track.popularity)}</strong>
          </span>
          <span className="gs-stat">
            <Heart size={13} weight="fill" style={{ color: '#ef4444' }} />
            <strong>—</strong>
          </span>
          <span className="gs-stat">
            <ChatCircle size={13} />
            <strong>—</strong>
          </span>
          <span style={{ flex: '1 0 auto' }} />
          <span className="gs-stat">
            <Star size={13} weight="fill" style={{ color: '#f59e0b' }} />
            <strong>—</strong>
          </span>
        </div>

        <button className="gs-cta-download" type="button" disabled>
          <DownloadSimple size={18} weight="bold" />
          Sign in to download
        </button>
        <div className="gs-cta-formats">{formatLabel}</div>

        <div className="gs-quad">
          <button type="button">
            <Printer size={14} />
            Print
          </button>
          <button type="button">
            <BookmarkSimple size={14} />
            Save
          </button>
          <button type="button">
            <Share size={14} />
            Share
          </button>
          <button type="button">
            <PencilSimple size={14} />
            Open in editor
          </button>
        </div>
      </div>

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
          <dd>{fmtTime(track.duration_sec)}</dd>
          <dt>Stems</dt>
          <dd>{stems.length}</dd>
          <dt>Published</dt>
          <dd>{fmtDate(track.published_at)}</dd>
          <dt>Source</dt>
          <dd>{track.source}</dd>
        </dl>
      </div>

      {stems.length > 0 && (
        <div className="gs-rs-section">
          <h3>Available stems</h3>
          <div className="gs-tag-row">
            {stems.map((s) => (
              <span key={s.name} className="gs-tag" style={{ borderColor: `${s.color}55` }}>
                <span
                  className="gs-tag-swatch"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

export default SongSidebar;
