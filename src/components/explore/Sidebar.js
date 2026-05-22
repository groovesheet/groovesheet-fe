import React from 'react';
import { X } from '@phosphor-icons/react';
import FilterGroup from './FilterGroup';
import { FILTERS } from '../../mocks/exploreData';
import './Sidebar.css';

function Sidebar({ filters, setFilters, popularChips, activeChips, toggleChip, onClose }) {
  const toggleFor = (key) => (label) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(label)) next[key].delete(label);
      else next[key].add(label);
      return next;
    });

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
        <div className="sb-popular-label">Popular</div>
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

      <FilterGroup
        title="Difficulty"
        items={FILTERS.difficulty}
        value={filters.difficulty}
        onToggle={toggleFor('difficulty')}
      />
      <FilterGroup
        title="Instrument"
        items={FILTERS.instrument}
        value={filters.instrument}
        onToggle={toggleFor('instrument')}
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
    </aside>
  );
}

export default Sidebar;
