/**
 * Guards the marketing copy against the product it describes.
 *
 * Every conversion-blocking defect found in the 2026-09-04 funnel audit was the
 * same shape: a number or promise in the copy that the code had moved away
 * from. The pricing table offered the free tier ten minutes a month while the
 * catalog granted none. The landing page offered 50MB, the feature card below
 * it 10MB, and the plan table 100MB / 500MB / 1GB, against a flat 32MB the
 * uploader actually enforced — so a four-minute WAV was rejected after being
 * invited. None of it was visible from reading a diff; it took loading the page
 * and comparing it to what the product did.
 *
 * These tests encode the comparisons a reviewer cannot reasonably make by eye:
 * a hardcoded size anywhere in a component, a locale that drifted from English,
 * a claim about a tier the app has no way to honour. They are cheap and they
 * fail loudly, which is the point — the cost of this class of bug is not a
 * broken build, it is a visitor who tried the thing and found it untrue.
 */

import fs from 'fs';
import path from 'path';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../lib/constants';

const LOCALES = ['en', 'zh-CN', 'zh-TW'];
const SRC = path.join(__dirname, '..');

const loadLocale = (locale) =>
  JSON.parse(
    fs.readFileSync(path.join(SRC, 'i18n', 'locales', locale, 'common.json'), 'utf8')
  );

/** Every .js/.jsx under src/, minus tests and the locale JSON itself. */
function sourceFiles(dir = SRC, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'mocks' || entry.name === 'locales') continue;
      sourceFiles(full, acc);
    } else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('upload limit is stated once and stated correctly', () => {
  it('derives the megabyte figure from the enforced byte limit', () => {
    expect(MAX_UPLOAD_MB).toBe(MAX_UPLOAD_BYTES / (1024 * 1024));
  });

  it.each(LOCALES)('%s copy interpolates the size rather than naming one', (locale) => {
    const t = loadLocale(locale);
    const claims = [
      t.hero.fileTypes,
      t.features.card1.body,
      t.pricing.plans.free.feature3,
      t.pricing.plans.lite.feature3,
      t.pricing.plans.pro.feature3,
    ];
    for (const claim of claims) {
      expect(claim).toContain('{{size}}');
      // A literal size beside the placeholder is the drift this guards against.
      expect(claim).not.toMatch(/\b\d{2,4}\s?(MB|GB)\b/i);
    }
  });

  it('no component hardcodes a file-size claim', () => {
    // Matches "50MB", "500 MB", "1 GB" in JSX/strings. The size must come from
    // MAX_UPLOAD_MB so copy and enforcement cannot separate again.
    const SIZE = /(?<![\w.])\d{1,4}\s?(?:MB|GB)(?![\w])/gi;

    // Comments describe the code; only rendered strings make a promise.
    const stripComments = (text) =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    // The changelog states what was true at each release. Rewriting its history
    // to match today's limit would make it a worse changelog, not a truer one.
    const EXEMPT = new Set(['components/Changelog.js']);

    const offenders = [];
    for (const file of sourceFiles()) {
      const rel = path.relative(SRC, file);
      if (EXEMPT.has(rel)) continue;
      for (const match of stripComments(fs.readFileSync(file, 'utf8')).match(SIZE) || []) {
        offenders.push(`${rel}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every upload surface guards with the shared constant', () => {
    const surfaces = ['components/Hero.js', 'components/StemSplitter.js', 'components/MidiConverter.js'];
    for (const rel of surfaces) {
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
      expect(text).toContain('MAX_UPLOAD_BYTES');
      // A second literal limit is how the three surfaces drifted apart before.
      expect(text).not.toMatch(/MAX_FILE_SIZE_BYTES\s*=\s*\d/);
    }
  });
});

describe('the free tier is not promised an allowance', () => {
  it('the plan card describes the preview, not a monthly quota', () => {
    const t = loadLocale('en');
    const free = JSON.stringify(t.pricing.plans.free);
    // The catalog grants credits_per_month: 0. Any "N minutes" here is a promise
    // no account can be given.
    expect(free).not.toMatch(/\d+\s*(minutes|mins)\s*(\/|per)\s*month/i);
  });

  it('the comparison table reads its allowances from the live catalog', () => {
    const text = fs.readFileSync(path.join(SRC, 'components/PricingPage.js'), 'utf8');
    expect(text).toContain('planMinutes');
    // Hardcoded cells are what claimed ten free minutes a month.
    expect(text).not.toMatch(/<td>\s*\d+\s*<\/td>/);
  });
});

describe('the queue explains itself honestly', () => {
  it('does not attribute the wait to demand', () => {
    // Separations run 20-30 minutes on a small pool, so the wait is processing
    // time, not a popularity spike a visitor can expect to pass.
    for (const locale of LOCALES) {
      const body = loadLocale(locale).hero.inQueueBody;
      expect(body).not.toMatch(/popular|热门|熱門/);
    }
  });

  it('the tool pages read the shared string instead of repeating it', () => {
    for (const rel of ['components/StemSplitter.js', 'components/MidiConverter.js']) {
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8');
      expect(text).toContain("t('hero.inQueueBody')");
      expect(text).not.toContain('GrooveSheet is popular');
    }
  });
});

describe('locales stay in step with English', () => {
  /** Flattened leaf paths, so a missing translation is named rather than counted. */
  const leaves = (obj, prefix = '', acc = []) => {
    for (const [key, value] of Object.entries(obj)) {
      const at = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) leaves(value, at, acc);
      else acc.push(at);
    }
    return acc;
  };

  const english = leaves(loadLocale('en'));

  it.each(['zh-CN', 'zh-TW'])('%s defines every key English defines', (locale) => {
    const missing = english.filter((k) =>
      k.split('.').reduce((node, part) => (node == null ? undefined : node[part]), loadLocale(locale)) === undefined
    );
    expect(missing).toEqual([]);
  });
});
