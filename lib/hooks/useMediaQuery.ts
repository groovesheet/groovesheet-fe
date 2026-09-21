'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { down, up, between } from '@/lib/breakpoints';

/**
 * Track a media query match.
 *
 * Read synchronously from matchMedia on client renders, so a component
 * mounted after navigation never paints the desktop layout for one frame and
 * then snaps to the mobile one (visible as a flash, and expensive where the
 * consumer re-lays out real content: the OSMD score re-engraves on a zoom
 * change). On the server, and while hydrating server HTML, it is `false`; a
 * component whose markup differs by breakpoint should render inside
 * ClientOnly if that one-frame correction matters.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

// Common breakpoint hooks. Widths come from the shared scale so JS and CSS
// cannot drift apart; see lib/breakpoints.ts.
export const useIsMobile = (): boolean => useMediaQuery(down('md'));
export const useIsTablet = (): boolean => useMediaQuery(between('md', 'lg'));
export const useIsDesktop = (): boolean => useMediaQuery(up('lg'));

/**
 * True on touch-primary devices (phones, tablets). Prefer this over a width
 * breakpoint for anything about *interaction* rather than layout: "drag and
 * drop" is wrong on a phone regardless of how wide the window is, and right on
 * a narrow desktop window.
 */
export const useIsTouch = (): boolean => useMediaQuery('(hover: none) and (pointer: coarse)');
