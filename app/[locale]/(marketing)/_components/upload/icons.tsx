// Icons shared by the three upload cards (home, stem splitter, MIDI converter).

/** `clipId` keeps each card's clipPath id unique, as the three CRA copies did. */
export const TrayArrowUpIcon = ({ clipId }: { clipId: string }) => (
  <svg width="64" height="65" viewBox="0 0 64 65" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath={`url(#${clipId})`}>
      <path d="M52 8.5H12C10.9391 8.5 9.92172 8.92143 9.17157 9.67157C8.42143 10.4217 8 11.4391 8 12.5V52.5C8 53.5609 8.42143 54.5783 9.17157 55.3284C9.92172 56.0786 10.9391 56.5 12 56.5H52C53.0609 56.5 54.0783 56.0786 54.8284 55.3284C55.5786 54.5783 56 53.5609 56 52.5V12.5C56 11.4391 55.5786 10.4217 54.8284 9.67157C54.0783 8.92143 53.0609 8.5 52 8.5ZM22.585 25.085L30.585 17.085C30.7707 16.899 30.9913 16.7515 31.2341 16.6509C31.4769 16.5502 31.7372 16.4984 32 16.4984C32.2628 16.4984 32.5231 16.5502 32.7659 16.6509C33.0087 16.7515 33.2293 16.899 33.415 17.085L41.415 25.085C41.6008 25.2708 41.7482 25.4914 41.8488 25.7342C41.9494 25.977 42.0011 26.2372 42.0011 26.5C42.0011 26.7628 41.9494 27.023 41.8488 27.2658C41.7482 27.5086 41.6008 27.7292 41.415 27.915C41.2292 28.1008 41.0086 28.2482 40.7658 28.3488C40.523 28.4494 40.2628 28.5011 40 28.5011C39.7372 28.5011 39.477 28.4494 39.2342 28.3488C38.9914 28.2482 38.7708 28.1008 38.585 27.915L34 23.3275V38.5C34 39.0304 33.7893 39.5391 33.4142 39.9142C33.0391 40.2893 32.5304 40.5 32 40.5C31.4696 40.5 30.9609 40.2893 30.5858 39.9142C30.2107 39.5391 30 39.0304 30 38.5V23.3275L25.415 27.915C25.0397 28.2903 24.5307 28.5011 24 28.5011C23.4693 28.5011 22.9603 28.2903 22.585 27.915C22.2097 27.5397 21.9989 27.0307 21.9989 26.5C21.9989 25.9693 22.2097 25.4603 22.585 25.085ZM52 52.5H12V42.5H19.1725L24 47.3275C24.3701 47.7006 24.8106 47.9963 25.296 48.1976C25.7814 48.3989 26.302 48.5017 26.8275 48.5H37.1725C37.698 48.5017 38.2186 48.3989 38.704 48.1976C39.1894 47.9963 39.6299 47.7006 40 47.3275L44.8275 42.5H52V52.5Z" fill="white" />
    </g>
    <defs>
      <clipPath id={clipId}>
        <rect width="64" height="64" fill="white" transform="translate(0 0.5)" />
      </clipPath>
    </defs>
  </svg>
);

export const MagicWandIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.3333 42.6667L21.3333 50.6667L50.6667 21.3333L42.6667 13.3333L13.3333 42.6667Z" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 10.6667V5.33337" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.3333 32H58.6667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M48 16L51.7333 12.2667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 48L12.2667 51.7333" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.33337 32H10.6667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 16L12.2667 12.2667" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M32 58.6667V53.3334" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M48 48L51.7333 51.7333" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ServerIcon = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="8" width="40" height="16" rx="3" stroke="white" strokeWidth="3" />
    <rect x="12" y="28" width="40" height="16" rx="3" stroke="white" strokeWidth="3" />
    <circle cx="20" cy="16" r="2.5" fill="white" />
    <circle cx="20" cy="36" r="2.5" fill="white" />
    <path d="M32 48V56" stroke="white" strokeWidth="3" strokeLinecap="round" />
    <path d="M22 56H42" stroke="white" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * `size` is accepted so the icon can sit in the same tab list as the
 * react-icons ones; the drawing keeps its own 20px box, as before. fill and
 * stroke width used to come from Tailwind's fill-none and stroke-2 classes.
 */
export const BassIcon = (_props: { size?: number }) => (
  // aria-hidden, and no <title>: the icon sits beside its own text label in
  // the instrument tabs, so a title only repeats it to a screen reader. The
  // one it carried was the Figma export filename, "bass-svg", which is also
  // what a naive HTML parser concatenated onto the page title when reading
  // the tool pages ("... | GrooveSheetbass-svg" in the 2026-09-25 SEO audit).
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" aria-hidden="true" focusable="false">
    <g id="Layer 1">
      <path fillRule="evenodd" d="m11.5 12.5l4.9-4.9"></path>
      <path fillRule="evenodd" d="m21.2 2.9c-0.1-0.1-0.5-0.2-0.6-0.2-0.1-0.1-0.1-0.1-0.4-0.1q-0.2 0-0.3 0.1-0.2 0.1-0.4 0.2l-1.9 1.7c-0.2 0-0.4 0.2-0.5 0.3-0.1 0.1-0.2 0.2-0.3 0.3q0 0.2-0.1 0.3 0 0.2 0 0.4l0.2 0.5c0 0 0 0.3 0 0.3 0 0 0 0.1-0.1 0.2q0 0.2-0.1 0.4-0.1 0.1-0.3 0.3 0.2-0.2 0.3-0.3 0.2-0.1 0.4-0.1 0.1-0.1 0.3-0.2c0.2 0 0.5 0.1 0.6 0.1h0.6q0.2 0 0.3 0 0.2 0 0.4-0.1 0.2-0.1 0.4-0.2c0.1-0.1 0.2-0.1 0.3-0.3 0.2-0.3 0.3-0.7 0.6-1.1 0 0 0.1-0.2 0.7-0.6 0.1-0.1 0.6-0.1 0.6-0.2 0-0.2 0.1-0.2 0-0.3 0-0.1 0-0.4-0.1-0.7-0.2-0.4-0.6-0.7-0.6-0.7z"></path>
      <path d="m6 16l2 2"></path>
      <path id="Layer copy" fillRule="evenodd" d="m9 14l1 1"></path>
      <path fillRule="evenodd" d="m8.1 9.2c1.5-3.4 3.5-3.6 4.2-2.5 0.7 1.2-0.9 2.3 0 3.4 0.7 1 2.1-0.2 1 0.7-2 1.7 2.2 0.1 3.2 1.5 0.6 0.8-0.2 2.3-1.4 2.7l-1.7 0.7c-0.6 0.3-0.6 0.4-0.8 0.5-0.1 0.1-0.2 0.6-0.2 0.6-0.1 0.3-0.1 0.3-0.1 0.9 0 0.2 0 0.5 0 0.6 0 0.5 0 0.8-0.2 1.5-0.2 0.5-0.4 1.1-0.9 1.5-0.4 0.5-0.7 0.6-1.2 0.7-0.6 0.2-1.3 0.3-2 0.1-3-0.9-5.8-3.4-6.2-6.3 0-0.5 0.1-1.3 0.3-1.8 0.3-0.4 0.5-0.8 1.1-1.1 0.4-0.2 0.8-0.4 1.3-0.6 0.5-0.2 0.6-0.3 1.1-0.5 0.2-0.1 0.5-0.2 0.7-0.3q0.2-0.1 0.5-0.2 0.2-0.2 0.4-0.4 0.2-0.2 0.3-0.5z"></path>
    </g>
  </svg>
);
