/* The theme the rest of groovesheet.net is showing.

   The blog is served from the same origin as the CRA app, so it reads the same
   localStorage key that src/context/ThemeContext.js writes, and applies it
   before first paint from the root layout. Without that a visitor who chose
   light on /pricing would land on a dark blog and back again.

   One deliberate difference from the main site: when nothing is stored we set
   no data-theme at all, rather than forcing dark. That leaves the
   prefers-color-scheme block in theme.css in charge, which is what /internal
   and the blog already did for a visitor who has never touched the switch. */

export const THEME_STORAGE_KEY = "theme-mode";

/* Mirrors the six custom properties ThemeContext.js sets inline on <html>. */
const DARK_VARS: Record<string, string> = {
  "--bg-primary": "#171717",
  "--bg-secondary": "#2a2a2a",
  "--text-primary": "#ffffff",
  "--text-secondary": "#8d8c8d",
  "--text-muted": "#666666",
  "--border-color": "rgba(255, 255, 255, 0.1)",
};

const LIGHT_VARS: Record<string, string> = {
  "--bg-primary": "#ffffff",
  "--bg-secondary": "#f5f5f5",
  "--text-primary": "#171717",
  "--text-secondary": "#666666",
  "--text-muted": "#999999",
  "--border-color": "rgba(0, 0, 0, 0.1)",
};

/* Inlined in <head>, so it must never throw: storage is unavailable in some
   privacy modes and an exception here would block the page. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');if(m!=='light'&&m!=='dark')return;var d=m==='dark';var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');var v=d?${JSON.stringify(
  DARK_VARS
)}:${JSON.stringify(LIGHT_VARS)};for(var k in v){r.style.setProperty(k,v[k]);}}catch(e){}})();`;

/** Applies a choice at runtime, the way the boot script applies a stored one. */
export function applyTheme(darkMode: boolean): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", darkMode ? "dark" : "light");
  const vars = darkMode ? DARK_VARS : LIGHT_VARS;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}

/** What the page is showing right now: the stored choice, else the OS. */
export function resolveIsDarkMode(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    /* storage unavailable: fall through to the OS preference */
  }
  if (saved === "light") return false;
  if (saved === "dark") return true;
  return !window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function storeTheme(darkMode: boolean): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
  } catch {
    /* the choice still applies for this page view */
  }
}
