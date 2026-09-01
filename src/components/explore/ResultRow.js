import React, { useState } from 'react';
import { Play, DownloadSimple } from '@phosphor-icons/react';
import { LocalizedLink } from '../../i18n/locale';
import resolveThumb from './thumbs/resolveThumb';
import { FORMAT_LABELS, fmtCount, fmtDur } from './constants';
import './ResultRow.css';

/**
 * Compact horizontal result, the list-view counterpart of SongCard.
 *
 * Same card model (see trackToCard in Explore.js) and the same thumb rule, so
 * switching layouts never changes which artwork a track shows.
 */
function ResultRow({ song, onClick }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const Thumb = resolveThumb(song);
  const showCover = song.coverUrl && !coverFailed;
  const parts = song.parts || [];
  const formats = (song.formats || []).filter((f) => FORMAT_LABELS[f]);
  const primary = parts.length > 0 ? parts.join(' · ') : 'Full mix';
  const creator = song.owner && song.owner.username ? song.owner.username : null;

  return (
    <article className="result-row" onClick={() => onClick && onClick(song)}>
      <div className="rr-thumb">
        {showCover ? (
          <img
            className="rr-cover"
            src={song.coverUrl}
            alt={`${song.title} cover art`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <Thumb song={song} peaks={(song.thumbData && song.thumbData.stems) || null} />
        )}
      </div>

      <div className="rr-titles">
        <div className="rr-title">{song.title}</div>
        <div className="rr-artist">{song.artist}</div>
        {creator && (
          <LocalizedLink
            className="rr-creator"
            to={`/u/${creator}`}
            onClick={(e) => e.stopPropagation()}
          >
            by @{creator}
          </LocalizedLink>
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
