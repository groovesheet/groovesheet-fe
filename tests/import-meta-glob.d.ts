/**
 * The one piece of Vite's client typing the tests use. Referencing
 * `vite/client` instead would declare `*.svg` and `*.css` modules globally and
 * collide with Next's own asset typings in the app's tsc run.
 */
interface ImportMeta {
  glob<M = unknown>(pattern: string | string[], options: { eager: true }): Record<string, M>;
}
