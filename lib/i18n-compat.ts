/**
 * The i18next-shaped `t` built on a next-intl translator. Shared by the client
 * hook (lib/i18n) and the server helper (lib/i18n-server). Server-safe.
 */
import type { TranslationValues } from 'next-intl';

export type CompatTOptions = TranslationValues & { defaultValue?: string };
export type CompatT = (key: string | readonly string[], options?: CompatTOptions) => string;

/** The subset of next-intl's translator this adapter needs. */
export interface IntlTranslator {
  (key: string, values?: TranslationValues): string;
  has(key: string): boolean;
}

export function makeCompatT(intlT: IntlTranslator): CompatT {
  return (key, options) => {
    const keys: readonly string[] = typeof key === 'string' ? [key] : key;
    const { defaultValue, ...values } = options ?? {};
    for (const candidate of keys) {
      if (intlT.has(candidate)) return intlT(candidate, values);
    }
    if (defaultValue !== undefined) return defaultValue;
    // i18next returns the key itself for a missing message; keep that so a
    // missing string is visible rather than blank.
    return keys[keys.length - 1] ?? '';
  };
}
