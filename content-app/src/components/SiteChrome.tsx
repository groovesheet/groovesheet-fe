/* The GrooveSheet header and footer.

   The real ones are groovesheet-fe/src/components/layout/Header.js and
   Footer.js (ported to gs-fe-next/components/chrome/). content-app is a
   separate Next.js build with no shared module graph, so they cannot be
   imported; the markup, class names and behaviour are copied here and the
   stylesheets verbatim into SiteChrome.css.

   Three things the real ones do that this app cannot:
     - auth. There is no Supabase client here, so only the signed-out state
       exists and "Log in" is a link to the main site, where the modal lives.
     - next-intl. Every string is English and every link that leaves this app
       is a plain <a>, because a client-side navigation to /pricing would 404
       inside this build. next/link is only for /blog.
     - the language selector, left out because the blog is English-only.

   The theme is shared: the blog is on the same origin as the rest of
   groovesheet.net and reads the same localStorage key. See lib/themeBoot.ts. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FOOTER_SOCIALS } from "@/components/footerSocials";
import { applyTheme, resolveIsDarkMode, storeTheme } from "@/lib/themeBoot";
import "./SiteChrome.css";

/* The breakpoint Header.css uses to swap the nav for the hamburger. */
const DESKTOP_MIN_WIDTH = 1024;

/* Every route below belongs to the CRA app, not this one. */
const PRODUCTS = [
  { href: "/", label: "Music Transcription" },
  { href: "/stem-splitter", label: "Stem Splitter" },
  { href: "/midi-converter", label: "MIDI Converter" },
];

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
];

const CHEVRON_PATH =
  "M8.10986 9.49994L0.609863 1.99994L1.65986 0.949938L8.10986 7.39994L14.5599 0.949938L15.6099 1.99994L8.10986 9.49994Z";

