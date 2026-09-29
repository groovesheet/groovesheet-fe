'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Google's "Add to Preferred Sources" button, shown in the footer on the
 * informational pages only. Once a reader adds groovesheet.net, Google
 * favours it in Top Stories and AI Mode for them. The blog has its own copy in
 * content-app. https://developers.google.com/search/docs/appearance/preferred-sources
 *
 * publisher.js inflates `[google-add-preferred-source-btn]` divs only when its
 * init() runs, and fixes the theme at that moment. So the div is re-created
 * (keyed on theme and path) when the theme flips or the route changes, and
 * init() is queued again through PREFERRED_SOURCE, which runs at once when the
 * library is loaded and is replayed by it before then.
 */
const PATHS = /^(\/[a-z]{2}(-[a-z]{2})?)?\/(about|help|changelog|compare|business-information|developers)(\/|$)/i;

const LIB = 'https://news.google.com/swg/js/v1/publisher.js';

type PreferredSourceApi = { init: () => void };
type PreferredSourceQueue = { push: (fn: (api: PreferredSourceApi) => void) => void };

export default function PreferredSourceButton({ dark }: { dark: boolean }) {
  const pathname = usePathname() ?? '';
  const show = PATHS.test(pathname);
  const theme = dark ? 'dark' : 'light';

  useEffect(() => {
    if (!show) return;
    if (!document.querySelector(`script[src="${LIB}"]`)) {
      const s = document.createElement('script');
      s.async = true;
      s.src = LIB;
      document.head.appendChild(s);
    }
    const w = window as unknown as { PREFERRED_SOURCE?: PreferredSourceQueue | unknown[] };
    const queue = (w.PREFERRED_SOURCE ??= []) as PreferredSourceQueue;
    queue.push((api) => api.init());
  }, [show, theme, pathname]);

  if (!show) return null;
  return (
    <div className="footer-preferred-source">
      <div key={`${theme}:${pathname}`} google-add-preferred-source-btn="" data-theme={theme} />
    </div>
  );
}
