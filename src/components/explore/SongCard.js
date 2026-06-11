import React, { useState } from 'react';
import { Play, Clock } from '@phosphor-icons/react';
import SheetThumb from './thumbs/SheetThumb';
import MidiThumb from './thumbs/MidiThumb';
import StemThumb from './thumbs/StemThumb';
import { FORMAT_LABELS, fmtDur } from './constants';
import './SongCard.css';

const THUMB_BY_VARIANT = {
  sheet: SheetThumb,
  midi: MidiThumb,
  stems: StemThumb,
};

function resolveThumb(song, variant) {
  if (variant && THUMB_BY_VARIANT[variant]) return THUMB_BY_VARIANT[variant];
  // Stems thumbs are the most honest default (we always have stem peaks when
  // thumb_data exists); otherwise pick deterministically from the id.
  if (song.thumbData && song.thumbData.stems) return StemThumb;
  const flavors = ['sheet', 'midi', 'stems'];
  const id = String(song.id || '00');
  const c = (id.charCodeAt(0) + id.charCodeAt(id.length - 1)) % flavors.length;
  return THUMB_BY_VARIANT[flavors[c]];
}

/**
 * Card model (see Explore.js trackToCard):
 * { id, title, artist, length, coverUrl, formats, thumbData, parts }
 */
function SongCard({ song, variant, onClick }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const Thumb = resolveThumb(song, variant);
  // Default (no-variant) cards lead with real album art; format-variant rows
  // always show their generated thumb. Broken covers fall back to the thumb.
  const showCover = !variant && song.coverUrl && !coverFailed;
  const formats = song.formats || [];
  const parts = song.parts || [];

  return (
    <article className="song-card" onClick={() => onClick && onClick(song)}>
      <div className="sc-thumb">
        {showCover ? (
          <img
            className="sc-cover"
            src={song.coverUrl}
            alt={`${song.title} cover art`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
          />
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
        <div className="sc-row">
          <span className="sc-genre">
            {parts.length > 0 ? parts.slice(0, 3).join(' · ') : 'Full mix'}
          </span>
          <span className="sc-stats">
            <span className="sc-views">
              <Clock size={12} weight="regular" />
              {fmtDur(song.length)}
            </span>
          </span>
        </div>
        {formats.length > 0 && (
          <div className="sc-formats">
            {formats.map((f) => (
              <span key={f}>{FORMAT_LABELS[f] || f.toUpperCase()}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default SongCard;
