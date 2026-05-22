import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CaretDown, MagnifyingGlass, Check } from '@phosphor-icons/react';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  LOCALE_SHORT_LABELS,
} from '../i18n';
import { useLocale, stripLocaleFromPath, buildLocalePath } from '../i18n/locale';
import './LanguageSelector.css';

export const LanguageSelector = ({ compact = false }) => {
  const { t, i18n } = useTranslation();
  const locale = useLocale();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState('');

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery('');
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  const updatePosition = () => {
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
  };

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
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        closeDropdown();
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
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen) closeDropdown();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const handleSelect = (nextLocale) => {
    closeDropdown();
    if (nextLocale === locale) return;
    if (i18n.language !== nextLocale) i18n.changeLanguage(nextLocale);
    if (typeof localStorage !== 'undefined') localStorage.setItem('i18nextLng', nextLocale);
    const basePath = stripLocaleFromPath(pathname);
    const nextPath = buildLocalePath(nextLocale, basePath);
    navigate({ pathname: nextPath, search: search || '', hash: hash || '' });
  };

  const items = SUPPORTED_LOCALES.map((code) => ({
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
          ReactDOM.createPortal(
            <>
              <div className="language-dropdown-backdrop" onClick={closeDropdown} />
              <div
                ref={dropdownRef}
                className="language-dropdown-menu mobile"
                role="listbox"
              >
                {renderDropdownBody({
                  inputRef,
                  query,
                  setQuery,
                  filtered,
                  locale,
                  onSelect: handleSelect,
                  t,
                })}
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
        ReactDOM.createPortal(
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
              {renderDropdownBody({
                inputRef,
                query,
                setQuery,
                filtered,
                locale,
                onSelect: handleSelect,
                t,
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
};

function renderDropdownBody({ inputRef, query, setQuery, filtered, locale, onSelect, t }) {
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
