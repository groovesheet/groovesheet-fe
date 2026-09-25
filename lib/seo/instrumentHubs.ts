/**
 * The instrument hub pages: indexable parents for the ~300 /explore track
 * pages, which until now were reachable only from the Explore rails and the
 * sitemap.
 *
 * Two shapes, because the product has two:
 *
 *   kind 'notation' — drums, piano and bass. These instruments get a real
 *     transcription (MusicXML + MIDI) as well as an isolated stem. Measured
 *     against the live catalog on 2026-09-25: of 106 tracks inspected, 93 carry
 *     drum notation, 81 piano and 47 bass.
 *   kind 'stems' — vocals and guitar. The separator emits these parts, but no
 *     transcriber runs on them, so these hubs promise isolated audio and
 *     nothing about notation. Do not move one of them to 'notation' without a
 *     transcriber behind it; the copy is what the claims test exists to guard.
 *
 * `apiInstrument` is the stem name the library API filters on
 * (?instrument=drums), and `notationInstrument` asks the API for tracks that
 * actually carry notation for that part (?notation=drums). The second
 * parameter is ignored by an API that predates it, which degrades to the
 * instrument filter rather than failing.
 */

export type HubKind = 'notation' | 'stems';

export interface InstrumentHub {
  /** URL segment: /sheet-music/<slug> or /stems/<slug>. */
  slug: string;
  kind: HubKind;
  /** Stem name the API filters on. */
  apiInstrument: string;
  /** Instrument as it appears mid-sentence, e.g. "drum". */
  adjective: string;
  /** Instrument as a noun, e.g. "Drums". */
  noun: string;
  /** Bare <title>; the layout appends the brand. Budget ~46 chars. */
  title: string;
  description: string;
  /** Visible H1. */
  heading: string;
  /**
   * One paragraph under the H1. `{count}` is replaced with the live total as a
   * noun phrase ("270 tracks", or "Tracks" when the API gave no total), so the
   * sentence must read correctly with either and must not repeat the noun.
   */
  lede: string;
  /** Which tool page this instrument's work starts on. */
  toolPath: '/stem-splitter' | '/midi-converter' | '/';
  faq: { question: string; answer: string }[];
}

