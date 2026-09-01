import React, { useState } from 'react';
import { Play, DownloadSimple } from '@phosphor-icons/react';
import { LocalizedLink } from '../../i18n/locale';
import resolveThumb from './thumbs/resolveThumb';
import { FORMAT_LABELS, fmtCount } from './constants';
import './SongCard.css';

/**
 * Card model (see Explore.js trackToCard):
 * { id, title, artist, length, year, coverUrl, formats, thumbData, parts,
 *   popularity, plays, downloads, owner }
 *
 * Stats are the real engagement counters. Cards without an owner (social-
 * pipeline tracks) skip the creator byline.
 */
function SongCard({ song, variant, onClick }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const Thumb = resolveThumb(song, variant);
  // Default (no-variant) cards lead with real album art; format-variant rows
  // always show their generated thumb. Broken covers fall back to the thumb.
  const showCover = !variant && song.coverUrl && !coverFailed;
  const previewUrl = variant && song.previewUrls && song.previewUrls[variant];
  const formats = song.formats || [];
  const parts = song.parts || [];

  const primary = parts.length > 0 ? parts[0] : 'Full mix';
  const creator = song.owner && song.owner.username ? song.owner.username : null;

  return (
    <article className={`song-card${variant === 'sheet' ? ' song-card-sheet' : ''}`} onClick={() => onClick && onClick(song)}>
      <div className={`sc-thumb${variant === 'sheet' ? ' sc-thumb-sheet' : ''}`}>
        {showCover ? (
          <img
            className="sc-cover"
            src={song.coverUrl}
            alt={`${song.title} cover art`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : previewUrl && !previewFailed ? (
          <img
            className={`sc-cover${variant === 'sheet' ? ' sc-score-preview' : ''}`}
            src={previewUrl}
            alt={`${song.title} ${variant} preview`}
            loading="lazy"
            onError={() => setPreviewFailed(true)}
          />
        ) : variant === 'sheet' ? (
          <div className="sc-sheet-processing" role="img" aria-label="Score preview processing">
            <span>Score preview processing</span>
          </div>
        ) : (
          <Thumb song={song} peaks={(song.thumbData && song.thumbData.stems) || null} />
        )}
        <div className="sc-overlay" />
        <div className="sc-overlay-play">
          <span className="sc-play-btn" aria-label="Preview">
            <Play size={20} weight="fill" />
          </span>
        </div>
        <div className="sc-overlay-cta">
          <span className="sc-open-pill">OPEN</span>
        </div>
      </div>
      <div className="sc-meta">
        <div className="sc-title">{song.title}</div>
        <div className="sc-artist">{song.artist}</div>
        {creator && (
          <LocalizedLink
            className="sc-creator"
            to={`/u/${creator}`}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 12, color: 'var(--color-muted-foreground)', textDecoration: 'none' }}
          >
            by @{creator}
          </LocalizedLink>
        )}
        <div className="sc-row">
          <span className="sc-genre">{song.year ? `${primary} · ${song.year}` : primary}</span>
          <span className="sc-stats">
            <span className="sc-views" aria-label={`${song.plays || 0} plays`}>
              <Play size={12} weight="regular" />
              {fmtCount(song.plays || 0)}
            </span>
            <span className="sc-views" aria-label={`${song.downloads || 0} downloads`}>
              <DownloadSimple size={12} weight="regular" />
              {fmtCount(song.downloads || 0)}
            </span>
          </span>
        </div>
        {formats.length > 0 && (
          <div className="sc-formats">
            {formats.filter((f) => FORMAT_LABELS[f]).map((f) => (
              <span key={f}>{FORMAT_LABELS[f]}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default SongCard;
