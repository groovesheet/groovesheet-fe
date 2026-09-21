'use client';

import { useState } from 'react';
import { Play, DownloadSimple } from '@phosphor-icons/react';
import { Link } from '@/lib/navigation';
import { FORMAT_LABELS, fmtCount, fmtDur, songPath } from '@/lib/exploreConstants';
import resolveThumb, { CardThumb } from './thumbs/resolveThumb';
import type { SongCardModel } from './trackToCard';
import './ResultRow.css';

/**
 * Compact horizontal result, the list-view counterpart of SongCard.
 *
 * Same card model and the same thumb rule, so switching layouts never changes
 * which artwork a track shows. The title link covers the row, as in SongCard.
 */
function ResultRow({ song }: { song: SongCardModel }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const thumbKind = resolveThumb(song);
  const showCover = song.coverUrl && !coverFailed;
  const parts = song.parts || [];
  const formats = (song.formats || []).filter((f) => FORMAT_LABELS[f]);
  const primary = parts.length > 0 ? parts.join(' · ') : 'Full mix';
  const creator = song.owner && song.owner.username ? song.owner.username : null;

  return (
    <article className="result-row">
      <div className="rr-thumb">
        {showCover && song.coverUrl ? (
          // Remote cover art from arbitrary hosts (see SongCard).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="rr-cover"
            src={song.coverUrl}
            alt={`${song.title} cover art`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <CardThumb kind={thumbKind} song={song} peaks={(song.thumbData && song.thumbData.stems) || null} />
        )}
      </div>

      <div className="rr-titles">
        <div className="rr-title">
          <Link className="rr-link" href={songPath(song.id)}>
            {song.title}
          </Link>
        </div>
        <div className="rr-artist">{song.artist}</div>
        {creator && (
          <Link className="rr-creator" href={`/u/${creator}`}>
            by @{creator}
          </Link>
        )}
      </div>

      <div className="rr-parts">
        <span className="rr-primary">{song.year ? `${primary} · ${song.year}` : primary}</span>
        {formats.length > 0 && (
          <span className="rr-formats">
            {formats.map((f) => (
              <span key={f}>{FORMAT_LABELS[f]}</span>
            ))}
          </span>
        )}
      </div>

      <div className="rr-stats">
        <span className="rr-dur">{fmtDur(song.length)}</span>
        <span className="rr-stat" aria-label={`${song.plays || 0} plays`}>
          <Play size={13} weight="regular" />
          {fmtCount(song.plays || 0)}
        </span>
        <span className="rr-stat" aria-label={`${song.downloads || 0} downloads`}>
          <DownloadSimple size={13} weight="regular" />
          {fmtCount(song.downloads || 0)}
        </span>
      </div>

      <span className="rr-open">Open</span>
    </article>
  );
}

export default ResultRow;
