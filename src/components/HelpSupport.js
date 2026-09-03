import React, { useState, useEffect, useMemo } from 'react';
import Header from './layout/Header';
import Footer from './layout/Footer';
import './HelpSupport.css';

const CONTACT = {
  whatsappNumber: '+65 8996 8765',
  whatsappHref: 'https://wa.me/6589968765',
  email: 'support@groovesheet.net',
};

const FAQ_DATA = [
  {
    id: 'getting-started',
    label: 'Getting started',
    items: [
      {
        q: 'How do I sign up or sign in?',
        a: 'Hit Sign In on the top right and pick Email, Google, Apple, or Facebook. We create your account on first sign-in — there is no separate sign-up step.',
      },
      {
        q: 'How do I split a track into stems?',
        a: 'Upload your file, then choose Stem Splitter in the workspace. We separate drums, bass, piano, and vocals so you can process each segment on its own.',
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        q: 'How do I edit my profile?',
        a: 'Open the account menu in the top right and choose Profile. You can change your display name, avatar, and email there.',
      },
      {
        q: 'How do I manage connected accounts?',
        a: 'Under Account → Connected accounts you can link or unlink Google, Apple, and Facebook. Keep at least one sign-in method connected.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Account → Delete account. This permanently removes your uploads, scores, and minute balance — it cannot be undone.',
      },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & minutes',
    items: [
      {
        q: 'What does a “minute” mean?',
        a: 'One billed minute equals one minute of your source track length, rounded up — regardless of how many instruments you export from it.',
      },
      {
        q: 'How are minutes deducted?',
        a: 'Minutes come off your balance only when a job completes successfully. Jobs that fail cost nothing.',
      },
      {
        q: 'Do minutes expire?',
        a: 'Monthly plan minutes reset each billing cycle and do not roll over. One-time top-up minutes never expire.',
      },
      {
        q: 'What happens if a job fails?',
        a: 'You are not charged any minutes. Retry from your history — re-encoding the source file usually fixes it.',
      },
      {
        q: 'How do I add more minutes?',
        a: 'Buy a one-time top-up from the Pricing page, or upgrade your plan for a higher monthly allowance.',
      },
      {
        q: 'Can I get a refund?',
        a: 'Unused top-up minutes are refundable within 14 days. See the Refund Policy for the full terms.',
      },
      {
        q: 'How do I change or cancel my plan?',
        a: 'Account → Billing → Manage plan. Changes apply on your next cycle; cancel anytime and keep access until the period ends.',
      },
    ],
  },
  {
    id: 'uploads',
    label: 'Uploads & formats',
    items: [
      { q: 'What is the maximum file size?', a: 'Up to 32 MB per file.' },
      { q: 'Which audio formats can I upload?', a: 'MP3, WAV, FLAC, and OGG.' },
      {
        q: 'What output formats do I get?',
        a: 'Every completed transcription gives you PDF, MusicXML, and MIDI.',
      },
    ],
  },
  {
    id: 'quality',
    label: 'Transcription quality',
    items: [
      {
        q: 'How do I get the cleanest notation?',
        a: 'Use studio-quality recordings, isolate the instrument where you can, and pick the right kit mapping before processing.',
      },
      {
        q: 'Do live recordings work?',
        a: 'They can, but results vary — studio-quality recordings produce the best notation.',
      },
      {
        q: 'Can it handle odd meters or tempo changes?',
        a: 'Yes. We detect tempo maps and time signatures, including odd meters, though very fluid rubato is harder to track.',
      },
      {
        q: 'Which output format should I use?',
        a: 'MusicXML for editing in notation software, MIDI for DAWs, and PDF for reading or printing.',
      },
    ],
  },
  {
    id: 'publishing',
    label: 'Publishing & Explore',
    items: [
      {
        q: 'How do I publish a score?',
        a: 'Open a finished score and hit Publish to share it on Explore.',
      },
      {
        q: 'What do the visibility options mean?',
        a: 'Public appears on Explore and in search. Unlisted is reachable by link only. Private is visible to just you.',
      },
      {
        q: 'Who can download my published score?',
        a: 'You choose: allow downloads for everyone, for signed-in users only, or for no one.',
      },
      {
        q: 'How do I unpublish?',
        a: 'Open the score → Publishing → Unpublish. It is removed from Explore immediately.',
      },
      {
        q: 'What shows on my creator profile?',
        a: 'Your public scores (and unlisted ones opened via link), your display name, and your avatar.',
      },
    ],
  },
];

const SKELETON_WIDTHS = ['62%', '48%', '70%', '54%', '66%', '44%'];

const ChevronIcon = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SearchIcon = ({ size = 22, strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={strokeWidth} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

const ArrowUpRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

function HelpSupport({ onLoginClick }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 750);
    return () => clearTimeout(t);
  }, []);

  const toggle = (id) => setOpen((s) => ({ ...s, [id]: !s[id] }));

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo(() => {
    if (!searching) return [];
    const ql = trimmed.toLowerCase();
    const out = [];
    FAQ_DATA.forEach((cat) => {
      cat.items.forEach((it, i) => {
        if ((it.q + ' ' + it.a).toLowerCase().includes(ql)) {
          out.push({ ...it, id: `r-${cat.id}-${i}`, catLabel: cat.label });
        }
      });
    });
    return out;
  }, [searching, trimmed]);

  const showBrowse = !loading && !searching;
  const showResults = !loading && searching && results.length > 0;
  const showNoResults = !loading && searching && results.length === 0;
  const resultLabel = `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${trimmed}”`;

  const clearSearch = () => setQuery('');

  return (
    <div className="help-page">
      <Header onLoginClick={onLoginClick} />

      <main className="help-main">
        {/* Hero + search */}
        <section id="top" className="help-hero">
          <h1 className="help-hero-title">Help &amp; Support</h1>
          <p className="help-hero-sub">
            Search the FAQ, or reach us directly — we usually reply within a day.
          </p>

          <div className="help-search">
            <span className="help-search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="help-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help — minutes, formats, publishing…"
              aria-label="Search help"
            />
            <div className="help-search-trailing">
              {searching && (
                <button className="help-search-clear" onClick={clearSearch} aria-label="Clear">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
              <span className="help-search-kbd">⌘K</span>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="help-faq">
          {(showResults || showNoResults) && (
            <p className="help-result-count">
              {showResults ? resultLabel : `No results for “${trimmed}”`}
            </p>
          )}

          {loading && (
            <div className="help-skeletons">
              {SKELETON_WIDTHS.map((w, i) => (
                <div key={i} className="help-skel-row">
                  <div className="help-skel-bar" style={{ maxWidth: w }} />
                  <div className="help-skel-dot" />
                </div>
              ))}
            </div>
          )}

          {showBrowse && (
            <div className="help-browse">
              {FAQ_DATA.map((cat) => (
                <section key={cat.id} id={`cat-${cat.id}`} className="help-cat">
                  <div className="help-cat-label">
                    <h3>{cat.label}</h3>
                  </div>
                  <div className="help-cat-items">
                    {cat.items.map((it, i) => {
                      const id = `${cat.id}-${i}`;
                      const isOpen = !!open[id];
                      return (
                        <div key={id} className="help-item" data-open={isOpen}>
                          <button className="help-item-btn" onClick={() => toggle(id)} aria-expanded={isOpen}>
                            <span className="help-item-q">{it.q}</span>
                            <span className={`help-item-chevron${isOpen ? ' open' : ''}`}>
                              <ChevronIcon />
                            </span>
                          </button>
                          <div className={`help-item-answer${isOpen ? ' open' : ''}`}>
                            <p>{it.a}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              <div className="help-browse-end" />
            </div>
          )}

          {showResults && (
            <div className="help-results">
              {results.map((it) => {
                const isOpen = !!open[it.id];
                return (
                  <div key={it.id} className="help-result" data-open={isOpen}>
                    <button className="help-result-btn" onClick={() => toggle(it.id)} aria-expanded={isOpen}>
                      <div className="help-result-head">
                        <span className="help-result-cat">{it.catLabel}</span>
                        <div className="help-result-q">{it.q}</div>
                      </div>
                      <span className={`help-item-chevron${isOpen ? ' open' : ''}`}>
                        <ChevronIcon size={20} />
                      </span>
                    </button>
                    <div className={`help-item-answer${isOpen ? ' open' : ''}`}>
                      <p>{it.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showNoResults && (
            <div className="help-noresults">
              <div className="help-noresults-icon">
                <SearchIcon size={30} strokeWidth={1.7} />
              </div>
              <h3>No results for “{trimmed}”</h3>
              <p>
                We couldn't find a matching answer. Reach us directly — we usually reply within a day.
              </p>
              <div className="help-noresults-actions">
                <a href="#contact" className="help-btn-primary">
                  Contact support
                </a>
                <button className="help-btn-ghost" onClick={clearSearch}>
                  Clear search
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Contact channels */}
        <section id="contact" className="help-contact">
          <div className="help-contact-head">
            <h2>Reach us directly</h2>
            <p>Three ways to talk to a human. Pick whatever's easiest.</p>
          </div>

          <div className="help-contact-grid">
            {/* WeChat featured */}
            <div className="help-wechat">
              <div className="help-wechat-body">
                <div className="help-wechat-top">
                  <span className="help-wechat-badge-icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 3C4.9 3 1.6 5.8 1.6 9.2c0 1.9 1 3.6 2.7 4.8L3.5 16l2.5-1.3c.9.3 1.9.4 3 .4h.5a5.3 5.3 0 0 1-.2-1.5c0-3.2 3.1-5.7 6.9-5.7h.4C16.1 5 12.9 3 9 3Zm-2.4 3.4a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Zm4.8 0a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
                      <path d="M22.4 14.1c0-2.8-2.8-5-6.1-5s-6.1 2.2-6.1 5 2.8 5 6.1 5c.7 0 1.4-.1 2-.3l1.9 1-.5-1.6c1.6-.9 2.7-2.4 2.7-4.1Zm-8-1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm3.8 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z" />
                    </svg>
                  </span>
                  <div>
                    <div className="help-wechat-eyebrow">Featured</div>
                    <h3>WeChat</h3>
                  </div>
                </div>
                <p className="help-wechat-desc">
                  Best for users in China — scan the code to add us on WeChat.
                </p>
                <div className="help-wechat-note">Typically replies within a day</div>
              </div>
              <div className="help-wechat-qr">
                <img src="/images/wechat-qr.png" alt="GrooveSheet WeChat QR code" />
              </div>
            </div>

            {/* WhatsApp + Email */}
            <div className="help-contact-stack">
              <a className="help-channel" href={CONTACT.whatsappHref} target="_blank" rel="noreferrer">
                <span className="help-channel-icon help-channel-icon--whatsapp">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.6-3-1.3-5-4.3-5.1-4.5-.2-.2-1.3-1.7-1.3-3.2s.8-2.3 1.1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.4.4-.2.8.2.4.9 1.4 1.9 2.3 1.2 1.1 2.3 1.4 2.6 1.6.3.1.5.1.7-.1l.8-.9c.2-.2.4-.2.6-.1l2 .9c.3.1.5.3.6.4.1.2.1.8-.1 1.5Z" />
                  </svg>
                </span>
                <div className="help-channel-body">
                  <h3>WhatsApp</h3>
                  <div className="help-channel-line">{CONTACT.whatsappNumber} · click to chat</div>
                  <div className="help-channel-note">Replies within a few hours, Mon–Fri</div>
                </div>
                <span className="help-channel-arrow">
                  <ArrowUpRight />
                </span>
              </a>

              <a className="help-channel" href={`mailto:${CONTACT.email}`}>
                <span className="help-channel-icon help-channel-icon--email">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                    <path d="M3 6l9 6.5L21 6" />
                  </svg>
                </span>
                <div className="help-channel-body">
                  <h3>Email</h3>
                  <div className="help-channel-line">{CONTACT.email}</div>
                  <div className="help-channel-note">We usually reply within a day</div>
                </div>
                <span className="help-channel-arrow">
                  <ArrowUpRight />
                </span>
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

export default HelpSupport;
