'use client';

import { MagnifyingGlass } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import StatusMessage from '@/components/ui/StatusMessage';
import './ExploreStates.css';

/** Skeleton placeholder mirroring a Section row of SongCards while the library loads. */
export function SkeletonSection({ cards = 4 }: { cards?: number }) {
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

/** Skeleton placeholder mirroring the results grid while a page loads. */
export function SkeletonGrid({ cards = 8 }: { cards?: number }) {
  return (
    <div className="exsk-grid" aria-hidden="true">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="exsk-card exsk-card-grid">
          <div className="exsk-thumb" />
          <div className="exsk-meta">
            <div className="exsk-line exsk-w60" />
            <div className="exsk-line exsk-w40" />
            <div className="exsk-line exsk-w80" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shown when a search returns no tracks. */
export function ExploreEmpty({ query, onClear }: { query?: string; onClear?: () => void }) {
  const t = useTranslations('explore.states');
  return (
    <div className="explore-state">
      <span className="explore-state-icon">
        <MagnifyingGlass size={28} weight="regular" />
      </span>
      <h2 className="explore-state-title">
        {query ? t('noResults', { query }) : t('empty')}
      </h2>
      <p className="explore-state-sub">
        {query ? t('tryDifferent') : t('checkBack')}
      </p>
      {query && onClear && (
        <button type="button" className="explore-state-btn" onClick={onClear}>
          {t('clear')}
        </button>
      )}
    </div>
  );
}

/** Shown when the library request fails. */
export function ExploreError({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  const t = useTranslations('explore.states');
  return (
    <div className="explore-state">
      <StatusMessage variant="error" title={t('errorTitle')}>
        {message || t('errorBody')}
      </StatusMessage>
      {onRetry && (
        <button type="button" className="explore-state-btn" onClick={onRetry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
