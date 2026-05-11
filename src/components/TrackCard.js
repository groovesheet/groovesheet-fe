import React from 'react';
import './TrackCard.css';

export const TrackCard = ({ title, artist, year, coverUrl, onClick }) => {
  return (
    <button className="track-card" onClick={onClick} type="button">
      <div className="track-card-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={`${title} cover`} loading="lazy" />
        ) : (
          <div className="track-card-cover-placeholder" />
        )}
      </div>
      <div className="track-card-meta">
        <div className="track-card-title">{title}</div>
        <div className="track-card-sub">
          <span className="track-card-artist">{artist}</span>
          {year ? <span className="track-card-dot">·</span> : null}
          {year ? <span className="track-card-year">{year}</span> : null}
        </div>
      </div>
    </button>
  );
};

export default TrackCard;
