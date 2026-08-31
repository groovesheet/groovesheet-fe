import { useState, useEffect } from 'react';
import { down, up, between } from '../styles/breakpoints';

/**
 * Custom hook to track media query matches
 * @param {string} query - Media query string (e.g., '(min-width: 768px)')
 * @returns {boolean} Whether the media query matches
 */
export function useMediaQuery(query) {
  // Seed from matchMedia during the first render. Defaulting to `false` made
  // every consumer paint the desktop layout for one frame and then snap to the
  // mobile one — visible as a flash, and expensive where the consumer re-lays
  // out real content (the OSMD score re-engraves on a zoom change).
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);

    // Re-sync in case the query changed between render and effect
    setMatches(media.matches);

    // Create event listener
    const listener = (e) => setMatches(e.matches);

    // Add listener
    media.addEventListener('change', listener);

    // Cleanup
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Common breakpoint hooks. Widths come from the shared scale so JS and CSS
// cannot drift apart — see src/styles/breakpoints.js.
export const useIsMobile = () => useMediaQuery(down('md'));
export const useIsTablet = () => useMediaQuery(between('md', 'lg'));
export const useIsDesktop = () => useMediaQuery(up('lg'));

/**
 * True on touch-primary devices (phones, tablets). Prefer this over a width
 * breakpoint for anything about *interaction* rather than layout — "drag and
 * drop" is wrong on a phone regardless of how wide the window is, and right on
 * a narrow desktop window.
 */
export const useIsTouch = () => useMediaQuery('(hover: none) and (pointer: coarse)');
