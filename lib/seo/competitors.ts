/**
 * Comparison pages: GrooveSheet against the tools that rank for the category.
 *
 * Rules these entries live by, because a page about someone else's product is
 * the easiest place on the site to be wrong:
 *
 *  1. Every competitor fact comes from that vendor's own public pages, and
 *     `source` links the page it came from. `checked` is the day it was read.
 *  2. A fact the vendor does not publish is `null`, which renders as "Not
 *     listed" and never as "No". We do not know what a company has chosen not
 *     to put on its website, and guessing on a page that names them is how a
 *     comparison becomes a liability.
 *  3. GrooveSheet's own column is not written here. It is derived from the
 *     live billing catalog and from lib/constants at render time, so it cannot
 *     drift the way the "$4 Starter pack" line did.
 *  4. `wins` is what the competitor does better, and it is not optional. A
 *     comparison page with an empty one is an advertisement, and readers can
 *     tell.
 *
 * Re-read the sources before editing any figure. Prices move.
 */

export interface ComparisonRow {
  /** Row label, e.g. "Free tier". */
  label: string;
  /** What the competitor publishes; null renders as "Not listed". */
  theirs: string | null;
}

export interface Competitor {
  /** URL segment: /compare/<slug>. */
  slug: string;
  /** Product name as they write it. */
  name: string;
  /** Their site, for the source note. */
  site: string;
  /** The exact page each fact was read from. */
  source: string;
  /** ISO date the source was read. */
  checked: string;
  /** Bare <title>; the layout appends the brand. Budget ~46 chars. */
  title: string;
  description: string;
  /** Visible H1. */
  heading: string;
  /** One paragraph naming the real difference, before any table. */
  lede: string;
  /** Two or three sentences on who should pick them instead. */
  theirFit: string;
  /** Two or three sentences on who should pick GrooveSheet. */
  ourFit: string;
  /** What they do that GrooveSheet does not. Never empty. */
  wins: string[];
  /** What GrooveSheet does that their published material does not describe. */
  ours: string[];
  rows: ComparisonRow[];
  /**
   * Answers may carry `{maxUploadMb}`, substituted at render time from
   * lib/constants. The upload limit is never typed out: the claims test fails
   * any source file that states a file size, because the copy and the value
   * the uploader enforces drifted apart once before.
   */
  faq: { question: string; answer: string }[];
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'klangio',
    name: 'Klangio',
    site: 'klang.io',
    source: 'https://klang.io/',
    checked: '2026-09-25',
    title: 'GrooveSheet vs Klangio',
    description:
      'How GrooveSheet and Klangio differ on instruments, exports, stem separation and price. Facts read from Klangio’s own pages on 25 September 2026.',
    heading: 'GrooveSheet vs Klangio',
    lede:
      'Klangio is the broadest transcription catalogue in this category: a separate AI model per instrument family, from piano and guitar through strings and winds, plus a sheet-music scanner and a DAW plugin. GrooveSheet covers fewer instruments and adds something Klangio does not describe: it separates the recording into isolated parts you can solo and download, and keeps every transcription playable against the original audio.',
    theirFit:
      'Pick Klangio if the instrument you need is one GrooveSheet does not transcribe, which is most of them: guitar, voice, violin, brass and woodwinds all have their own Klangio app. Pick it too if you want guitar tab or Guitar Pro files, if you work from YouTube links, or if you want transcription inside your DAW.',
    ourFit:
      'Pick GrooveSheet if you are working on drums, piano or bass and want the isolated audio as well as the notation, so you can mute a part and play it yourself. The library of already-transcribed songs is free to browse and download, which is worth checking before you spend anything on either tool.',
    wins: [
      'Transcribes instruments GrooveSheet does not: guitar, voice, violin and other strings, brass and woodwinds.',
      'Exports guitar tab and Guitar Pro files; GrooveSheet exports standard notation only.',
      'Takes a YouTube link as input, alongside uploads and live recording.',
      'Runs in the browser, on iOS and Android, and as a plugin inside a DAW.',
      'Scan2Notes reads printed sheet music, which GrooveSheet does not do at all.',
    ],
    ours: [
      'Separates the recording into isolated stems (vocals, drums, bass, piano, guitar and the rest) you can solo, mute and download.',
      'Plays every transcription against the original audio, with a drum-kit, piano-roll or fretboard view that follows along.',
      'A public library of transcribed songs you can browse and download without an account.',
    ],
    rows: [
      { label: 'Free tier', theirs: 'Demo transcriptions of the first 20 seconds, as often as you like' },
      { label: 'Published price', theirs: null },
      { label: 'Instruments transcribed', theirs: 'Piano, guitar, bass, voice, drums, strings, brass and woodwinds' },
      { label: 'Notation exports', theirs: 'PDF, MusicXML, MIDI (quantized and unquantized), Guitar Pro' },
      { label: 'Guitar tab', theirs: 'Yes, via Guitar2Tabs' },
      { label: 'Isolated stems', theirs: null },
      { label: 'Input from a YouTube link', theirs: 'Yes' },
      { label: 'Scans printed sheet music', theirs: 'Yes, via Scan2Notes' },
      { label: 'Platforms', theirs: 'Browser, iOS, Android, DAW plugin' },
      { label: 'Browsable library of transcriptions', theirs: null },
    ],
    faq: [
      {
        question: 'Is Klangio or GrooveSheet more accurate?',
        answer:
          'Neither of us can answer that honestly for your music. Accuracy depends on the instrument, the density of the mix and the recording, and both tools let you check before paying: Klangio transcribes the first 20 seconds free, GrooveSheet previews the first 10 seconds of any song free. Run the same track through both and compare the result.',
      },
      {
        question: 'Can GrooveSheet give me guitar tab like Guitar2Tabs?',
        answer:
          'No. GrooveSheet separates a guitar stem you can solo and play along to, but it does not transcribe guitar to notation or tab. For tab, Klangio is the tool of the two.',
      },
      {
        question: 'Does Klangio separate stems?',
        answer:
          'Klangio’s public pages describe transcription rather than source separation, and do not list isolated stem downloads. Check their site for the current answer; this page was read on 25 September 2026.',
      },
    ],
  },
  {
    slug: 'songscription',
    name: 'Songscription',
    site: 'songscription.ai',
    source: 'https://www.songscription.ai/pricing',
    checked: '2026-09-25',
    title: 'GrooveSheet vs Songscription',
    description:
      'How GrooveSheet and Songscription compare on price, transcription length, exports and stem separation. Prices read from Songscription’s pricing page on 25 September 2026.',
    heading: 'GrooveSheet vs Songscription',
    lede:
      'These two are priced on different units, which is the thing to understand before comparing anything else. Songscription sells a monthly credit allowance with a cap on how long any one transcription may be. GrooveSheet sells minutes of audio that you spend however you like, on transcription or separation, with no per-song length cap.',
    theirFit:
      'Pick Songscription if you want the cheapest way into paid transcription, if you need guitar tab or Guitar Pro export, or if being able to opt out of having your audio used for model training matters to you, which their paid plans offer explicitly.',
    ourFit:
      'Pick GrooveSheet if your songs run past the fifteen-minute cap, or if you want the isolated stems as well as the notation. The minutes are one pool: a four-minute song costs four minutes whether you transcribe it, separate it, or both.',
    wins: [
      'Cheaper entry plan: their Plus tier works out at $8.33 a month billed annually.',
      'Exports guitar tab and Guitar Pro files; GrooveSheet exports standard notation only.',
      'A longer free trial of full features: 14 days of two-minute transcriptions, plus an always-free 30-second tier.',
      'Paid plans let you opt out of having your audio used to train their models.',
      'Publishes an API and batch processing on an enterprise plan.',
    ],
    ours: [
      'No cap on how long a single track may be; Songscription’s paid plans stop at 15 minutes per transcription.',
      'Separates the recording into isolated stems you can solo, mute and download.',
      'One pool of minutes spent across transcription and separation, rather than credits for transcription alone.',
      'A public library of transcribed songs you can browse and download without an account.',
    ],
    rows: [
      { label: 'Free tier', theirs: 'Unlimited 30-second transcriptions, no downloads' },
      { label: 'Entry paid plan', theirs: '$8.33/month billed annually ($99.90/year), 60 minutes a month' },
      { label: 'Next plan up', theirs: '$24.99/month billed annually ($299.90/year), 300 minutes a month' },
      { label: 'Longest single transcription', theirs: '15 minutes on paid plans' },
      { label: 'Notation exports', theirs: 'PDF, MusicXML, MIDI, Guitar Pro' },
      { label: 'Guitar tab', theirs: 'Yes' },
      { label: 'Isolated stems', theirs: null },
      { label: 'Opt out of model training', theirs: 'Yes, on paid plans' },
      { label: 'API access', theirs: 'On the enterprise plan' },
      { label: 'Browsable library of transcriptions', theirs: null },
    ],
    faq: [
      {
        question: 'Which one is cheaper?',
        answer:
          'Songscription, at the entry tier, if you only need transcription and your songs are under fifteen minutes. Compare on minutes rather than on the monthly figure, and note that GrooveSheet’s minutes also buy stem separation, which is a separate purchase or not available elsewhere.',
      },
      {
        question: 'Does GrooveSheet cap how long a song can be?',
        answer:
          'No. A track costs its own length in minutes from your balance, however long it runs. The only limit is on file size, currently {maxUploadMb} MB.',
      },
      {
        question: 'Can I try both before paying?',
        answer:
          'Yes. Songscription transcribes 30 seconds free with no time limit on the offer, and runs a 14-day trial of two-minute transcriptions. GrooveSheet previews the first 10 seconds of any song free. The GrooveSheet library is also free to browse and download in full.',
      },
    ],
  },
  {
    slug: 'anthemscore',
    name: 'AnthemScore',
    site: 'lunaverus.com',
    source: 'https://lunaverus.com/',
    checked: '2026-09-25',
    title: 'GrooveSheet vs AnthemScore',
    description:
      'Desktop software you buy once against a web tool you pay by the minute. How GrooveSheet and AnthemScore differ, read from Lunaverus’s own pages on 25 September 2026.',
    heading: 'GrooveSheet vs AnthemScore',
    lede:
      'This is the one comparison in the category that is really about ownership. AnthemScore is desktop software for Windows, Mac and Linux that you buy once and keep, with a deep manual editor for fixing what the model got wrong. GrooveSheet runs in a browser, charges by the minute of audio, and separates the recording into isolated parts as well as transcribing it.',
    theirFit:
      'Pick AnthemScore if you transcribe often enough that a one-time price beats a running one, if you want the files and the software on your own machine, or if you want to correct a transcription note by note in a proper editor rather than exporting to MuseScore to do it.',
    ourFit:
      'Pick GrooveSheet if you transcribe occasionally and would rather not buy software, if you work from a phone or a machine you cannot install on, or if you want the isolated stems to play along with.',
    wins: [
      'One-time purchase from $29, with no subscription and no per-minute cost.',
      'Runs offline on your own machine: Windows, Mac and Linux.',
      'A full manual note editor, with time and key signature changes, triplets and measure editing.',
      'Exports tablature as well as standard notation.',
      'Batch processing of many files on the Studio edition.',
    ],
    ours: [
      'Separates the recording into isolated stems you can solo, mute and download.',
      'Nothing to install, and it runs on a phone.',
      'Plays the transcription against the original recording rather than only the notation.',
      'A public library of transcribed songs you can browse and download without an account.',
    ],
    rows: [
      { label: 'How you pay', theirs: 'One-time purchase, desktop; the web version is a subscription' },
      { label: 'Price', theirs: 'Lite $29, Professional $39, Studio $99' },
      { label: 'Free trial', theirs: 'First 30 seconds of each song, 100 transcriptions total' },
      { label: 'Runs on', theirs: 'Windows, Mac, Linux; also a browser version' },
      { label: 'Works offline', theirs: 'Yes, on the desktop app' },
      { label: 'Notation exports', theirs: 'PDF on Lite; MIDI and MusicXML from Professional up' },
      { label: 'Manual note editing', theirs: 'Yes, a full editor' },
      { label: 'Tablature', theirs: 'Yes' },
      { label: 'Isolated stems', theirs: null },
      { label: 'Browsable library of transcriptions', theirs: null },
    ],
    faq: [
      {
        question: 'Is buying AnthemScore cheaper than paying GrooveSheet by the minute?',
        answer:
          'It depends entirely on how much you transcribe. AnthemScore Professional is $39 once. Work out how many minutes of audio a year you expect to run, price that against GrooveSheet’s minutes, and remember that only one of the two also separates stems.',
      },
      {
        question: 'Can I edit a GrooveSheet transcription the way AnthemScore lets me?',
        answer:
          'Not in the browser. GrooveSheet exports MusicXML and MIDI, and you edit in MuseScore, Sibelius, Dorico, Finale or a DAW. AnthemScore has its own editor built in, which is faster if you correct a lot.',
      },
      {
        question: 'Does AnthemScore separate stems?',
        answer:
          'Its pages describe note, percussion, beat and instrument detection for transcription, and do not list isolated stem downloads. Check their site for the current answer; this page was read on 25 September 2026.',
      },
    ],
  },
];

export const comparePath = (c: Pick<Competitor, 'slug'>) => `/compare/${c.slug}`;

export const competitorBySlug = (slug: string): Competitor | undefined =>
  COMPETITORS.find((c) => c.slug === slug);

/** Every comparison path, plus the index, for the route table and sitemap. */
export function comparePaths(): string[] {
  return ['/compare', ...COMPETITORS.map(comparePath)];
}
