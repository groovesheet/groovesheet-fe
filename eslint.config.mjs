import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Brief section 0, rule 5: no `any`, no @ts-ignore.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The player JS is a verbatim port of the CRA code (brief section 0, rule 4).
    // Fixing these React Compiler and unused-var findings would change its
    // internals, so they are silenced for the JS only; the TS entry files
    // (index.ts, engine.ts, types.ts) stay under the full rules.
    files: ['components/player/**/*.js'],
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // The CRA app stays in src/ as the source to port from until cutover.
    'src/**',
    'vendor/**',
    'public/**',
    'scripts/prerender.mjs',
    'content-app/**',
    'design-system/**',
    'supabase/**',
  ]),
]);
