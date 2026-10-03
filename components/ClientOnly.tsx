/**
 * The one sanctioned way to render browser-only code (brief 5.4).
 *
 * 'use client' does not stop a module from running during `next build`: Client
 * Components are still prerendered on the server. Anything that touches
 * window, document, AudioContext, canvas or OSMD at import time must be loaded
 * with ssr: false, and Next only allows that from a Client Component. This file
 * is that Client Component, so the pattern lives in one place.
 *
 * Two ways to use it:
 *
 * 1. Wrap a lazily imported module (preferred for the player islands). Define
 *    the loader at module scope in a 'use client' file so it is created once:
 *
 *      'use client';
 *      import { clientOnly } from '@/components/ClientOnly';
 *      const OSMDViewer = clientOnly(() => import('./OSMDViewer'), { fallback: <SkeletonPanel /> });
 *      export default function ScoreView(props: Props) { return <OSMDViewer {...props} />; }
 *
 *    Server Components may render ScoreView; the OSMD module never loads on
 *    the server.
 *
 * 2. Gate already-imported children on being mounted in the browser, for
 *    small bits whose markup depends on window (a viewport-dependent layout):
 *
 *      <ClientOnly fallback={<Placeholder />}>{children}</ClientOnly>
 *
 *    The children's module is still evaluated on the server with this form,
 *    so it is not for code that touches browser APIs at import time.
 */
'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react';

const subscribe = () => () => {};

/** True after hydration, false on the server and during the hydration render. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}

export default function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const isClient = useIsClient();
  return <>{isClient ? children : fallback}</>;
}

const CHUNK_RELOAD_KEY = 'gs_chunk_reload_at';

function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  return Boolean(e && (e.name === 'ChunkLoadError' || /Loading chunk|Failed to load chunk|dynamically imported module/i.test(e.message || '')));
}

/**
 * A chunk that will not load is almost always a page opened before a deploy:
 * its chunk names are gone from the new build. Seen on /stem-splitter on
 * 2026-09-30, where it hid a finished preview behind an error. Try once more,
 * then reload the page once (the upload cards bring a finished preview back
 * after a reload). The timestamp stops a broken build from reloading forever.
 */
async function loadWithChunkRecovery<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    if (!isChunkLoadError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      return await loader();
    } catch (retryErr) {
      if (!isChunkLoadError(retryErr) || typeof window === 'undefined') throw retryErr;
      let last = 0;
      try {
        last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0;
      } catch {
        /* storage blocked */
      }
      if (Date.now() - last < 60_000) throw retryErr;
      try {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      } catch {
        /* storage blocked: still reload once for this page */
      }
      window.location.reload();
      // The page is going away; never settle.
      return new Promise<T>(() => {});
    }
  }
}

/**
 * next/dynamic with ssr: false, with an optional fallback shown on the server
 * and while the chunk loads. Call it at module scope, never inside render.
 */
export function clientOnly<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options: { fallback?: ReactNode } = {}
): ComponentType<P> {
  const { fallback = null } = options;
  return dynamic(() => loadWithChunkRecovery(loader), {
    ssr: false,
    loading: () => <>{fallback}</>,
  });
}
