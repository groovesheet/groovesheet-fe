import React from 'react';
import { X } from '@phosphor-icons/react';
// import FilterGroup from './FilterGroup'; // deferred — see note below
import './Sidebar.css';

/**
 * Explore sidebar.
 *
 * Active filter: the instrument chips, which filter client-side on each
 * track's `parts` (derived from thumb_data.stems keys).
 *
 * DEFERRED: the checkbox FilterGroups (Difficulty / Genre / Format / Length)
 * are hidden, not deleted, because the public library API does not expose
 * difficulty/genre yet and per-facet counts are unavailable. Re-enable them
 * (and FilterGroup above) once the backend returns facets.
 */
function Sidebar({ popularChips, activeChips, toggleChip, onClose }) {
  return (
    <aside className="explore-sidebar">
      {onClose && (
        <div className="sb-head">
          <button className="sb-close" onClick={onClose} aria-label="Close filters">
            <X size={20} weight="regular" />
          </button>
        </div>
      )}

      <div className="sb-popular">
        <div className="sb-popular-label">Instruments</div>
        <div className="sb-chips">
          {popularChips.map((c) => (
            <button
              key={c}
              type="button"
              className={`sb-chip${activeChips.has(c) ? ' sb-chip-active' : ''}`}
              onClick={() => toggleChip(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* DEFERRED until the library API exposes these facets:
      <FilterGroup
        title="Difficulty"
        items={FILTERS.difficulty}
        value={filters.difficulty}
        onToggle={toggleFor('difficulty')}
      />
      <FilterGroup
        title="Genre"
        items={FILTERS.genre}
        value={filters.genre}
        onToggle={toggleFor('genre')}
      />
      <FilterGroup
        title="Format"
        items={FILTERS.format}
        value={filters.format}
        onToggle={toggleFor('format')}
      />
      <FilterGroup
        title="Length"
        items={FILTERS.length}
        value={filters.length}
        onToggle={toggleFor('length')}
        defaultOpen={false}
      />
      */}
    </aside>
  );
}

export default Sidebar;