/** Both wordmarks, with CSS picking one. See the note in SiteChrome.css. */
function Wordmark({ className }: { className: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/Logo_White.png"
        alt="GrooveSheet"
        className={`${className} gs-logo--on-dark`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/Logo_Dark.png" alt="" aria-hidden className={`${className} gs-logo--on-light`} />
    </>
  );
}

export function SiteHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
  const [productsRect, setProductsRect] = useState<DOMRect | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const headerRef = useRef<HTMLElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleProductsEnter = () => {
    clearTimeout(closeTimeoutRef.current);
    if (productsRef.current) setProductsRect(productsRef.current.getBoundingClientRect());
    setIsProductsOpen(true);
  };

  const handleProductsLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setIsProductsOpen(false), 80);
  };

  // Catch up with whatever the boot script already applied, so the sun/moon
  // glyph matches the page a visitor is actually looking at.
  useEffect(() => {
    setIsDarkMode(resolveIsDarkMode());
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      applyTheme(next);
      storeTheme(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > DESKTOP_MIN_WIDTH) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Publish the real header height so the full-screen mobile menu can start
  // below it, otherwise the sheet covers the hamburger and there is no way
  // left to close it. Measured rather than hardcoded because the header grows
  // and shrinks with the logo size across breakpoints.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const publish = () => {
      document.documentElement.style.setProperty(
        "--gs-header-h",
        `${Math.round(el.getBoundingClientRect().height)}px`
      );
    };
    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, []);

  // Lock the page behind the mobile menu. Without this the body kept
  // scrolling under the open sheet, which on a phone reads as the menu
  // sliding away from you while you try to tap it.
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
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
            <a href="/" className="logo" aria-label="GrooveSheet">
              <Wordmark className="logo-image" />
            </a>
            <nav className="nav-menu">
              <div
                ref={productsRef}
                className={`nav-item dropdown nav-products${isProductsOpen ? " open" : ""}`}
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
                  <path d={CHEVRON_PATH} fill="currentColor" />
                </svg>
              </div>
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="nav-item">
                  {item.label}
                </a>
              ))}
              <Link href="/blog" className="nav-item active">
                Blog
              </Link>
            </nav>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Toggle dark/light mode"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            {/* The main site opens a modal here. This app has no auth client,
                so it sends people to the page that does. */}
            <a href="/" className="login-btn desktop-only">
              Log in
            </a>

            {/* Mobile Hamburger Menu */}
            <button
              className="hamburger-menu"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Dropdown - Rendered using Portal to escape stacking contexts */}
      {isProductsOpen &&
        productsRect &&
        createPortal(
          <div
            className="products-dropdown"
            style={{
              position: "fixed",
              top: productsRect.bottom + 6,
              left: productsRect.left,
              zIndex: 2147483647,
            }}
            onMouseEnter={handleProductsEnter}
            onMouseLeave={handleProductsLeave}
          >
            {PRODUCTS.map((item) => (
              <a key={item.href} href={item.href} className="products-dropdown-item">
                {item.label}
              </a>
            ))}
          </div>,
          document.body
        )}

      {/* Mobile Menu Dropdown - Rendered using Portal */}
      {isMobileMenuOpen &&
        createPortal(
          <>
            {/* Backdrop overlay to close menu when clicking outside */}
            <div
              className="mobile-menu-backdrop"
              onClick={closeMobileMenu}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999,
                background: "transparent",
              }}
            />
            <div className="mobile-menu-dropdown" style={{ position: "fixed", zIndex: 2147483647 }}>
              <div className="mobile-menu-content">
                <div
                  className="mobile-nav-item"
                  onClick={() => setIsMobileProductsOpen((open) => !open)}
                >
                  <span>Products</span>
                  <svg
                    className={`dropdown-arrow${isMobileProductsOpen ? " open" : ""}`}
                    width="14"
                    height="9"
                    viewBox="0 0 17 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d={CHEVRON_PATH} fill="currentColor" />
                  </svg>
                </div>
                {isMobileProductsOpen &&
                  PRODUCTS.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="mobile-nav-item mobile-nav-sub-item"
                      onClick={closeMobileMenu}
                    >
                      {item.label}
                    </a>
                  ))}
                {NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="mobile-nav-item"
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </a>
                ))}
                <Link href="/blog" className="mobile-nav-item active" onClick={closeMobileMenu}>
                  Blog
                </Link>
                <div className="mobile-menu-divider"></div>
                <a href="/" className="mobile-nav-item" onClick={closeMobileMenu}>
                  Log in
                </a>
              </div>
            </div>
          </>,
          document.body
        )}
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-main">
          <div className="footer-brand">
            <div className="footer-logo">
              <Wordmark className="footer-logo-img" />
            </div>
            <div className="footer-social">
              <div className="social-icons">
                {FOOTER_SOCIALS.map((icon) => (
                  <a key={icon.name} href={icon.href} className="social-icon" aria-label={icon.name}>
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 256 256"
                      fill="currentColor"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d={icon.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h3>Explore</h3>
              {/* Placeholders in the live footer too: the CRA Footer.js points
                  these at fragments that no page defines. Copied as they are
                  rather than invented. */}
              <a href="#pricing">Pricing</a>
              <a href="#api">API</a>
              <a href="/help">Help</a>
              <a href="/help">Support</a>
              <a href="#changelog">Changelog</a>
            </div>

            <div className="footer-column">
              <h3>Apps</h3>
              <a href="#desktop">Desktop App</a>
              <a href="#ios">iOS App</a>
              <a href="#android">Android App</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <a href="/business-information" className="copyright">
              &copy; {year} GrooveSheet
            </a>
            <div className="footer-legal">
              <a href="/terms">Terms &amp; Conditions</a>
              <a href="/privacy-policy">Privacy Policy</a>
              <a href="/refund-policy">Refund Policy</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SunIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line
        x1="18.36"
        y1="18.36"
        x2="19.78"
        y2="19.78"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line
        x1="4.22"
        y1="19.78"
        x2="5.64"
        y2="18.36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="currentColor" />
    </svg>
  );
}
