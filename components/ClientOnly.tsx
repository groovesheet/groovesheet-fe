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

/**
 * next/dynamic with ssr: false, with an optional fallback shown on the server
 * and while the chunk loads. Call it at module scope, never inside render.
 */
export function clientOnly<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options: { fallback?: ReactNode } = {}
): ComponentType<P> {
  const { fallback = null } = options;
  return dynamic(loader, {
    ssr: false,
    loading: () => <>{fallback}</>,
  });
}
