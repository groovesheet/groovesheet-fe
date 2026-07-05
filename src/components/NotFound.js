import React, { useCallback, useEffect, useRef, useState } from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';

/**
 * 404 Not Found — catch-all route.
 *
 * The animated 404 artwork is the finished Claude Design (404.dc.html), served
 * as a self-contained static page at public/design/not-found.html and rendered
 * in an iframe so the design's own typography and animations stay isolated from
 * the app's global CSS (App.css forces `font-family !important` and a 1.2s
 * `transition` on every element, which would otherwise override the design).
 *
 * The iframe holds only the hero artwork — the real site Header and Footer wrap
 * it so the 404 reads as a normal page. The iframe flexes to fill the space
 * between them (its own header/footer were removed from the static file).
 *
 * Links inside the design use target="_top" so they navigate the parent window.
 *
 * `title`/`body` override the page's headline and copy (passed as query
 * params; the design reads them with textContent, so plain text only) —
 * lets routes like /explore/:songId reuse this page for "Track not found".
 */
function NotFound({ title, body, onLoginClick }) {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (body) params.set('body', body);
  const query = params.toString();

  // Auto-size the iframe to its content so the real Footer sits directly below
  // the artwork with no gap. Same-origin, so we can read the inner document.
  const frameRef = useRef(null);
  const [frameHeight, setFrameHeight] = useState(640);
  const syncHeight = useCallback(() => {
    const doc = frameRef.current && frameRef.current.contentDocument;
    if (doc && doc.documentElement) setFrameHeight(doc.documentElement.scrollHeight);
  }, []);
  useEffect(() => {
    window.addEventListener('resize', syncHeight);
    return () => window.removeEventListener('resize', syncHeight);
  }, [syncHeight]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header onLoginClick={onLoginClick} />
      <iframe
        ref={frameRef}
        onLoad={syncHeight}
        title={title || 'Page not found'}
        src={`${process.env.PUBLIC_URL}/design/not-found.html${query ? `?${query}` : ''}`}
        style={{
          width: '100%',
          height: frameHeight,
          border: 'none',
          display: 'block',
        }}
      />
      <Footer />
    </div>
  );
}

export default NotFound;
