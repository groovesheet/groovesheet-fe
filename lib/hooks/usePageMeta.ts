/**
 * Client-side document title + description/OG meta, for Client Components
 * whose title comes from data only the signed-in browser can load (Tier C:
 * e.g. /transcription-history/:id).
 *
 * Not for Tier A or Tier B pages. Those put their title in the server HTML
 * through generateMetadata (lib/seo/metadata.ts); calling this there would
 * only rewrite, after hydration, what the crawler already read.
 */
'use client';

import { useEffect } from 'react';
import { DEFAULT_TITLE } from '@/lib/seo/metadata';

function setMeta(attr: 'name' | 'property', key: string, content: string | null | undefined): void {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function usePageMeta(title?: string | null, description?: string | null, image?: string | null): void {
  useEffect(() => {
    const fullTitle = title ? `${title} | GrooveSheet` : DEFAULT_TITLE;
    const prevTitle = document.title;
    document.title = fullTitle;
    setMeta('property', 'og:title', fullTitle);
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
    }
    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image]);
}
