/**
 * The one breakpoint scale for the app.
 *
 * CSS media queries cannot read custom properties, so the same numbers are
 * mirrored as a comment block at the top of `tokens.css`. If you change a
 * value here, change it there and in the stylesheets that use it.
 *
 * Two kinds of breakpoint exist and they are not interchangeable:
 *
 *   SCALE   — viewport-tier decisions (is this a phone / tablet / desktop?).
 *             Use these for anything about the device class.
 *
 *   CONTENT — a single documented point where two-column editorial content
 *             stops fitting. Kept off the scale on purpose: it is a property
 *             of the content, not of the device, and forcing it to 1024 would
 *             collapse those layouts on tablets that have room for them.
 *
 * Before this scale existed the stylesheets used thirteen different widths
 * (480/560/640/720/768/860/900/960/1024/1200/1280/1400/1440), most of them
 * near-duplicates of each other.
 */

export const BREAKPOINTS = {
  xs: 480,   // small phone
  sm: 640,   // large phone
  md: 768,   // phone landscape / small tablet — the main mobile cutoff
  lg: 1024,  // tablet landscape / small laptop — where the desktop nav appears
  xl: 1280,  // desktop
  xxl: 1440, // wide desktop
};

/**
 * Two-column editorial content collapses here. Not a device tier.
 * Used by About, ApiPage, PreviewPanel and HelpSupport.
 *
 * When folding an old collapse breakpoint onto this scale, always fold UP —
 * so the layout collapses earlier than the original author chose, never later.
 * Folding down leaves a band where the content is more cramped than intended.
 */
export const CONTENT_BREAKPOINT = 900;

/** `(max-width: 768px)` — everything at or below this tier. */
export const down = (key) => `(max-width: ${BREAKPOINTS[key]}px)`;

/** `(min-width: 769px)` — everything above this tier. */
export const up = (key) => `(min-width: ${BREAKPOINTS[key] + 1}px)`;

/** `(min-width: 769px) and (max-width: 1024px)` — one tier band. */
export const between = (lower, upper) =>
  `(min-width: ${BREAKPOINTS[lower] + 1}px) and (max-width: ${BREAKPOINTS[upper]}px)`;

export default BREAKPOINTS;
