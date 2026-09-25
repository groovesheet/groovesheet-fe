/**
 * Guards the marketing copy against the product it describes.
 *
 * Ported from src/i18n/claims.test.js. Every conversion-blocking defect found
 * in the 2026-09-04 funnel audit was the same shape: a number or promise in the
 * copy that the code had moved away from. The pricing table offered the free
 * tier ten minutes a month while the catalog granted none. The landing page
 * offered 50MB, the feature card below it 10MB, and the plan table
 * 100MB / 500MB / 1GB, against a flat 32MB the uploader actually enforced, so a
 * four-minute WAV was rejected after being invited.
 *
 * What moved in the port: messages are now messages/<locale>.json with ICU
 * `{size}` placeholders, and the components live in app/, components/ and lib/
 * rather than src/. Upload surfaces are found by file name, since P3 chooses
 * where under app/ they sit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/constants';

const LOCALES = ['en', 'zh-CN', 'zh-TW'] as const;
const ROOT = path.resolve(__dirname, '..', '..');
const SCANNED_DIRS = ['app', 'components', 'lib'];

type Messages = { [key: string]: string | Messages };

const loadLocale = (locale: string): Messages =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'messages', `${locale}.json`), 'utf8')) as Messages;

/** Dotted-path lookup that fails loudly, so a renamed key is not a silent pass. */
function message(messages: Messages, key: string): string {
  let node: string | Messages | undefined = messages;
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`missing message ${key}`);
  return node;
}

/** Every source file under the app, minus tests and fixtures. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'fixtures' || entry.name === 'node_modules') continue;
      sourceFiles(full, acc);
    } else if (/\.[jt]sx?$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

const allSourceFiles = () => SCANNED_DIRS.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));

/**
 * P3 split the CRA pages into a server page plus a client island, so the code
 * these checks guard now lives under a different base name. Keyed by the CRA
 * component name, which is what the assertions describe.
 */
const PORTED_AS: Record<string, string> = {
  Hero: 'HeroUploader',
  StemSplitter: 'StemSplitterUploader',
  MidiConverter: 'MidiConverterUploader',
  PricingPage: 'PricingCompare',
};

/** The one ported component with this base name, e.g. `Hero` finds `.../HeroUploader.tsx`. */
function findComponent(craName: string): string {
  const baseName = PORTED_AS[craName] ?? craName;
  const matches = allSourceFiles().filter((file) => path.basename(file).replace(/\.[jt]sx?$/, '') === baseName);
  if (matches.length !== 1) {
    const found = matches.map((m) => path.relative(ROOT, m)).join(', ') || 'none';
    throw new Error(`expected exactly one ${baseName} component under ${SCANNED_DIRS.join('/, ')}/, found ${found}`);
  }
  return fs.readFileSync(matches[0], 'utf8');
}