const NOTATION_HUBS: InstrumentHub[] = [
  {
    slug: 'drums',
    kind: 'notation',
    apiInstrument: 'drums',
    adjective: 'drum',
    noun: 'Drums',
    title: 'Drum Sheet Music, MIDI and Stems',
    description:
      'Free drum transcriptions: read the notation, hear it play back against the recording, and export PDF, MusicXML or MIDI. Isolated drum stems included.',
    heading: 'Drum sheet music, MIDI and isolated stems',
    lede:
      '{count} in the GrooveSheet library have an isolated drum part. Open any one to play it back against the recording, follow the notation bar by bar, and download whatever that track carries.',
    toolPath: '/',
    faq: [
      {
        question: 'What do I get on a drum track page?',
        answer:
          'An isolated drum stem you can solo or mute, and, where the track carries a drum transcription, the notation alongside a drum-kit visualizer that follows playback. Each page lists its own downloads: PDF, MusicXML, MIDI and the stems themselves.',
      },
      {
        question: 'Can I open the notation in MuseScore or Sibelius?',
        answer:
          'Yes. Every transcription downloads as MusicXML, which MuseScore, Sibelius, Dorico and Finale all import, and as MIDI for a DAW.',
      },
      {
        question: 'Can I transcribe my own song instead?',
        answer:
          'Upload any audio file on the home page and pick drums. You get a free preview of the first ten seconds before spending any minutes.',
      },
    ],
  },
  {
    slug: 'piano',
    kind: 'notation',
    apiInstrument: 'piano',
    adjective: 'piano',
    noun: 'Piano',
    title: 'Piano Sheet Music, MIDI and Stems',
    description:
      'Free piano transcriptions: read the score, hear it play back against the recording, and export PDF, MusicXML or MIDI. Isolated piano stems included.',
    heading: 'Piano sheet music, MIDI and isolated stems',
    lede:
      '{count} in the GrooveSheet library have an isolated piano part. Open any one to play it back against the recording, follow the score, and download whatever that track carries.',
    toolPath: '/',
    faq: [
      {
        question: 'What do I get on a piano track page?',
        answer:
          'An isolated piano stem you can solo or mute, and, where the track carries a piano transcription, the score alongside a falling-keys view that follows playback. Each page lists its own downloads: PDF, MusicXML, MIDI and the stems themselves.',
      },
      {
        question: 'Is the transcription editable?',
        answer:
          'Yes. The MusicXML export opens in MuseScore, Sibelius, Dorico and Finale, and the MIDI export opens in any DAW, so you can correct or rearrange anything the model got wrong.',
      },
      {
        question: 'Can I transcribe my own recording instead?',
        answer:
          'Upload any audio file on the home page and pick piano. You get a free preview of the first ten seconds before spending any minutes.',
      },
    ],
  },
  {
    slug: 'bass',
    kind: 'notation',
    apiInstrument: 'bass',
    adjective: 'bass',
    noun: 'Bass',
    title: 'Bass Sheet Music, MIDI and Stems',
    description:
      'Free bass transcriptions: read the line, hear it play back against the recording, and export PDF, MusicXML or MIDI. Isolated bass stems included.',
    heading: 'Bass sheet music, MIDI and isolated stems',
    lede:
      '{count} in the GrooveSheet library have an isolated bass part. Open any one to play it back against the recording, follow the line note by note, and download whatever that track carries.',
    toolPath: '/',
    faq: [
      {
        question: 'What do I get on a bass track page?',
        answer:
          'An isolated bass stem you can solo or mute, and, where the track carries a bass transcription, the notation alongside a fretboard view that follows playback. Each page lists its own downloads: PDF, MusicXML, MIDI and the stems themselves.',
      },
      {
        question: 'Does it give me tab or standard notation?',
        answer:
          'Standard notation, plus a fretboard view in the player. The MusicXML export opens in MuseScore, Sibelius, Dorico or Finale, where you can generate tab from it.',
      },
      {
        question: 'Can I transcribe my own recording instead?',
        answer:
          'Upload any audio file on the home page and pick bass. You get a free preview of the first ten seconds before spending any minutes.',
      },
    ],
  },
];

const STEM_HUBS: InstrumentHub[] = [
  {
    slug: 'vocals',
    kind: 'stems',
    apiInstrument: 'vocals',
    adjective: 'vocal',
    noun: 'Vocals',
    title: 'Isolated Vocals and Acapellas',
    description:
      'Isolated vocal stems separated from the full mix with AI. Solo the vocal, mute it for an instrumental, or download the stem.',
    heading: 'Isolated vocals and acapella stems',
    lede:
      '{count} in the GrooveSheet library have an isolated vocal stem. Solo it for an acapella, mute it for a backing track, or download the audio. These are separated stems, not transcriptions: GrooveSheet does not transcribe vocal melodies to notation.',
    toolPath: '/stem-splitter',
    faq: [
      {
        question: 'How are the vocals separated?',
        answer:
          'An AI separation model splits the mix into parts (vocals, drums, bass, piano, guitar and everything else) and renders each as its own audio file. No original multitrack is involved, so artefacts are possible on dense mixes.',
      },
      {
        question: 'Do I get sheet music for the vocal line?',
        answer:
          'No. Vocals are separated as audio only. Notation is produced for drums, piano and bass.',
      },
      {
        question: 'Can I separate my own song?',
        answer:
          'Yes, on the Stem Splitter page. Preview any track free, then pay only for the minutes you process.',
      },
    ],
  },
  {
    slug: 'guitar',
    kind: 'stems',
    apiInstrument: 'guitar',
    adjective: 'guitar',
    noun: 'Guitar',
    title: 'Isolated Guitar Stems and Backing Tracks',
    description:
      'Isolated guitar stems separated from the full mix with AI. Solo the guitar to learn a part, or mute it to play along.',
    heading: 'Isolated guitar stems and backing tracks',
    lede:
      '{count} in the GrooveSheet library have an isolated guitar stem. Solo it to hear the part on its own, or mute it and play along with the rest of the band. These are separated stems, not transcriptions: GrooveSheet does not transcribe guitar to notation or tab.',
    toolPath: '/stem-splitter',
    faq: [
      {
        question: 'Is this guitar tab?',
        answer:
          'No. The guitar part is separated as audio you can solo, slow down and loop. Notation is produced for drums, piano and bass, not for guitar.',
      },
      {
        question: 'Can I mute the guitar to play along?',
        answer:
          'Yes. The stems view lets you mute or solo each part, so muting the guitar leaves you a backing track with the original drums, bass and vocals.',
      },
      {
        question: 'Can I separate my own song?',
        answer:
          'Yes, on the Stem Splitter page. Preview any track free, then pay only for the minutes you process.',
      },
    ],
  },
];

