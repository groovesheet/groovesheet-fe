import React from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './Changelog.css';

// Static changelog entries, newest first. Update this list when shipping.
const ENTRIES = [
  {
    date: 'June 24, 2026',
    datetime: '2026-06-24',
    version: '1.4',
    tags: ['new', 'improved'],
    title: 'Batch uploads and a faster drum model',
    body: [
      'Upload up to 10 tracks at once — they queue and process in the background while you keep working.',
      'gs-drums-v3 runs about 40% faster and holds onto ghost notes through busy fills.',
      'The tempo map now follows gradual accelerandos instead of snapping to a single BPM.',
    ],
    caption: 'Batch queue — ten tracks transcribing at once, newest at the top.',
  },
  {
    date: 'May 30, 2026',
    datetime: '2026-05-30',
    version: '1.3',
    tags: ['new'],
    title: 'Piano transcription leaves beta',
    body: [
      'Full piano notation with separate treble and bass staves, plus pedal markings.',
      'Export piano parts to MusicXML for Sibelius, MuseScore and Dorico.',
    ],
  },
  {
    date: 'May 12, 2026',
    datetime: '2026-05-12',
    version: '1.2',
    tags: ['improved', 'fixed'],
    title: 'Cleaner exports and kit mapping',
    body: [
      'PDF scores now respect your saved kit-mapping preset on every export.',
      'Fixed: MIDI files no longer drop the last bar on tracks that end mid-beat.',
      'Fixed: time signatures other than 4/4 rendered with the wrong note grouping.',
    ],
  },
  {
    date: 'April 28, 2026',
    datetime: '2026-04-28',
    version: '1.1',
    tags: ['fixed'],
    title: 'Stability fixes',
    body: [
      'Large FLAC uploads over 20 MB occasionally timed out — resolved.',
      'The progress bar could stall at 99% after a job had already finished.',
    ],
  },
];

const BADGE_LABELS = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

function CaptionArt() {
  return (
    <svg
      width="128"
      height="62"
      viewBox="0 0 128 62"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 14h112M8 24h112M8 34h112M8 44h112" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M22 34v-16M22 18l10-2v15" />
      <circle cx="20" cy="34" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="31" r="3.2" fill="currentColor" stroke="none" />
      <path d="M58 38v-20M58 18l11-2.5v18" />
      <circle cx="56" cy="38" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="67" cy="33.5" r="3.2" fill="currentColor" stroke="none" />
      <path d="M96 30v-14M96 16l9-1.5v13" />
      <circle cx="94" cy="30" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="103" cy="27.5" r="3.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Changelog({ onLoginClick }) {
  return (
    <div className="changelog-page">
      <Header onLoginClick={onLoginClick} />

      <main className="changelog-main">
        <div className="changelog-head">
          <div>
            <h1 className="changelog-title">Changelog</h1>
            <p className="changelog-subtitle">What's new in GrooveSheet.</p>
          </div>
          <button type="button" className="changelog-subscribe">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 4h16v12H5.2L4 18.5z" />
              <path d="M8 9h8M8 12h5" />
            </svg>
            Subscribe for updates
          </button>
        </div>

        <ol className="changelog-list">
          <div className="changelog-rail" aria-hidden="true" />
          {ENTRIES.map((entry, i) => {
            const isLatest = i === 0;
            return (
              <li className="changelog-item" key={entry.datetime}>
                <span
                  className={`changelog-dot${isLatest ? ' is-latest' : ''}`}
                  aria-hidden="true"
                />
                <article className="changelog-card">
                  <div className="changelog-card-head">
                    <div className="changelog-meta">
                      <h2 className="changelog-entry-title">{entry.title}</h2>
                      <div className="changelog-datewrap">
                        <time className="changelog-date" dateTime={entry.datetime}>
                          {entry.date}
                        </time>
                        {entry.version && (
                          <>
                            <span className="changelog-sep" aria-hidden="true">
                              ·
                            </span>
                            <span className="changelog-version">v{entry.version}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="changelog-badges">
                      {entry.tags.map((tag) => (
                        <span key={tag} className={`changelog-badge badge-${tag}`}>
                          {BADGE_LABELS[tag]}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ul className="changelog-body">
                    {entry.body.map((line, j) => (
                      <li key={j}>
                        <span className="changelog-bullet" aria-hidden="true" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  {entry.caption && (
                    <div className="changelog-image">
                      <CaptionArt />
                      <span className="changelog-caption">{entry.caption}</span>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </main>

      <Footer />
    </div>
  );
}

export default Changelog;
