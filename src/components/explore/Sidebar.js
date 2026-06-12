import React, { useMemo } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import FilterGroup from './FilterGroup';
import {
  STEM_INSTRUMENTS,
  DIFFICULTY_LEVELS,
  FORMAT_FILTER_MAP,
  LENGTH_BUCKETS,
  lengthBucket,
} from './constants';
import { seededDifficulty } from '../../utils/cosmeticStats';
import './Sidebar.css';

/**
 * Explore sidebar: search, instrument chips, and checkbox FilterGroups.
 *
 * Facet counts are computed client-side from the loaded tracks (`tracks`
 * prop). Difficulty is cosmetic (seededDifficulty) until the backend exposes
 * a real field; instrument/format/length come from real track data.
 */
function Sidebar({
  query,
  onQueryChange,
  tracks,
  filters,
  setFilters,
  popularChips,
  activeChips,
  toggleChip,
  onClose,
}) {
  const toggleFor = (key) => (label) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(label)) next[key].delete(label);
      else next[key].add(label);
      return next;
    });

  const facets = useMemo(() => {
    const all = tracks || [];
    const difficulty = Object.fromEntries(DIFFICULTY_LEVELS.map((d) => [d, 0]));
    const instrument = {};
    const format = Object.fromEntries(Object.keys(FORMAT_FILTER_MAP).map((f) => [f, 0]));
    const length = Object.fromEntries(LENGTH_BUCKETS.map((b) => [b, 0]));

    all.forEach((t) => {
      difficulty[seededDifficulty(t.id)] += 1;
      (t.parts || []).forEach((p) => {
        instrument[p] = (instrument[p] || 0) + 1;
      });
      Object.entries(FORMAT_FILTER_MAP).forEach(([label, fmt]) => {
        if ((t.formats || []).includes(fmt)) format[label] += 1;
      });
      length[lengthBucket(t.length)] += 1;
    });

    // Instruments: known stem instruments first, then any extras the data has.
    const extras = Object.keys(instrument)
      .filter((p) => !STEM_INSTRUMENTS.includes(p))
      .sort();
    const instrumentLabels = [...STEM_INSTRUMENTS, ...extras];

    const toItems = (obj, labels) =>
      (labels || Object.keys(obj)).map((label) => ({ label, count: obj[label] || 0 }));

    return {
      difficulty: toItems(difficulty, DIFFICULTY_LEVELS),
      instrument: toItems(instrument, instrumentLabels),
      format: toItems(format, Object.keys(FORMAT_FILTER_MAP)),
      length: toItems(length, LENGTH_BUCKETS),
    };
  }, [tracks]);

  return (
    <aside className="explore-sidebar">
      {onClose && (
        <div className="sb-head">
          <button className="sb-close" onClick={onClose} aria-label="Close filters">
            <X size={20} weight="regular" />
          </button>
        </div>
      )}

      <div className="sb-search-shell">
        <span className="sb-search-icon">
          <MagnifyingGlass size={16} weight="regular" />
        </span>
        <input
          className="sb-search"
          placeholder="Search transcriptions…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search transcriptions"
        />
      </div>

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
        items={facets.difficulty}
        value={filters.difficulty}
        onToggle={toggleFor('difficulty')}
      />
      <FilterGroup
        title="Instrument"
        items={facets.instrument}
        value={filters.instrument}
        onToggle={toggleFor('instrument')}
      />
      <FilterGroup
        title="Format"
        items={facets.format}
        value={filters.format}
        onToggle={toggleFor('format')}
      />
      <FilterGroup
        title="Length"
        items={facets.length}
        value={filters.length}
        onToggle={toggleFor('length')}
        defaultOpen={false}
      />
    </aside>
  );
}

export default Sidebar;
