// Right sidebar for the song detail page — restored from the design prototype
// (song-sidebar.jsx) but fed entirely with real library-track data. Engagement
// numbers (views/likes/comments/rating/difficulty) are deterministic cosmetic
// seeds from src/utils/cosmeticStats.js until the backend grows those fields.
import React, { useState } from 'react';
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
import {
  seededDifficulty,
  seededViews,
  seededLikes,
  seededComments,
  seededRating,
  seededRatingCount,
} from '../../utils/cosmeticStats';
import { creatorHandleForTrack } from '../../utils/creatorApi';
import { LocalizedLink } from '../../i18n/locale';

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

/** 5-star block + numeric rating + count, ported from the design prototype. */
function StarBlock({ rating, count }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: 'var(--color-muted-foreground)',
      }}
    >
      <span style={{ display: 'inline-flex', color: '#f59e0b' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={11}
            weight={i < full || (i === full && half) ? 'fill' : 'regular'}
            style={{ opacity: i < full ? 1 : i === full && half ? 0.6 : 0.35 }}
          />
        ))}
      </span>
      <strong style={{ color: 'var(--color-text)', fontWeight: 500 }}>{rating.toFixed(1)}</strong>
      {count != null && <span>({fmtNum(count)})</span>}
    </span>
  );
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

function SongSidebar({ track, stems, relatedTracks = [], onSongClick }) {
  const id = track.id;
  const durationSec = track.thumb_data?.duration_sec || track.duration_sec || 0;

  const formats = new Set((track.assets || []).map((a) => a.format));
  const assetTypes = new Set((track.assets || []).map((a) => a.asset_type));
  const hasXml = formats.has('musicxml') || assetTypes.has('musicxml');
  const hasMidi = formats.has('mid') || assetTypes.has('midi');
  const formatList = [];
  if (hasXml) formatList.push('MusicXML');
  if (hasMidi) formatList.push('MIDI');
  if (formats.has('flac')) formatList.push('FLAC');
  if (formats.has('opus')) formatList.push('Opus');
  const formatLabel = formatList.length ? formatList.join(' · ') : 'Stems';

  // Display-only selects: real stem names + a seeded difficulty.
  const instruments = stems.map((s) => s.label);
  const [instrument, setInstrument] = useState(instruments[0] || '');
  const [difficulty, setDifficulty] = useState(seededDifficulty(id));

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
        <div className="gs-rs-publisher">
          <SealCheck size={13} weight="fill" style={{ color: 'var(--color-primary)' }} />
          <span>GrooveSheet</span>
          {track.source && (
            <span style={{ opacity: 0.65 }}>
              · {track.source === 'social_pipeline' ? 'auto-transcription' : track.source}
            </span>
          )}
          {(() => {
            // Prefer the real publisher (owner) from the track payload; fall
            // back to the deterministic handle for unattributed tracks.
            const handle = (track.owner && track.owner.username) || creatorHandleForTrack(track);
            if (!handle) return null;
            return (
              <span style={{ opacity: 0.65 }}>
                {' · by '}
                <LocalizedLink
                  to={`/u/${handle}`}
                  style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                >
                  @{handle}
                </LocalizedLink>
              </span>
            );
          })()}
        </div>
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

        {/* Stats */}
        <div className="gs-statrow">
          <span className="gs-stat">
            <Eye size={13} />
            <strong>{fmtNum(seededViews(id, Number(track.popularity) || 0))}</strong>
          </span>
          <span className="gs-stat">
            <Heart size={13} weight="fill" style={{ color: '#ef4444' }} />
            <strong>{fmtNum(seededLikes(id, Number(track.popularity) || 0))}</strong>
          </span>
          <span className="gs-stat">
            <ChatCircle size={13} />
            <strong>{seededComments(id)}</strong>
          </span>
          <span style={{ flex: '1 0 auto' }} />
          <StarBlock rating={seededRating(id)} count={seededRatingCount(id)} />
        </div>

        {/* Selects row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: instruments.length ? '1fr 1fr' : '1fr',
            gap: 8,
            marginTop: 16,
          }}
        >
          {instruments.length > 0 && (
            <select
              className="gs-select"
              aria-label="Instrument"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
            >
              {instruments.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          )}
          <select
            className="gs-select"
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </div>

        {/* Big CTA */}
        <button className="gs-cta-download" type="button" disabled style={{ marginTop: 14 }}>
          <DownloadSimple size={18} weight="bold" />
          Sign in to download
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
                    <span>·</span>
                    <span>{seededDifficulty(t.id)}</span>
                  </div>
                </div>
                <span className="gs-rs-row-rating">
                  <Star size={11} weight="fill" style={{ color: '#f59e0b' }} />
                  {seededRating(t.id).toFixed(1)}
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
