/**
 * One source of truth for the title and description of every static route.
 *
 * Ported from src/seo/routeMeta.js. In the CRA app these strings fed both a
 * client hook and the build-time prerenderer; here they feed generateMetadata
 * through staticRouteMetadata() in lib/seo/metadata.ts, which is what puts a
 * distinct <title> in the server HTML.
 *
 * Only genuinely static routes belong here. Pages whose meta depends on
 * fetched data (/explore/:id, /u/:username) build their own in
 * generateMetadata from the record they loaded.
 *
 * Title budget: the root layout's title template appends " | GrooveSheet"
 * (14 chars) and Google truncates a little past 60, so keep the source string
 * under ~46.
 *
 * Targets are the measured ones in docs/seo-plan-2026-09.md: stem separation
 * is ~22,000 searches/mo, audio-to-MIDI ~9,500, and the brand's own
 * audio-to-sheet-music category only ~2,200. The titles are ordered to match
 * that reality rather than the company's self-image.
 */

export interface RouteMeta {
  title: string;
  description?: string;
}

export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: 'Audio to Sheet Music, Stems & MIDI',
    description:
      'Turn any song into sheet music. AI transcription for drums, piano and bass, plus stem separation and audio-to-MIDI. Export PDF, MusicXML and MIDI.',
  },

  // The biggest market this product is in, by roughly 10x. Every competitor
  // ranking above us puts "free" in the title, and ~4,650 searches/mo carry
  // the modifier, so the description has to say what free actually buys or
  // the click bounces.
  '/stem-splitter': {
    title: 'Free AI Stem Splitter: Vocals, Drums & Bass',
    description:
      'Split any song into isolated vocal, drum, bass and instrument stems with AI. Preview any track free, then pay only for the minutes you process.',
  },

  '/midi-converter': {
    title: 'Free Audio to MIDI Converter: MP3 & WAV',
    description:
      'Convert MP3, WAV and any audio file to MIDI with AI transcription. Editable notes for your DAW. Preview free, then pay only for the minutes you process.',
  },

  '/pricing': {
    title: 'Pricing: Pay Only for the Minutes You Use',
    description:
      'No subscription required. Preview any track free, then pay per minute of audio you transcribe or separate. See the full price list and what each plan includes.',
  },

  '/developers': {
    title: 'Music Transcription API for Developers',
    description:
      'Add audio-to-sheet-music, stem separation and audio-to-MIDI to your own app. REST API with PDF, MusicXML and MIDI output. Read the docs and request a key.',
  },

  '/about': {
    title: 'About',
    description:
      'GrooveSheet builds AI tools that turn recordings into notation, stems and MIDI, so musicians, educators and creators can learn and create faster.',
  },

  '/help': {
    title: 'Help & Support',
    description:
      'Answers on supported file types, transcription accuracy, exports, billing and refunds, plus how to reach the GrooveSheet team directly.',
  },

  '/changelog': {
    title: 'Changelog: What We Shipped',
    description:
      'Every release, newest first: new instruments, transcription accuracy improvements, export formats and the tools added to GrooveSheet.',
  },

  '/terms': { title: 'Terms & Conditions' },
  '/privacy-policy': { title: 'Privacy Policy' },
  '/refund-policy': { title: 'Refund Policy' },
  '/business-information': { title: 'Business Information' },
};

/**
 * Strip a locale prefix so /zh-CN/pricing resolves to the same entry as
 * /pricing, and drop any trailing slash so /pricing/ does not miss.
 */
export function normalizePath(pathname: string): string {
  const withoutLocale = pathname.replace(/^\/(zh-CN|zh-TW)(?=\/|$)/, '');
  const trimmed = withoutLocale.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function metaForPath(pathname: string): RouteMeta | null {
  return ROUTE_META[normalizePath(pathname)] || null;
}

export default ROUTE_META;
