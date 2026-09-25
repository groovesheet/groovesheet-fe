'use client';

import { useCallback } from 'react';
import { useRouter } from '@/lib/navigation';

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

/**
 * Drop-in for the CRA useLocalizedNavigate. `navigate('/x')`, `navigate('/x',
 * { replace: true })` and `navigate(-1)` keep working, so ported components
 * only change their import line.
 */
export function useLocalizedNavigate(): (to: string | number, options?: NavigateOptions) => void {
  const router = useRouter();
  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      const opts = options?.scroll === undefined ? undefined : { scroll: options.scroll };
      if (options?.replace) router.replace(to, opts);
      else router.push(to, opts);
    },
    [router]
  );
}
