import { useLocation } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import { metaForPath } from './routeMeta';

/**
 * Applies the static title/description for the current route, if it has one.
 *
 * Mounted once, high in the tree, so every static marketing route gets its
 * meta without each page component having to remember to ask for it. Routes
 * that are not in the map (the song, blog and creator pages) resolve to null
 * here, which makes usePageMeta fall through to the defaults baked into
 * index.html and leaves those pages' own usePageMeta calls untouched.
 *
 * Passing null rather than skipping the hook keeps the hook count stable
 * across renders, which is what the rules of hooks require.
 */
export default function useRouteMeta() {
  const { pathname } = useLocation();
  const meta = metaForPath(pathname);
  usePageMeta(meta ? meta.title : null, meta ? meta.description : null);
}
