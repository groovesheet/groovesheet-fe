import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';

/**
 * /help, /pricing, /explore (with /explore/search), /stem-splitter,
 * /midi-converter and /changelog in Chinese.
 *
 * These pages were served at /zh-CN and /zh-TW with self-canonicals and
 * English copy, so each was the English page declared as its own translation.
 * Their copy now lives in messages under the namespaces below. The checks are
 * the same ones the song pages have: the Chinese is Chinese, the two scripts
 * stay apart, and every message formats with the values the pages pass.
 */
const MESSAGES = { en, 'zh-CN': zhCN, 'zh-TW': zhTW } as const;
const NAMESPACES = ['changelogPage', 'explore', 'help', 'pricingPage', 'tools'] as const;

type Leaf = [path: string, value: string];
function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [[path, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('translated marketing and library pages', () => {
  // Product, format, service and artist names stay in Latin script. Anything
  // else Latin in a Chinese message is an untranslated phrase.
  const ALLOWED = new Set([
    'GrooveSheet', 'MIDI', 'PDF', 'MusicXML', 'DAW', 'AI', 'QR', 'MB', 'MP', 'WAV', 'FLAC', 'OGG', 'mid',
    'WhatsApp', 'Google', 'Apple', 'iPhone', 'Facebook', 'Stripe', 'Lite', 'Pro', 'MyGO', 'YOASOBI',
    'Sibelius', 'MuseScore', 'Dorico',
    'count', 'plural', 'one', 'other',
  ]);

  it.each(['zh-CN', 'zh-TW'] as const)('%s has no English left in these pages', (locale) => {
    const offenders = NAMESPACES.flatMap((ns) =>
      leaves(MESSAGES[locale][ns], ns).flatMap(([path, value]) => {
        const text = value.replace(/\{[a-zA-Z0-9]+\}/g, '').replace(/<\/?[a-z]+>/g, '');
        return (text.match(/[A-Za-z]{2,}/g) || []).filter((w) => !ALLOWED.has(w)).map((w) => `${path}: ${w}`);
      })
    );
    expect(offenders).toEqual([]);
  });

  it('keeps Simplified and Traditional apart', () => {
    const cn = JSON.stringify(NAMESPACES.map((ns) => zhCN[ns]));
    const tw = JSON.stringify(NAMESPACES.map((ns) => zhTW[ns]));
    for (const ch of ['譜', '貝', '鋼', '載', '軌', '聲', '輯', '錄', '樂', '開', '檔', '費', '級', '選']) expect(cn).not.toContain(ch);
    for (const ch of ['谱', '贝', '钢', '载', '轨', '声', '辑', '录', '乐', '开', '档', '费', '级', '选']) expect(tw).not.toContain(ch);
  });

  it.each(['en', 'zh-CN', 'zh-TW'] as const)('%s formats every message in these pages', (locale) => {
    const errors: string[] = [];
    const values = {
      query: 'q', q: 'q', count: 2, countText: '2', page: 1, pages: 3, pageInfo: '', label: 'l', title: 't',
      size: 32, price: '$1', minutes: 60, message: 'm', seconds: 30,
      b: (chunks: unknown) => chunks, em: (chunks: unknown) => chunks,
    };
    for (const ns of NAMESPACES) {
      const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: ns, onError: (e) => errors.push(e.message) });
      for (const [path] of leaves(MESSAGES[locale][ns])) {
        const hasTags = /<[a-z]+>/.test(path ? String(leaves(MESSAGES[locale][ns]).find(([p]) => p === path)?.[1]) : '');
        if (hasTags) t.rich(path as never, values as never);
        else t(path as never, values as never);
      }
    }
    expect(errors).toEqual([]);
  });

  // The explore intro used to say "Every track ships in all three formats".
  // Measured on 2026-09-29, 297 of 304 tracks did; the copy may not round up.
  it('does not claim every track carries every format', () => {
    for (const locale of ['en', 'zh-CN', 'zh-TW'] as const) {
      expect(MESSAGES[locale].explore.hero.sub).not.toMatch(/all three formats|三种格式|三種格式/);
    }
  });

  // Vocals are separated, never transcribed: no transcriber runs on them.
  it('does not promise vocal notation on the pricing page', () => {
    const copy = JSON.stringify(en.pricingPage);
    expect(copy).not.toMatch(/vocal notation|Vocals"/i);
    expect(en.pricingPage.trust.instruments).not.toMatch(/Vocal/);
  });
});
