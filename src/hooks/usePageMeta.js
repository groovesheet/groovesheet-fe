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
 * The canonical URL for the current route: origin + path, with the query
 * string and hash dropped.
 *
 * This matters most on /explore. Every one of the ~1,000 YouTube uploads deep
 * links with its own utm_content, gs_v and view parameters, so a single track
 * is reachable at hundreds of distinct URLs. Without a canonical each of those
 * is a separate document to a crawler, splitting the ranking signal for the
 * page and spending crawl budget re-reading the same track.
 */
function canonicalHref() {
  try {
    const { origin, pathname } = window.location;
    // Trailing slashes would fork the canonical for the same route.
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    return `${origin}${path}`;
  } catch (e) {
    return null;
  }
}

function setCanonical(href) {
  if (!href) return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Client-side document title + description/OG meta for public pages.
 * Social crawlers get real per-page OG tags via the Vercel bot rewrites to
 * the backend /seo/* pages — this hook covers browser tabs, history entries,
 * and JS-executing crawlers.
 *
 * `image` is optional and only set when supplied, so pages without their own
 * artwork keep the site-wide OG image from index.html rather than losing it.
 */
export default function usePageMeta(title, description, image) {
  useEffect(() => {
    const fullTitle = title ? `${title} | GrooveSheet` : DEFAULT_TITLE;
    const prevTitle = document.title;
    document.title = fullTitle;
    setMeta('property', 'og:title', fullTitle);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    // Pages with their own artwork (blog covers) should unfurl with it rather
    // than the site-wide preview image.
    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }
    const href = canonicalHref();
    setCanonical(href);
    // og:url must agree with the canonical or the two disagree about which
    // URL is the real one for the same page.
    setMeta('property', 'og:url', href);
    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image]);
}
