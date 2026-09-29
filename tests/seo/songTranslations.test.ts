import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  songDescription,
  songInstrumentDescription,
  songInstrumentHeading,
  songInstrumentTitle,
  songTitle,
  type SongCopy,
  type SongT,
} from '@/app/[locale]/explore/[songId]/_components/songData';
import type { LibraryTrack } from '@/lib/types';
import en from '@/messages/en.json';
import zhCN from '@/messages/zh-CN.json';
import zhTW from '@/messages/zh-TW.json';

/**
 * The song and part pages in Chinese.
 *
 * Until September 2026 every /zh-CN and /zh-TW song page served English: the
 * title, the description, the facts block and the player were all written in
 * code, and only the site menus were translated. Google indexed those URLs as
 * lang="zh-CN" pages whose text was English, three near-identical URLs per
 * page. These tests hold the two properties that fix depends on: the Chinese
 * copy is Chinese, and each locale uses its own script and its own words for
 * the searches its readers type (架子鼓谱 in Simplified, 爵士鼓譜 in Traditional).
 */

const MESSAGES = { en, 'zh-CN': zhCN, 'zh-TW': zhTW } as const;
type TestLocale = keyof typeof MESSAGES;

function copyFor(locale: TestLocale): SongCopy {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'song' }) as unknown as SongT;
  return { t, locale };
}

function track(assets: { asset_type: string; stem_name: string | null }[]): LibraryTrack {
  return { id: 'abc123', slug: 'shape-of-you', title: 'Shape of You', artist: 'Ed Sheeran', assets } as unknown as LibraryTrack;
}

const SCORED = track([
  { asset_type: 'stem', stem_name: 'drums' },
  { asset_type: 'musicxml', stem_name: 'drums' },
  { asset_type: 'midi', stem_name: 'drums' },
  { asset_type: 'musicxml', stem_name: 'piano' },
]);

type Leaf = [path: string, value: string];
function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [[path, node]];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('song pages in Chinese', () => {
  it('titles each page with the phrase its readers search', () => {
    const cn = copyFor('zh-CN');
    const tw = copyFor('zh-TW');
    expect(songInstrumentTitle(cn.t, SCORED, 'drums')).toBe('Ed Sheeran《Shape of You》架子鼓谱');
    expect(songInstrumentTitle(cn.t, SCORED, 'piano')).toBe('Ed Sheeran《Shape of You》钢琴谱');
    expect(songInstrumentTitle(tw.t, SCORED, 'drums')).toBe('Ed Sheeran《Shape of You》爵士鼓譜');
    expect(songInstrumentTitle(tw.t, SCORED, 'bass')).toBe('Ed Sheeran《Shape of You》貝斯譜');
    expect(songTitle(cn.t, SCORED)).toBe('Ed Sheeran《Shape of You》乐谱与 MIDI');
    expect(songTitle(tw.t, { title: 'Untitled', artist: null })).toBe('《Untitled》樂譜與 MIDI');
    expect(songInstrumentHeading(cn.t, 'drums')).toBe('架子鼓谱');
  });

  // Same rule as the English description: it lists only the formats the part
  // has, joined in the page's language.
  it('describes only what the part can be exported as', () => {
    const cn = songInstrumentDescription(copyFor('zh-CN'), SCORED, 'drums');
    expect(cn).toBe('Ed Sheeran《Shape of You》的免费架子鼓谱：在线看谱，对照原曲同步播放，并可导出 PDF、MusicXML或MIDI。附独立鼓分轨。');
    const piano = songInstrumentDescription(copyFor('zh-TW'), SCORED, 'piano');
    expect(piano).toContain('並可匯出 PDF或MusicXML');
    expect(piano).not.toContain('MIDI');
    expect(piano).not.toContain('分軌');
    expect(songDescription(copyFor('zh-TW').t, SCORED)).toContain('的免費樂譜、MIDI 與獨立分軌');
  });

  // Anything Latin left in a Chinese message, other than product and format
  // names and ICU syntax, is an untranslated phrase.
  it.each(['zh-CN', 'zh-TW'] as const)('%s song copy has no English left in it', (locale) => {
    const ALLOWED = new Set([
      'GrooveSheet', 'MIDI', 'PDF', 'MusicXML', 'DAW', 'ZIP', 'MuseScore', 'Sibelius', 'Dorico', 'Finale',
      'DMCA', 'OSMD', 'AI', 'count', 'plural', 'other', 'one',
    ]);
    const offenders = leaves(MESSAGES[locale].song).flatMap(([path, value]) => {
      const text = value.replace(/\{[a-zA-Z]+\}/g, '');
      const words = text.match(/[A-Za-z]{2,}/g) || [];
      return words.filter((w) => !ALLOWED.has(w)).map((w) => `${path}: ${w}`);
    });
    expect(offenders).toEqual([]);
  });

  // The two Chinese locales are different scripts, and copying a string from
  // one into the other is the easy mistake. A few characters that exist in
  // only one script are enough to catch it.
  it('keeps Simplified and Traditional apart', () => {
    const cn = JSON.stringify(zhCN.song);
    const tw = JSON.stringify(zhTW.song);
    for (const ch of ['譜', '貝', '鋼', '載', '軌', '聲', '輯', '錄', '樂', '開', '檔']) expect(cn).not.toContain(ch);
    for (const ch of ['谱', '贝', '钢', '载', '轨', '声', '辑', '录', '乐', '开', '档']) expect(tw).not.toContain(ch);
  });

  // Every message must format in every locale with the variables the pages
  // pass. Locales may use different variables for one sentence (English "the
  // drum part" reads `adjective`, Chinese "鼓声部" reads `name`), so the pages
  // pass all instrument forms; this checks no message asks for anything else.
  it.each(['en', 'zh-CN', 'zh-TW'] as const)('%s formats every song message', (locale) => {
    const errors: string[] = [];
    const t = createTranslator({
      locale,
      messages: MESSAGES[locale],
      namespace: 'song',
      onError: (e) => errors.push(e.message),
    }) as unknown as SongT;
    const values = {
      title: 'T', artist: 'A', subject: 'S', handle: 'h', creator: 'c', mode: 'off', status: 's',
      name: 'n', noun: 'n', adjective: 'a', sheet: 's', sheetHeading: 's', sheetTitle: 's', sub: 's',
      names: 'n', adjectives: 'a', scored: 's', notated: 'n', stems: 's', exports: '', stem: '', formats: 'f',
      count: 2, loaded: 1, total: 2, percent: 50, value: 80,
    };
    for (const [path] of leaves(MESSAGES[locale].song)) t(path, values);
    expect(errors).toEqual([]);
  });
});
