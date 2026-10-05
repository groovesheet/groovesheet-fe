'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { FaqCategory } from './helpData';

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

/** macOS and iOS put the shortcut on Command; everything else uses Control. */
function isApplePlatform(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent;
  return /mac|iphone|ipad|ipod/i.test(platform);
}

// The platform never changes while the page is open, so there is nothing to subscribe to.
const subscribeNever = () => () => {};

/** A field the visitor may be typing in, where a shortcut must not steal focus. */
function isOtherEditable(target: EventTarget | null, own: HTMLInputElement | null): boolean {
  if (!(target instanceof HTMLElement) || target === own) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

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
 * the browser. `heading` is the server-rendered title block above the box,
 * and `faq` is the FAQ in the page's locale, built on the server.
 */
export default function HelpSearchFaq({ heading, faq }: { heading: ReactNode; faq: FaqCategory[] }) {
  const t = useTranslations('help.search');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  // Unknown (null) on the server and while hydrating, which cannot know the
  // platform, so the badge stays hidden instead of mismatching; read from the
  // browser on the render right after hydration.
  const apple = useSyncExternalStore<boolean | null>(subscribeNever, isApplePlatform, () => null);

  // Cmd+K on Apple platforms, Ctrl+K elsewhere, focuses and selects the search
  // box. Left alone while another field has focus, so it never interrupts
  // typing somewhere else on the page.
  useEffect(() => {
    const mac = isApplePlatform();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== 'k' || !(mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)) return;
      const input = inputRef.current;
      if (!input || isOtherEditable(e.target, input)) return;
      e.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggle = (id: string) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo<SearchResult[]>(() => {
    if (!searching) return [];
    const ql = trimmed.toLowerCase();
    const out: SearchResult[] = [];
    faq.forEach((cat) => {
      cat.items.forEach((it, i) => {
        if ((it.q + ' ' + it.a).toLowerCase().includes(ql)) {
          out.push({ ...it, id: `r-${cat.id}-${i}`, catLabel: cat.label });
        }
      });
    });
    return out;
  }, [searching, trimmed, faq]);

  const showBrowse = !searching;
  const showResults = searching && results.length > 0;
  const showNoResults = searching && results.length === 0;
  const resultLabel = t('resultCount', { count: results.length, query: trimmed });

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
            ref={inputRef}
            type="text"
            className="help-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('aria')}
            aria-keyshortcuts={apple === null ? undefined : apple ? 'Meta+K' : 'Control+K'}
          />
          <div className="help-search-trailing">
            {searching && (
              <button className="help-search-clear" onClick={clearSearch} aria-label={t('clear')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
            <kbd className="help-search-kbd" aria-hidden="true" data-ready={apple !== null}>
              {apple === false ? 'Ctrl K' : '\u2318K'}
            </kbd>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="help-faq">
        {(showResults || showNoResults) && (
          <p className="help-result-count">{showResults ? resultLabel : t('noResultsTitle', { query: trimmed })}</p>
        )}

        {showBrowse && (
          <div className="help-browse">
            {faq.map((cat) => (
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
            <h3>{t('noResultsTitle', { query: trimmed })}</h3>
            <p>{t('noResultsBody')}</p>
            <div className="help-noresults-actions">
              <a href="#contact" className="help-btn-primary">
                {t('contactSupport')}
              </a>
              <button className="help-btn-ghost" onClick={clearSearch}>
                {t('clearSearch')}
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