describe('upload limit is stated once and stated correctly', () => {
  it('derives the megabyte figure from the enforced byte limit', () => {
    expect(MAX_UPLOAD_MB).toBe(MAX_UPLOAD_BYTES / (1024 * 1024));
  });

  it.each(LOCALES)('%s copy interpolates the size rather than naming one', (locale) => {
    const t = loadLocale(locale);
    const claims = [
      'hero.fileTypes',
      'features.card1.body',
      'pricing.plans.free.feature3',
      'pricing.plans.lite.feature3',
      'pricing.plans.pro.feature3',
    ].map((key) => message(t, key));
    for (const claim of claims) {
      expect(claim).toContain('{size}');
      // A literal size beside the placeholder is the drift this guards against.
      expect(claim).not.toMatch(/\b\d{2,4}\s?(MB|GB)\b/i);
    }
  });

  it('no component hardcodes a file-size claim', () => {
    // Matches "50MB", "500 MB", "1 GB" in JSX/strings. The size must come from
    // MAX_UPLOAD_MB so copy and enforcement cannot separate again.
    const SIZE = /(?<![\w.])\d{1,4}\s?(?:MB|GB)(?![\w])/gi;

    // Comments describe the code; only rendered strings make a promise.
    const stripComments = (text: string) =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    // The changelog states what was true at each release. Rewriting its history
    // to match today's limit would make it a worse changelog, not a truer one.
    // P3 ported it as the /changelog route's page.tsx, not a Changelog component.
    const isExempt = (file: string) =>
      /^Changelog\.[jt]sx?$/.test(path.basename(file)) ||
      path.relative(ROOT, file).split(path.sep).includes('changelog');

    const offenders: string[] = [];
    for (const file of allSourceFiles()) {
      if (isExempt(file)) continue;
      for (const match of stripComments(fs.readFileSync(file, 'utf8')).match(SIZE) || []) {
        offenders.push(`${path.relative(ROOT, file)}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(['Hero', 'StemSplitter', 'MidiConverter'])('the %s upload surface guards with the shared constant', (name) => {
    const text = findComponent(name);
    expect(text).toContain('MAX_UPLOAD_BYTES');
    // A second literal limit is how the three surfaces drifted apart before.
    expect(text).not.toMatch(/MAX_FILE_SIZE_BYTES\s*=\s*\d/);
  });
});

describe('the free tier is not promised an allowance', () => {
  it('the plan card describes the preview, not a monthly quota', () => {
    const free = loadLocale('en').pricing;
    const plan = typeof free === 'object' && typeof free.plans === 'object' ? free.plans.free : undefined;
    // The catalog grants credits_per_month: 0. Any "N minutes" here is a promise
    // no account can be given.
    expect(plan).toBeDefined();
    expect(JSON.stringify(plan)).not.toMatch(/\d+\s*(minutes|mins)\s*(\/|per)\s*month/i);
  });

  it('the comparison table reads its allowances from the live catalog', () => {
    const text = findComponent('PricingPage');
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
      expect(message(loadLocale(locale), 'hero.inQueueBody')).not.toMatch(/popular|热门|熱門/);
    }
  });

  it.each(['StemSplitter', 'MidiConverter'])('%s reads the shared string instead of repeating it', (name) => {
    const text = findComponent(name);
    expect(text).toMatch(/t\(\s*['"]hero\.inQueueBody['"]/);
    expect(text).not.toContain('GrooveSheet is popular');
  });
});

describe('locales stay in step with English', () => {
  /** Flattened leaf paths, so a missing translation is named rather than counted. */
  const leaves = (obj: Messages, prefix = '', acc: string[] = []): string[] => {
    for (const [key, value] of Object.entries(obj)) {
      const at = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) leaves(value, at, acc);
      else acc.push(at);
    }
    return acc;
  };

  const english = leaves(loadLocale('en'));

  it.each(['zh-CN', 'zh-TW'])('%s defines every key English defines', (locale) => {
    const other = new Set(leaves(loadLocale(locale)));
    expect(english.filter((key) => !other.has(key))).toEqual([]);
  });
});

/**
 * Prices belong to the billing catalog, not to a translated string.
 *
 * The campaign page used to read "The same {minutes} minutes as our paid $4
 * Starter pack", in all three locales. The Starter pack is $12 for 30 minutes
 * and had been for some time, so the page was quoting a third of the real
 * price to every visitor who followed a campaign link. Nothing caught it,
 * because the copy and the catalog never meet in code: the catalog is fetched
 * at runtime from /billing/plans, and the sentence was typed once.
 *
 * So the rule is that no message hardcodes a currency amount. A price a
 * visitor sees must have come from the catalog, where changing it is a
 * deploy, not a memory.
 */
describe('prices are not hardcoded in the copy', () => {
  const PRICE = /[$\u00a5\u20ac\u00a3\uffe5]\s?\d/;

  for (const locale of LOCALES) {
    it(`${locale} has no currency amount in any message`, () => {
      const offenders: string[] = [];
      const walk = (node: Messages, path: string) => {
        for (const [key, value] of Object.entries(node)) {
          const here = path ? `${path}.${key}` : key;
          if (typeof value === 'string') {
            if (PRICE.test(value)) offenders.push(`${here}: ${value}`);
          } else {
            walk(value, here);
          }
        }
      };
      walk(loadLocale(locale), '');
      expect(offenders).toEqual([]);
    });
  }
});

/**
 * Contact details are citation data: the legal pages print them and every
 * directory profile repeats them, so a second copy that drifts weakens the
 * brand entity rather than merely looking untidy.
 *
 * It had drifted. /help offered +65 8996 8765 while /business-information and
 * /terms printed +65 8575 5666, retired in September 2026. Both numbers were
 * live on the same site, on its legal pages.
 */
describe('contact details are stated once', () => {
  it('has no phone number typed into a component', () => {
    // Any Singapore or Hong Kong number written out, in any spacing.
    const PHONE = /\+?\(?(?:65|852)\)?[\s-]?\d{4}[\s-]?\d{4}/g;
    const offenders: string[] = [];
    for (const file of allSourceFiles()) {
      // The one file allowed to state it.
      if (path.relative(ROOT, file) === path.join('lib', 'company.ts')) continue;
      for (const match of fs.readFileSync(file, 'utf8').match(PHONE) || []) {
        offenders.push(`${path.relative(ROOT, file)}: ${match}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
