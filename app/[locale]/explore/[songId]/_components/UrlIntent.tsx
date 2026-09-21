'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/** What the song page's URL asks for: `?view=` (a tab) and `?instrument=` (a part). */
export interface SongUrlIntent {
  view: string | null;
  instrument: string | null;
}

/**
 * Reports the URL's intent to the song page.
 *
 * It is its own component, rendered inside <Suspense>, because the song page
 * is statically generated (ISR): useSearchParams there turns everything up to
 * the nearest Suspense boundary into client-only rendering. Isolated like this,
 * only this empty component waits for the browser, and the rest of the page
 * (title, artist, sidebar, rails) stays in the server HTML.
 */
export default function UrlIntent({ onChange }: { onChange: (intent: SongUrlIntent) => void }) {
  const searchParams = useSearchParams();
  const view = searchParams.get('view');
  const instrument = searchParams.get('instrument');

  useEffect(() => {
    onChange({ view, instrument });
  }, [view, instrument, onChange]);

  return null;
}
