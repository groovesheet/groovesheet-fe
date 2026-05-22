import React from 'react';
import { Play, Eye, Star } from '@phosphor-icons/react';
import SheetThumb from './thumbs/SheetThumb';
import MidiThumb from './thumbs/MidiThumb';
import StemThumb from './thumbs/StemThumb';
import { fmtCount } from '../../mocks/exploreData';
import './SongCard.css';

const THUMB_BY_VARIANT = {
  sheet: SheetThumb,
  midi: MidiThumb,
  stems: StemThumb,
};

function resolveThumb(song, variant) {
  if (variant && THUMB_BY_VARIANT[variant]) return THUMB_BY_VARIANT[variant];
  const flavors = ['sheet', 'midi', 'stems'];
  const c = (song.id.charCodeAt(1) + song.id.charCodeAt(2)) % flavors.length;
  return THUMB_BY_VARIANT[flavors[c]];
}

function SongCard({ song, variant, onClick }) {
  const Thumb = resolveThumb(song, variant);
  const diffClass = `sc-diff sc-diff-${song.difficulty.toLowerCase()}`;
  const showSkill = song.skill && song.id.charCodeAt(2) % 3 === 0;

  return (
    <article className="song-card" onClick={() => onClick && onClick(song)}>
      <div className="sc-thumb">
        <Thumb song={song} />
        <div className="sc-overlay" />
        <div className="sc-overlay-play">
          <span className="sc-play-btn" aria-label="Preview">
            <Play size={20} weight="fill" />
          </span>
        </div>
        <div className="sc-overlay-cta">
          <span className="sc-open-pill">OPEN</span>
        </div>
        <div className="sc-diff-wrap">
          <span className={diffClass}>{song.difficulty}</span>
        </div>
        {showSkill && (
          <div className="sc-skill-wrap">
            <span className="sc-skill-tag">{song.skill}</span>
          </div>
        )}
      </div>
      <div className="sc-meta">
        <div className="sc-title">{song.title}</div>
        <div className="sc-artist">{song.artist}</div>
        <div className="sc-row">
          <span className="sc-genre">
            {song.primary} · {song.genre}
          </span>
          <span className="sc-stats">
            <span className="sc-views">
              <Eye size={12} weight="regular" />
              {fmtCount(song.saves)}
            </span>
            <span className="sc-stars" aria-label={`${song.rating} out of 5`}>
              <Star size={12} weight="fill" />
              <span className="sc-rating">{song.rating.toFixed(1)}</span>
            </span>
          </span>
        </div>
        <div className="sc-formats">
          <span>SHEET</span>
          <span>MIDI</span>
          <span>STEMS</span>
        </div>
      </div>
    </article>
  );
}

export default SongCard;
