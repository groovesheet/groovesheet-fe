import { useEffect } from 'react';

const DEFAULT_TITLE = 'GrooveSheet — AI Music Transcription';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Client-side document title + description/OG meta for public pages.
 * Social crawlers get real per-page OG tags via the Vercel bot rewrites to
 * the backend /seo/* pages — this hook covers browser tabs, history entries,
 * and JS-executing crawlers.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const fullTitle = title ? `${title} | GrooveSheet` : DEFAULT_TITLE;
    const prevTitle = document.title;
    document.title = fullTitle;
    setMeta('property', 'og:title', fullTitle);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    return () => {
      document.title = prevTitle;
    };
  }, [title, description]);
}
