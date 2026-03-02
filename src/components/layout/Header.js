import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Link } from 'react-router-dom';
import './Header.css';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import AccountIcon from '../AccountIcon';
import { useTheme } from '../../context/ThemeContext';

function Header({ onLoginClick }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
  const [productsRect, setProductsRect] = useState(null);
  const productsRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const { isDarkMode, toggleTheme } = useTheme();

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
      if (window.innerWidth > 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobileMenuOpen]);

  return (
    <header className="header">
      <div className="header-container">
        {/* Inner constrained content to align with main page sections (e.g. Pricing) */}
        <div className="header-inner">
          <div className="header-left">
            <Link to="/" className="logo">
              <img
                src={isDarkMode ? '/images/Logo_White.png' : '/images/Logo_Dark.png'}
                alt="DrumScore Logo"
                className="logo-image"
              />
            </Link>
            <nav className="nav-menu">
              <div
                ref={productsRef}
                className={`nav-item dropdown nav-products${isProductsOpen ? ' open' : ''}`}
                onMouseEnter={handleProductsEnter}
                onMouseLeave={handleProductsLeave}
              >
                <span>Products</span>
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
              <a href="/pricing" className="nav-item">
                Pricing
              </a>
              <a href="#help" className="nav-item">
                Help
              </a>
              <Link to="/about" className="nav-item">
                About
              </Link>
              <Link to="/blog" className="nav-item">
                Blog
              </Link>
            </nav>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark/light mode"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
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
            <div className="language-selector desktop-only">
              <span>En</span>
              <svg
                width="16"
                height="10"
                viewBox="0 0 17 10"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8.60986 9.49994L1.10986 1.99994L2.15986 0.949938L8.60986 7.39994L15.0599 0.949938L16.1099 1.99994L8.60986 9.49994Z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <SignedOut>
              <button onClick={openLoginModal} className="login-btn desktop-only">
                Log in
              </button>
            </SignedOut>
            <SignedIn>
              <div className="desktop-only">
                <AccountIcon />
              </div>
            </SignedIn>

            {/* Mobile Hamburger Menu */}
            <button className="hamburger-menu" onClick={toggleMobileMenu} aria-label="Toggle menu">
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
          <a href="/" className="products-dropdown-item">Music Transcription</a>
          <a href="/stem-splitter" className="products-dropdown-item">Stem Splitter</a>
          <a href="/midi-converter" className="products-dropdown-item">MIDI Converter</a>
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
                  className="mobile-nav-item"
                  onClick={() => setIsMobileProductsOpen(!isMobileProductsOpen)}
                >
                  <span>Products</span>
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
                    <a href="/" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      Music Transcription
                    </a>
                    <a href="/stem-splitter" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      Stem Splitter
                    </a>
                    <a href="/midi-converter" className="mobile-nav-item mobile-nav-sub-item" onClick={closeMobileMenu}>
                      MIDI Converter
                    </a>
                  </>
                )}
                <a href="/pricing" className="mobile-nav-item" onClick={closeMobileMenu}>
                  Pricing
                </a>
                <a href="#help" className="mobile-nav-item" onClick={closeMobileMenu}>
                  Help
                </a>
                <Link to="/about" className="mobile-nav-item" onClick={closeMobileMenu}>
                  About
                </Link>
                <Link to="/blog" className="mobile-nav-item" onClick={closeMobileMenu}>
                  Blog
                </Link>
                <div className="mobile-menu-divider"></div>
                <div className="mobile-nav-item">
                  <span>En</span>
                  <svg
                    width="16"
                    height="10"
                    viewBox="0 0 17 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8.60986 9.49994L1.10986 1.99994L2.15986 0.949938L8.60986 7.39994L15.0599 0.949938L16.1099 1.99994L8.60986 9.49994Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <SignedOut>
                  <button onClick={openLoginModal} className="mobile-nav-item">
                    Log in
                  </button>
                </SignedOut>
                <SignedIn>
                  <div
                    className="mobile-nav-item"
                    style={{ display: 'flex', justifyContent: 'flex-start' }}
                  >
                    {/* Use compact AccountIcon to render a simple label (keeps Clerk overlay) */}
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
