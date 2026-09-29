'use client';

import type { FormEvent } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import './ExploreHeader.css';

// Suggested searches, per locale in messages (explore.hero.chip1..4). The
// Chinese ones are artists in the library, checked to return results, since a
// translated "Movie themes" would search English metadata and find nothing.
const TRY_CHIP_KEYS = ['chip1', 'chip2', 'chip3', 'chip4'] as const;

interface ExploreHeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit?: (query: string) => void;
  /** Locale-prefixed /explore/search, the form's no-JavaScript target. */
  action?: string;
}

/**
 * `onSubmit` hands the query to the full results page (/explore/search).
 * Typing still filters the hub's rows live via `onQueryChange`; submitting is
 * what leaves for the paginated, sortable view.
 */
function ExploreHeader({ query, onQueryChange, onSubmit, action = '/explore/search' }: ExploreHeaderProps) {
  const t = useTranslations('explore.hero');
  const tryChips = TRY_CHIP_KEYS.map((k) => t(k));
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit) onSubmit(query);
  };

  return (
    <div className="explore-hero">
      <div className="eh-copy">
        <h1 className="eh-title">{t('title')}</h1>
        {/* Measured 2026-09-29: all 304 tracks have stems, 297 also have MusicXML
            and MIDI. The old line said every track ships in all three formats. */}
        <p className="eh-sub">{t('sub')}</p>
      </div>
      <div className="eh-search">
        {/* action/method make the search work before hydration and without JS. */}
        <form className="eh-search-shell" onSubmit={submit} action={action} method="get">
          <span className="eh-search-icon">
            <MagnifyingGlass size={20} weight="regular" />
          </span>
          <input
            className="eh-search-input"
            name="q"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label={t('searchAria')}
          />
          <button type="submit" className="eh-search-btn">
            {t('search')}
          </button>
        </form>
        <div className="eh-try">
          <span className="eh-try-label">{t('try')}</span>
          {tryChips.map((s) => (
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
