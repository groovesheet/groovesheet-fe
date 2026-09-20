/* The band that closes a post.

   It sends the reader to the tool that matches what they were just reading
   about, which is the whole reason the blog exists. The match is made on the
   post's own SEO keyword, so a post about stems offers the stem splitter and
   a post about MIDI offers the converter, with the transcriber as the default
   because that is the main product.

   The paths are the money pages in scripts/pipeline.config.json. They live in
   the CRA app, so these are plain anchors, not next/link. */

type Cta = { href: string; label: string; line: string };

const TRANSCRIBE: Cta = {
  href: "/",
  label: "Transcribe a Song",
  line: "Upload a track and get editable notation back. PDF, MusicXML and MIDI.",
};

const BY_KEYWORD: { match: RegExp; cta: Cta }[] = [
  {
    match: /stem|vocal|separat|isolat|karaoke|backing track/i,
    cta: {
      href: "/stem-splitter",
      label: "Split a Track Into Stems",
      line: "Separate vocals, drums, bass and the rest, then preview each one before you download.",
    },
  },
  {
    match: /midi|daw|ableton|logic|fl studio|reaper|piano roll/i,
    cta: {
      href: "/midi-converter",
      label: "Convert Audio to MIDI",
      line: "Get DAW-ready MIDI from a recording, with the detected pitches and timing shown first.",
    },
  },
];

export default function FinalCta({ keyword }: { keyword?: string }) {
  const cta = BY_KEYWORD.find((r) => r.match.test(keyword ?? ""))?.cta ?? TRANSCRIBE;
  return (
    <section className="band final-cta">
      <div className="gs-container final-cta-inner">
        <div>
          <h2 className="gs-title-md">{cta.label}</h2>
          <p className="final-cta-line">{cta.line}</p>
        </div>
        <div className="final-cta-actions">
          <a className="gs-btn gs-btn--primary gs-btn--lg" href={cta.href}>
            {cta.label}
          </a>
          <a className="gs-btn gs-btn--outline-on-dark gs-btn--lg" href="/pricing">
            See Pricing
          </a>
        </div>
      </div>
    </section>
  );
}
