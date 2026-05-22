import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import './ExploreHeader.css';

const TRY_CHIPS = ['Clair de Lune', 'Lo-fi drums', 'Movie themes', 'Beginner piano'];

function ExploreHeader({ query, onQueryChange }) {
  return (
    <div className="explore-hero">
      <div className="eh-copy">
        <h1 className="eh-title">Explore.</h1>
        <p className="eh-sub">
          Browse transcriptions, MIDI, and stems from our library. Every track ships in all three
          formats — pick your weapon.
        </p>
      </div>
      <div className="eh-search">
        <div className="eh-search-shell">
          <span className="eh-search-icon">
            <MagnifyingGlass size={20} weight="regular" />
          </span>
          <input
            className="eh-search-input"
            placeholder="Search titles, artists, instruments…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Search the library"
          />
          <button type="button" className="eh-search-btn">
            Search
          </button>
        </div>
        <div className="eh-try">
          <span className="eh-try-label">Try</span>
          {TRY_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              className="eh-try-chip"
              onClick={() => onQueryChange(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ExploreHeader;
