import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import './ExploreHeader.css';

const TRY_CHIPS = ['Clair de Lune', 'Lo-fi drums', 'Movie themes', 'Beginner piano'];

/**
 * `onSubmit` hands the query to the full results page (/explore/search).
 * Typing still filters the hub's rows live via `onQueryChange`; submitting is
 * what leaves for the paginated, sortable view.
 */
function ExploreHeader({ query, onQueryChange, onSubmit }) {
  const submit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(query);
  };

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
        <form className="eh-search-shell" onSubmit={submit}>
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
          <button type="submit" className="eh-search-btn">
            Search
          </button>
        </form>
        <div className="eh-try">
          <span className="eh-try-label">Try</span>
          {TRY_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              className="eh-try-chip"
              onClick={() => (onSubmit ? onSubmit(s) : onQueryChange(s))}
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
