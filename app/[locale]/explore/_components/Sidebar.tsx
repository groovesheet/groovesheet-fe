'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import FilterGroup, { type FacetItem } from './FilterGroup';
import {
  STEM_INSTRUMENTS,
  FORMAT_FILTER_MAP,
  FORMAT_LABEL_BY_ASSET_TYPE,
  LENGTH_BUCKETS,
  LENGTH_LABEL_BY_PARAM,
  capitalize,
  lengthBucket,
} from '@/lib/exploreConstants';
import type { FilterSets } from './resultsParams';
import type { SongCardModel } from './trackToCard';
import type { JsonObject } from '@/lib/types';
import './Sidebar.css';

type FacetKey = keyof FilterSets;

interface SidebarProps {
  query: string;
  onQueryChange: (value: string) => void;
  /** The hub counts facets over the tracks it holds. */
  tracks?: SongCardModel[];
  /** The results page passes the server's counts instead. */
  facetCounts?: JsonObject | null;
  filters: FilterSets;
  setFilters: Dispatch<SetStateAction<FilterSets>>;
  popularChips: string[];
  activeChips: Set<string>;
  toggleChip: (chip: string) => void;
  onClose?: (() => void) | null;
}

/** One facet of the API's `facets` object ({musicxml: 3, ...}), numbers only. */
function countMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, count] of Object.entries(value)) {
    if (typeof count === 'number') out[key] = count;
  }
  return out;
}

/**
 * Explore sidebar: search, instrument chips, and checkbox FilterGroups.
 *
 * Facet counts come from the server when `facetCounts` is supplied (the
 * results page, where only one page of tracks is loaded and counting them
 * would undercount the catalog). The hub passes `tracks` instead and counts
 * client-side, which is accurate there because it holds the whole list.
 */
function Sidebar({
  query,
  onQueryChange,
  tracks,
  facetCounts,
  filters,
  setFilters,
  popularChips,
  activeChips,
  toggleChip,
  onClose,
}: SidebarProps) {
  const toggleFor = (key: FacetKey) => (label: string) =>
    setFilters((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(label)) next[key].delete(label);
      else next[key].add(label);
      return next;
    });

  const facets = useMemo((): Record<FacetKey, FacetItem[]> => {
    if (facetCounts) {
      // Server shape: {format: {musicxml: n}, instrument: {piano: n}, length: {under2: n}}
      const instrumentCounts = countMap(facetCounts.instrument);
      const formatCounts = countMap(facetCounts.format);
      const lengthCounts = countMap(facetCounts.length);
      const known = STEM_INSTRUMENTS.map((label) => ({
        label,
        count: instrumentCounts[label.toLowerCase()] || 0,
      }));
      const extras = Object.keys(instrumentCounts)
        .map(capitalize)
        .filter((label) => !STEM_INSTRUMENTS.includes(label))
        .sort()
        .map((label) => ({ label, count: instrumentCounts[label.toLowerCase()] || 0 }));
      return {
        instrument: [...known, ...extras],
        format: Object.keys(FORMAT_FILTER_MAP).map((label) => ({
          label,
          count: Object.entries(formatCounts).reduce(
            (n, [assetType, count]) => (FORMAT_LABEL_BY_ASSET_TYPE[assetType] === label ? n + count : n),
            0
          ),
        })),
        length: LENGTH_BUCKETS.map((label) => ({
          label,
          count: Object.entries(lengthCounts).reduce(
            (n, [param, count]) => (LENGTH_LABEL_BY_PARAM[param] === label ? n + count : n),
            0
          ),
        })),
      };
    }

    const all = tracks || [];
    const instrument: Record<string, number> = {};
    const format: Record<string, number> = Object.fromEntries(Object.keys(FORMAT_FILTER_MAP).map((f) => [f, 0]));
    const length: Record<string, number> = Object.fromEntries(LENGTH_BUCKETS.map((b) => [b, 0]));

    all.forEach((t) => {
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

    const toItems = (obj: Record<string, number>, labels: string[]) =>
      labels.map((label) => ({ label, count: obj[label] || 0 }));

    return {
      instrument: toItems(instrument, instrumentLabels),
      format: toItems(format, Object.keys(FORMAT_FILTER_MAP)),
      length: toItems(length, LENGTH_BUCKETS),
    };
  }, [tracks, facetCounts]);

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
        title="Instrument"
        items={facets.instrument}
        value={filters.instrument}
        onToggle={toggleFor('instrument')}
      />
      <FilterGroup title="Format" items={facets.format} value={filters.format} onToggle={toggleFor('format')} />
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
