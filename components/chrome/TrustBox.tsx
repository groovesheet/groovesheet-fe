'use client';

import { useEffect, useRef } from 'react';

/**
 * Official Trustpilot TrustBox widget.
 *
 * The bootstrap script is loaded once by the root layout. It only auto-renders
 * widgets present when it runs, so on mount we ask Trustpilot to (re)render
 * this instance.
 *
 * Widget: Review Collector (Showcase). Theme forced to dark.
 */
export default function TrustBox({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && window.Trustpilot) {
      window.Trustpilot.loadFromElement(ref.current, true);
    }
  }, []);

  return (
    <div
      ref={ref}
      className={`trustpilot-widget${className ? ` ${className}` : ''}`}
      data-locale="en-US"
      data-template-id="56278e9abfbbba0bdcd568bc"
      data-businessunit-id="6a0a8762b5e8fbc1fc6a990d"
      data-style-height="52px"
      data-style-width="100%"
      data-theme="dark"
      data-token="a90e4c6f-8eef-4437-ac8d-6bdbe3822032"
    >
      <a href="https://www.trustpilot.com/review/groovesheet.net" target="_blank" rel="noopener noreferrer">
        Trustpilot
      </a>
    </div>
  );
}
