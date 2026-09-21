'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { FAQ_DATA } from './helpData';

const ChevronIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SearchIcon = ({ size = 22, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

interface SearchResult {
  id: string;
  q: string;
  a: string;
  catLabel: string;
}

/**
 * The help page's search box and the FAQ it filters. The CRA page showed a
 * 750ms skeleton before the FAQ, which kept every answer out of the first
 * HTML; here the full list is rendered on the server and search narrows it in
 * the browser. `heading` is the server-rendered title block above the box.
 */
export default function HelpSearchFaq({ heading }: { heading: ReactNode }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo<SearchResult[]>(() => {
    if (!searching) return [];
    const ql = trimmed.toLowerCase();
    const out: SearchResult[] = [];
    FAQ_DATA.forEach((cat) => {
      cat.items.forEach((it, i) => {
        if ((it.q + ' ' + it.a).toLowerCase().includes(ql)) {
          out.push({ ...it, id: `r-${cat.id}-${i}`, catLabel: cat.label });
        }
      });
    });
    return out;
  }, [searching, trimmed]);

  const showBrowse = !searching;
  const showResults = searching && results.length > 0;
  const showNoResults = searching && results.length === 0;
  const resultLabel = `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${trimmed}”`;

  const clearSearch = () => setQuery('');

  return (
    <>
      {/* Hero + search */}
      <section id="top" className="help-hero">
        {heading}

        <div className="help-search">
          <span className="help-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="help-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={'Search help \u2014 minutes, formats, publishing…'}
            aria-label="Search help"
          />
          <div className="help-search-trailing">
            {searching && (
              <button className="help-search-clear" onClick={clearSearch} aria-label="Clear">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <span className="help-search-kbd">{'⌘'}K</span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="help-faq">
        {(showResults || showNoResults) && (
          <p className="help-result-count">{showResults ? resultLabel : `No results for “${trimmed}”`}</p>
        )}

        {showBrowse && (
          <div className="help-browse">
            {FAQ_DATA.map((cat) => (
              <section key={cat.id} id={`cat-${cat.id}`} className="help-cat">
                <div className="help-cat-label">
                  <h3>{cat.label}</h3>
                </div>
                <div className="help-cat-items">
                  {cat.items.map((it, i) => {
                    const id = `${cat.id}-${i}`;
                    const isOpen = !!open[id];
                    return (
                      <div key={id} className="help-item" data-open={isOpen}>
                        <button className="help-item-btn" onClick={() => toggle(id)} aria-expanded={isOpen}>
                          <span className="help-item-q">{it.q}</span>
                          <span className={`help-item-chevron${isOpen ? ' open' : ''}`}>
                            <ChevronIcon />
                          </span>
                        </button>
                        <div className={`help-item-answer${isOpen ? ' open' : ''}`}>
                          <p>{it.a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            <div className="help-browse-end" />
          </div>
        )}

        {showResults && (
          <div className="help-results">
            {results.map((it) => {
              const isOpen = !!open[it.id];
              return (
                <div key={it.id} className="help-result" data-open={isOpen}>
                  <button className="help-result-btn" onClick={() => toggle(it.id)} aria-expanded={isOpen}>
                    <div className="help-result-head">
                      <span className="help-result-cat">{it.catLabel}</span>
                      <div className="help-result-q">{it.q}</div>
                    </div>
                    <span className={`help-item-chevron${isOpen ? ' open' : ''}`}>
                      <ChevronIcon size={20} />
                    </span>
                  </button>
                  <div className={`help-item-answer${isOpen ? ' open' : ''}`}>
                    <p>{it.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showNoResults && (
          <div className="help-noresults">
            <div className="help-noresults-icon">
              <SearchIcon size={30} strokeWidth={1.7} />
            </div>
            <h3>No results for {`“${trimmed}”`}</h3>
            <p>We couldn&apos;t find a matching answer. Reach us directly {'\u2014'} we usually reply within a day.</p>
            <div className="help-noresults-actions">
              <a href="#contact" className="help-btn-primary">
                Contact support
              </a>
              <button className="help-btn-ghost" onClick={clearSearch}>
                Clear search
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
