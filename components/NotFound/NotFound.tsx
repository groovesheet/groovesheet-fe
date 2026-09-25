'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import './NotFound.css';

export interface NotFoundProps {
  /** Headline override, plain text (the design sets it with textContent). */
  title?: string;
  /** Body copy override, plain text. */
  body?: string;
  /** Optional; without it the Header opens the shared login modal. */
  onLoginClick?: () => void;
}

/**
 * 404 page. The animated artwork is the finished Claude Design (404.dc.html),
 * served as a static page at public/design/not-found.html and rendered in an
 * iframe so its typography and animations stay isolated from the app's global
 * CSS (App.css forces `font-family !important` and a 1.2s `transition` on
 * every element, which would otherwise override the design).
 *
 * The real site Header and Footer wrap it so the 404 reads as a normal page;
 * the static file's own header and footer were removed. Links inside the
 * design use target="_top" so they navigate the parent window.
 *
 * `title`/`body` travel as query params so routes like /explore/:songId can
 * reuse this page for "Track not found".
 */
export function NotFound({ title, body, onLoginClick }: NotFoundProps) {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (body) params.set('body', body);
  const query = params.toString();

  // Size the iframe to its content so the Footer sits directly below the
  // artwork with no gap. Same origin, so the inner document is readable.
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameHeight, setFrameHeight] = useState(640);
  const syncHeight = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.documentElement) setFrameHeight(doc.documentElement.scrollHeight);
  }, []);
  useEffect(() => {
    // The iframe can finish loading before hydration attaches onLoad.
    syncHeight();
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [syncHeight]);

  return (
    <div className="gs-notfound">
      <Header onLoginClick={onLoginClick} />
      <h1 className="gs-notfound__heading">{title || 'Page not found'}</h1>
      <iframe
        ref={frameRef}
        onLoad={syncHeight}
        title={title || 'Page not found'}
        src={`/design/not-found.html${query ? `?${query}` : ''}`}
        className="gs-notfound__frame"
        style={{ height: frameHeight }}
      />
      <Footer />
    </div>
  );
}

export default NotFound;
