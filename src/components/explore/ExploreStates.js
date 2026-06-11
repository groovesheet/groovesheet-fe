import React from 'react';
import { MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import './ExploreStates.css';

/** Skeleton placeholder mirroring a Section row of SongCards while the library loads. */
export function SkeletonSection({ cards = 4 }) {
  return (
    <section className="explore-section" aria-hidden="true">
      <header className="es-header">
        <div className="es-titles">
          <div className="exsk-line exsk-title" />
          <div className="exsk-line exsk-subtitle" />
        </div>
      </header>
      <div className="es-row exsk-row">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="exsk-card">
            <div className="exsk-thumb" />
            <div className="exsk-meta">
              <div className="exsk-line exsk-w60" />
              <div className="exsk-line exsk-w40" />
              <div className="exsk-line exsk-w80" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Shown when a search returns no tracks. */
export function ExploreEmpty({ query, onClear }) {
  return (
    <div className="explore-state">
      <span className="explore-state-icon">
        <MagnifyingGlass size={28} weight="regular" />
      </span>
      <h2 className="explore-state-title">
        {query ? <>No results for &ldquo;{query}&rdquo;</> : 'The library is empty'}
      </h2>
      <p className="explore-state-sub">
        {query
          ? 'Try a different title, artist, or instrument.'
          : 'New tracks are published regularly — check back soon.'}
      </p>
      {query && onClear && (
        <button type="button" className="explore-state-btn" onClick={onClear}>
          Clear search
        </button>
      )}
    </div>
  );
}

/** Shown when the library request fails. */
export function ExploreError({ message, onRetry }) {
  return (
    <div className="explore-state" role="alert">
      <span className="explore-state-icon explore-state-icon-error">
        <WarningCircle size={28} weight="regular" />
      </span>
      <h2 className="explore-state-title">Couldn&rsquo;t load the library</h2>
      <p className="explore-state-sub">{message || 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <button type="button" className="explore-state-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
