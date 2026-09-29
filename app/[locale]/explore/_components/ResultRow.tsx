'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, DownloadSimple } from '@phosphor-icons/react';
import { Link } from '@/lib/navigation';
import { FORMAT_LABELS, fmtCount, fmtDur, songPath } from '@/lib/exploreConstants';
import resolveThumb, { CardThumb } from './thumbs/resolveThumb';
import type { SongCardModel } from './trackToCard';
import { useFacetLabel } from './facetLabels';
import './ResultRow.css';

/**
 * Compact horizontal result, the list-view counterpart of SongCard.
 *
 * Same card model and the same thumb rule, so switching layouts never changes
 * which artwork a track shows. The title link covers the row, as in SongCard.
 */
function ResultRow({ song }: { song: SongCardModel }) {
  const t = useTranslations('song.card');
  const tSong = useTranslations('song');
  const tResults = useTranslations('explore.results');
  const facetLabel = useFacetLabel();
  const [coverFailed, setCoverFailed] = useState(false);
  const thumbKind = resolveThumb(song);
  const showCover = song.coverUrl && !coverFailed;
  const parts = song.parts || [];
  const formats = (song.formats || []).filter((f) => FORMAT_LABELS[f]);
  const primary = parts.length > 0 ? parts.map((p) => facetLabel('instrument', p)).join(' · ') : tSong('fullMix');
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
            alt={t('coverAlt', { title: song.title })}
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
            {t('byCreator', { creator })}
          </Link>
        )}
      </div>

      <div className="rr-parts">
        <span className="rr-primary">{song.year ? `${primary} · ${song.year}` : primary}</span>
        {formats.length > 0 && (
          <span className="rr-formats">
            {formats.map((f) => (
              <span key={f}>{t.has(`formats.${f}`) ? t(`formats.${f}`) : FORMAT_LABELS[f]}</span>
            ))}
          </span>
        )}
      </div>

      <div className="rr-stats">
        <span className="rr-dur">{fmtDur(song.length)}</span>
        <span className="rr-stat" aria-label={t('playsAria', { count: song.plays || 0 })}>
          <Play size={13} weight="regular" />
          {fmtCount(song.plays || 0)}
        </span>
        <span className="rr-stat" aria-label={t('downloadsAria', { count: song.downloads || 0 })}>
          <DownloadSimple size={13} weight="regular" />
          {fmtCount(song.downloads || 0)}
        </span>
      </div>

      <span className="rr-open">{tResults('open')}</span>
    </article>
  );
}

export default ResultRow;
