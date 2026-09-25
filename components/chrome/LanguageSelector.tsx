'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, MagnifyingGlass, Check } from '@phosphor-icons/react';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
  rememberLocaleChoice,
  useLocale,
  useTranslation,
  type CompatT,
  type Locale,
} from '@/lib/i18n';
import './LanguageSelector.css';

interface LocaleItem {
  code: Locale;
  label: string;
  short: string;
}

export const LanguageSelector = ({ compact = false }: { compact?: boolean }) => {
  const { t, i18n } = useTranslation();
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState('');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery('');
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = dropdownRef.current?.offsetWidth || 240;
    const viewportWidth = window.innerWidth;
    const gutter = 12;
    const left = Math.min(
      Math.max(rect.right - menuWidth, gutter),
      viewportWidth - menuWidth - gutter
    );
    setDropdownPosition({ top: rect.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
        setQuery('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handle = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(handle);
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleSelect = (nextLocale: Locale) => {
    closeDropdown();
    // Record the choice even when it matches the current locale: the visitor
    // may have been sent here by the country-based redirect, and picking a
    // language explicitly should stop that redirect deciding for them.
    rememberLocaleChoice(nextLocale);
    if (nextLocale === locale) return;
    // Navigates to the same path (query and hash kept) in the new locale.
    i18n.changeLanguage(nextLocale);
  };

  const items: LocaleItem[] = SUPPORTED_LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code],
    short: LOCALE_SHORT_LABELS[code],
  }));

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalizedQuery) ||
          item.code.toLowerCase().includes(normalizedQuery)
      )
    : items;

  const shortLabel = LOCALE_SHORT_LABELS[locale] || 'EN';

  if (compact) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={toggleDropdown}
          className="language-selector compact"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={t('language.selectAria')}
        >
          <span>{shortLabel}</span>
          <CaretDown size={16} weight="bold" />
        </button>
        {isOpen &&
          createPortal(
            <>
              <div className="language-dropdown-backdrop" onClick={closeDropdown} />
              <div
                ref={dropdownRef}
                className="language-dropdown-menu mobile"
                role="listbox"
              >
                <DropdownBody
                  inputRef={inputRef}
                  query={query}
                  setQuery={setQuery}
                  filtered={filtered}
                  locale={locale}
                  onSelect={handleSelect}
                  t={t}
                />
              </div>
            </>,
            document.body
          )}
      </>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleDropdown}
        className="language-selector"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('language.selectAria')}
      >
        <span>{shortLabel}</span>
        <CaretDown size={16} weight="bold" />
      </button>
      {isOpen &&
        createPortal(
          <>
            <div className="language-dropdown-backdrop" onClick={closeDropdown} />
            <div
              ref={dropdownRef}
              className="language-dropdown-menu desktop"
              role="listbox"
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
              <DropdownBody
                inputRef={inputRef}
                query={query}
                setQuery={setQuery}
                filtered={filtered}
                locale={locale}
                onSelect={handleSelect}
                t={t}
              />
            </div>
          </>,
          document.body
        )}
    </>
  );
};

interface DropdownBodyProps {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (value: string) => void;
  filtered: LocaleItem[];
  locale: Locale;
  onSelect: (locale: Locale) => void;
  t: CompatT;
}

function DropdownBody({ inputRef, query, setQuery, filtered, locale, onSelect, t }: DropdownBodyProps) {
  return (
    <>
      <div className="language-dropdown-search">
        <MagnifyingGlass size={16} weight="bold" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('language.searchPlaceholder')}
          aria-label={t('language.searchPlaceholder')}
        />
      </div>
      <div className="language-dropdown-list">
        {filtered.length > 0 ? (
          filtered.map((item) => {
            const selected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={selected}
                className={`language-dropdown-item${selected ? ' selected' : ''}`}
                onClick={() => onSelect(item.code)}
              >
                <span className="language-dropdown-item-label">{item.label}</span>
                {selected && <Check size={16} weight="bold" />}
              </button>
            );
          })
        ) : (
          <div className="language-dropdown-empty">{t('language.noResults')}</div>
        )}
      </div>
    </>
  );
}

export default LanguageSelector;