export const INSTRUMENT_HUBS: InstrumentHub[] = [...NOTATION_HUBS, ...STEM_HUBS];

/** Base path for a hub of each kind. */
export const HUB_BASE: Record<HubKind, string> = {
  notation: '/sheet-music',
  stems: '/stems',
};

export function hubPath(hub: InstrumentHub): string {
  return `${HUB_BASE[hub.kind]}/${hub.slug}`;
}

export function hubsOfKind(kind: HubKind): InstrumentHub[] {
  return INSTRUMENT_HUBS.filter((h) => h.kind === kind);
}

export function hubBySlug(kind: HubKind, slug: string): InstrumentHub | undefined {
  return INSTRUMENT_HUBS.find((h) => h.kind === kind && h.slug === slug);
}

/** Every hub path, for the sitemap and the route table. */
export function hubPaths(): string[] {
  return INSTRUMENT_HUBS.map(hubPath);
}

/**
 * The hub a track belongs under, used for its breadcrumb. Notation wins over
 * stems (a track with drum notation belongs under drums, not vocals), and the
 * order of NOTATION_HUBS decides ties.
 */
export function primaryHubFor(parts: string[]): InstrumentHub | undefined {
  const lower = parts.map((p) => p.toLowerCase());
  return INSTRUMENT_HUBS.find((h) => lower.includes(h.apiInstrument));
}

/**
 * The hubs a track may link up to, given the parts it was separated into and
 * the parts that were actually transcribed.
 *
 * The distinction is the whole point. A /sheet-music hub is only offered when
 * the track carries notation for that part: nearly every track in the catalog
 * has a bass stem, so matching on stems alone put "Bass sheet music" on the
 * page of a track whose only notation is drums and piano. A /stems hub is
 * offered whenever the separated part exists, which is all that hub claims.
 */
export function hubsForTrack({ notated, stems }: { notated: string[]; stems: string[] }): InstrumentHub[] {
  const notatedSet = new Set(notated.map((p) => p.toLowerCase()));
  const stemSet = new Set(stems.map((p) => p.toLowerCase()));
  return INSTRUMENT_HUBS.filter((h) =>
    h.kind === 'notation' ? notatedSet.has(h.apiInstrument) : stemSet.has(h.apiInstrument)
  );
}

/** How a hub is referred to from another page's link list. */
export function hubLinkLabel(hub: InstrumentHub): string {
  const adjective = hub.adjective.charAt(0).toUpperCase() + hub.adjective.slice(1);
  return hub.kind === 'notation' ? `${adjective} sheet music, MIDI and stems` : `Isolated ${hub.adjective} stems`;
}
