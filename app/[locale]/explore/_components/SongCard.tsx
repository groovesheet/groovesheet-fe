'use client';

import { useState } from 'react';
import { Play, DownloadSimple } from '@phosphor-icons/react';
import { Link } from '@/lib/navigation';
import { FORMAT_LABELS, fmtCount, songPath } from '@/lib/exploreConstants';
import resolveThumb, { CardThumb, type CardVariant } from './thumbs/resolveThumb';
import type { SongCardModel } from './trackToCard';
import './SongCard.css';

interface SongCardProps {
  song: SongCardModel;
  variant?: CardVariant | null;
  /** Where the card leads. Defaults to the song page, opened on the tab `variant` implies. */
  href?: string;
}

/**
 * One track in a rail or grid. Stats are the real engagement counters; cards
 * without an owner (social-pipeline tracks) skip the creator byline.
 *
 * The CRA card was an <article onClick>, which crawlers cannot follow. Here the
 * title is a real link stretched over the card (see SongCard.css), so every
 * rail on the server-rendered page is a set of crawlable links.
 */
function SongCard({ song, variant, href }: SongCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const thumbKind = resolveThumb(song, variant);
  // Default (no-variant) cards lead with real album art; format-variant rows
  // always show their generated thumb. Broken covers fall back to the thumb.
  const showCover = !variant && song.coverUrl && !coverFailed;
  const previewUrl = variant && song.previewUrls ? song.previewUrls[variant] : undefined;
  const formats = song.formats || [];
  const parts = song.parts || [];

  const primary = parts.length > 0 ? parts[0] : 'Full mix';
  const creator = song.owner && song.owner.username ? song.owner.username : null;
  const target = href || songPath(song.id, variant);

  return (
    <article className={`song-card${variant === 'sheet' ? ' song-card-sheet' : ''}`}>
      <div className={`sc-thumb${variant === 'sheet' ? ' sc-thumb-sheet' : ''}`}>
        {showCover && song.coverUrl ? (
          // Remote cover art from arbitrary hosts; next/image would need every
          // host allow-listed in next.config.ts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="sc-cover"
            src={song.coverUrl}
            alt={`${song.title} cover art`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : previewUrl && !previewFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
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
          <CardThumb kind={thumbKind} song={song} peaks={(song.thumbData && song.thumbData.stems) || null} />
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
        <div className="sc-title">
          <Link className="sc-link" href={target}>
            {song.title}
          </Link>
        </div>
        <div className="sc-artist">{song.artist}</div>
        {creator && (
          <Link className="sc-creator" href={`/u/${creator}`}>
            by @{creator}
          </Link>
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
            {formats
              .filter((f) => FORMAT_LABELS[f])
              .map((f) => (
                <span key={f}>{FORMAT_LABELS[f]}</span>
              ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default SongCard;
