import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests (the 7 ported from CRA's Jest setup, owned by P8). Jest-style
 * globals stay on so the ported files change minimally: `jest.fn()` becomes
 * `vi.fn()`, everything else (describe/it/expect/beforeEach) is unchanged.
 * jsdom because the analytics and MusicXML tests touch window and DOMParser.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx,js,jsx}'],
    exclude: ['node_modules/**', '.next/**', 'src/**', 'vendor/**', 'content-app/**'],
  },
});
