/**
 * Server-safe half of lib/theme.tsx: the variables and the inline script the
 * root layout runs before first paint. Kept out of the 'use client' module
 * because a Server Component importing a string from one gets a client
 * reference, not the string.
 */

export const THEME_STORAGE_KEY = 'theme-mode';

export const DARK_VARS: Record<string, string> = {
  '--bg-primary': '#171717',
  '--bg-secondary': '#2a2a2a',
  '--text-primary': '#ffffff',
  '--text-secondary': '#8d8c8d',
  '--text-muted': '#666666',
  '--border-color': 'rgba(255, 255, 255, 0.1)',
};

export const LIGHT_VARS: Record<string, string> = {
  '--bg-primary': '#ffffff',
  '--bg-secondary': '#f5f5f5',
  '--text-primary': '#171717',
  '--text-secondary': '#666666',
  '--text-muted': '#999999',
  '--border-color': 'rgba(0, 0, 0, 0.1)',
};

/**
 * Runs before hydration, from the root layout. Kept as a string so it can be
 * inlined; it must not throw (storage can be unavailable).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');var d=m!=='light';var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');var v=d?${JSON.stringify(DARK_VARS)}:${JSON.stringify(LIGHT_VARS)};for(var k in v){r.style.setProperty(k,v[k]);}}catch(e){}})();`;

