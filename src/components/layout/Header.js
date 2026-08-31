import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './Header.css';
import { SignedIn, SignedOut } from '../../auth';
import AccountIcon from '../AccountIcon';
import { useTheme } from '../../context/ThemeContext';
import { BREAKPOINTS } from '../../styles/breakpoints';
import { LocalizedLink, stripLocaleFromPath } from '../../i18n/locale';
import { LanguageSelector } from '../LanguageSelector';

function Header({ onLoginClick }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
  const [productsRect, setProductsRect] = useState(null);
  const productsRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const localePathname = stripLocaleFromPath(pathname);
  const isActive = (path) => localePathname === path;
  const productsPaths = ['/', '/stem-splitter', '/midi-converter'];
  const isProductsActive = productsPaths.includes(localePathname);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleProductsEnter = () => {
    clearTimeout(closeTimeoutRef.current);
    if (productsRef.current) {
      setProductsRect(productsRef.current.getBoundingClientRect());
    }
    setIsProductsOpen(true);
  };

  const handleProductsLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setIsProductsOpen(false), 80);
  };

  const openLoginModal = (e) => {
    e.preventDefault();
    setIsMobileMenuOpen(false); // Close mobile menu when opening login
    if (onLoginClick) {
      onLoginClick();
    }
  };

  useEffect(() => {
    // Close mobile menu when viewport is resized to desktop size
    const handleResize = () => {
      if (window.innerWidth > BREAKPOINTS.lg && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  // Publish the real header height so the full-screen mobile menu can start
  // below it — otherwise the sheet covers the hamburger and there is no way
  // left to close it. Measured rather than hardcoded because the header grows
  // and shrinks with the logo size across breakpoints.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () => {
      document.documentElement.style.setProperty(
        '--gs-header-h',
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    };
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  // Lock the page behind the mobile menu. Without this the body kept
  // scrolling under the open sheet, which on a phone reads as the menu
  // sliding away from you while you try to tap it.
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="header" ref={headerRef}>
      <div className="header-container">
        {/* Inner constrained content to align with main page sections (e.g. Pricing) */}
        <div className="header-inner">
          <div className="header-left">
            <LocalizedLink to="/" className="logo">
              <img
                src={isDarkMode ? '/images/Logo_White.png' : '/images/Logo_Dark.png'}
                alt="GrooveSheet Logo"
                className="logo-image"
              />
            </LocalizedLink>
            <nav className="nav-menu">
              <div
                ref={productsRef}
                className={`nav-item dropdown nav-products${isProductsOpen ? ' open' : ''}${isProductsActive ? ' active' : ''}`}
                onMouseEnter={handleProductsEnter}
                onMouseLeave={handleProductsLeave}
              >
                <span>{t('nav.products')}</span>
                <svg
                  className="dropdown-arrow"
                  width="16"
                  height="10"
                  viewBox="0 0 17 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8.10986 9.49994L0.609863 1.99994L1.65986 0.949938L8.10986 7.39994L14.5599 0.949938L15.6099 1.99994L8.10986 9.49994Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <LocalizedLink to="/explore" className={`nav-item${isActive('/explore') ? ' active' : ''}`}>
                {t('nav.explore')}
              </LocalizedLink>
              <LocalizedLink to="/pricing" className={`nav-item${isActive('/pricing') ? ' active' : ''}`}>
                {t('nav.pricing')}
              </LocalizedLink>
              <LocalizedLink to="/help" className={`nav-item${isActive('/help') ? ' active' : ''}`}>
                {t('nav.help')}
              </LocalizedLink>
              <LocalizedLink to="/about" className={`nav-item${isActive('/about') ? ' active' : ''}`}>
                {t('nav.about')}
              </LocalizedLink>
              <LocalizedLink to="/blog" className={`nav-item${isActive('/blog') ? ' active' : ''}`}>
                {t('nav.blog')}
              </LocalizedLink>
            </nav>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={t('theme.toggleAria')}
              title={isDarkMode ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {isDarkMode ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="5" fill="currentColor" />
                  <line
                    x1="12"
                    y1="1"
                    x2="12"
                    y2="3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="12"
                    y1="21"
                    x2="12"
                    y2="23"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="4.22"
                    y1="4.22"
                    x2="5.64"
                    y2="5.64"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="18.36"
                    y1="18.36"
                    x2="19.78"
                    y2="19.78"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="1"
                    y1="12"
                    x2="3"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="21"
                    y1="12"
                    x2="23"
                    y2="12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="4.22"
                    y1="19.78"
                    x2="5.64"
                    y2="18.36"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="18.36"
                    y1="5.64"
                    x2="19.78"
                    y2="4.22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor" />
                </svg>
              )}
            </button>
            <div className="desktop-only">
              <LanguageSelector />
            </div>
            <SignedOut>
              <button onClick={openLoginModal} className="login-btn desktop-only">
                {t('nav.login')}
              </button>
            </SignedOut>
            <SignedIn>
              <div className="desktop-only">
                <AccountIcon />
              </div>
            </SignedIn>

            {/* Mobile Hamburger Menu */}
            <button className="hamburger-menu" onClick={toggleMobileMenu} aria-label={t('nav.toggleMenuAria')}>
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Dropdown - Rendered using Portal to escape stacking contexts */}
      {isProductsOpen && productsRect && ReactDOM.createPortal(
        <div
          className="products-dropdown"
          style={{
            position: 'fixed',
            top: productsRect.bottom + 6,
            left: productsRect.left,
            zIndex: 2147483647,
          }}
          onMouseEnter={handleProductsEnter}
          onMouseLeave={handleProductsLeave}
        >
          <LocalizedLink to="/" className="products-dropdown-item">{t('nav.musicTranscription')}</LocalizedLink>
          <LocalizedLink to="/stem-splitter" className="products-dropdown-item">{t('nav.stemSplitter')}</LocalizedLink>
          <LocalizedLink to="/midi-converter" className="products-dropdown-item">{t('nav.midiConverter')}</LocalizedLink>
        </div>,
        document.body
      )}

      {/* Mobile Menu Dropdown - Rendered using Portal */}
      {isMobileMenuOpen &&
        ReactDOM.createPortal(
          <>
            {/* Backdrop overlay to close menu when clicking outside */}
            <div
              className="mobile-menu-backdrop"
              onClick={closeMobileMenu}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999,
                background: 'transparent',
              }}
            />
            <div
              className="mobile-menu-dropdown"
              style={{
                position: 'fixed',
                zIndex: 2147483647,
              }}
            >
              <div className="mobile-menu-content">
                <div
                  className={`mobile-nav-item${isProductsActive ? ' active' : ''}`}
                  onClick={() => setIsMobileProductsOpen(!isMobileProductsOpen)}
                >
                  <span>{t('nav.products')}</span>
                  <svg
                    className={`dropdown-arrow${isMobileProductsOpen ? ' open' : ''}`}
                    width="14"
                    height="9"
                    viewBox="0 0 17 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.10986 9.49994L0.609863 1.99994L1.65986 0.949938L8.10986 7.39994L14.5599 0.949938L15.6099 1.99994L8.10986 9.49994Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                {isMobileProductsOpen && (
                  <>
                    <LocalizedLink to="/" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      {t('nav.musicTranscription')}
                    </LocalizedLink>
                    <LocalizedLink to="/stem-splitter" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      {t('nav.stemSplitter')}
                    </LocalizedLink>
                    <LocalizedLink to="/midi-converter" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      {t('nav.midiConverter')}
                    </LocalizedLink>
                  </>
                )}
                <LocalizedLink to="/explore" className={`mobile-nav-item${isActive('/explore') ? ' active' : ''}`} onClick={closeMobileMenu}>
                  {t('nav.explore')}
                </LocalizedLink>
                <LocalizedLink to="/pricing" className={`mobile-nav-item${isActive('/pricing') ? ' active' : ''}`} onClick={closeMobileMenu}>
                  {t('nav.pricing')}
                </LocalizedLink>
                <LocalizedLink to="/help" className={`mobile-nav-item${isActive('/help') ? ' active' : ''}`} onClick={closeMobileMenu}>
                  {t('nav.help')}
                </LocalizedLink>
                <LocalizedLink to="/about" className={`mobile-nav-item${isActive('/about') ? ' active' : ''}`} onClick={closeMobileMenu}>
                  {t('nav.about')}
                </LocalizedLink>
                <LocalizedLink to="/blog" className={`mobile-nav-item${isActive('/blog') ? ' active' : ''}`} onClick={closeMobileMenu}>
                  {t('nav.blog')}
                </LocalizedLink>
                <div className="mobile-menu-divider"></div>
                <div className="mobile-nav-item mobile-language-row">
                  <LanguageSelector compact />
                </div>
                <SignedOut>
                  <button onClick={openLoginModal} className="mobile-nav-item">
                    {t('nav.login')}
                  </button>
                </SignedOut>
                <SignedIn>
                  <div
                    className="mobile-nav-item"
                    style={{ display: 'flex', justifyContent: 'flex-start' }}
                  >
                    {/* Use compact AccountIcon to render a simple label (keeps account menu) */}
                    <AccountIcon compact />
                  </div>
                </SignedIn>
              </div>
            </div>
          </>,
          document.body
        )}
    </header>
  );
}

export default Header;
