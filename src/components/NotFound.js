import React from 'react';

/**
 * 404 Not Found — catch-all route.
 *
 * Embeds the finished Claude Design (404.dc.html) as a self-contained static
 * page at public/design/not-found.html. It's rendered in an iframe so the
 * design's own typography and animations are fully isolated from the app's
 * global CSS (App.css forces `font-family !important` and a 1.2s `transition`
 * on every element, which would otherwise override the design).
 *
 * Links inside the design use target="_top" so they navigate the parent window.
 */
function NotFound() {
  return (
    <iframe
      title="Page not found"
      src={`${process.env.PUBLIC_URL}/design/not-found.html`}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
    />
  );
}

export default NotFound;
