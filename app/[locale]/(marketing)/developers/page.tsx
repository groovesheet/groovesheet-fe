import { ArrowRight, Gauge, Info, Stack, Timer, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import ApiJobDemo from './_components/ApiJobDemo';
import ApiQuickstartCode from './_components/ApiQuickstartCode';
import { GATED, RESPONSE_CODE, card, codeChip, ghostBtn, hlJson, monoLabel, primaryBtn, sectionTitle } from './_components/apiStyles';
import './_components/ApiPage.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/developers', locale);
}

const CAPABILITIES = [
  {
    title: 'Separate stems',
    body: 'Split any track into isolated drums, bass, piano, and vocal stems.',
    svg: (
      <>
        <path d="M2 12h6l2.5-5 4 11 3-8 2.5 4H36" />
        <path d="M2 27h7l2.5-4 4 7 3-9 2.5 5H35" opacity=".45" />
      </>
    ),
  },
  {
    title: 'Transcribe parts',
    body: 'Turn drums, piano, or bass into clean, quantized notation with tempo and time signature.',
    svg: (
      <>
        <path d="M3 10h32M3 18h32M3 26h32" opacity=".35" />
        <circle cx="12" cy="26" r="3.4" />
        <path d="M15.4 26V9l9 2.4v3" />
      </>
    ),
  },
  {
    title: 'MIDI → score',
    body: 'Convert detected MIDI into engraved MusicXML and a print-ready PDF score.',
    svg: (
      <>
        <rect x="3" y="9" width="5" height="3.4" rx="1" />
        <rect x="3" y="17" width="9" height="3.4" rx="1" />
        <rect x="3" y="25" width="6" height="3.4" rx="1" />
        <path d="M17 19h11m0 0-4-4m4 4-4 4" />
        <path d="M33 12v15" />
        <circle cx="30.5" cy="27" r="2.6" />
      </>
    ),
  },
  {
    title: 'Async jobs + webhooks',
    body: "Fire a job, get a webhook the moment it's done. No long-polling required.",
    svg: (
      <>
        <path d="M9 13a12 12 0 1 1-2.5 9.5" />
        <path d="M6.5 22.5 4 27l5.5-1" />
        <circle cx="28" cy="11" r="3.2" />
      </>
    ),
  },
];

const STEPS = [
  {
    n: '01',
    title: 'POST a job',
    body: (
      <>
        Send an audio URL and a workflow. The job is queued and returns a{' '}
        <code
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontSize: '12.5px',
            background: 'var(--color-surface-light)',
            padding: '1px 6px',
            borderRadius: '4px',
            color: 'var(--color-foreground)',
          }}
        >
          job_id
        </code>{' '}
        instantly.
      </>
    ),
    chip: (
      <>
        <span style={{ color: '#c084fc' }}>POST</span> <span style={{ color: '#7aa3ff' }}>/v1/jobs</span>
      </>
    ),
  },
  {
    n: '02',
    title: 'Poll or get a webhook',
    body: "Check status when you like, or register a webhook and we'll call you on completion.",
    chip: (
      <>
        <span style={{ color: '#7d7c7e' }}>event:</span> <span style={{ color: '#6ce5a3' }}>transcription.completed</span>
      </>
    ),
  },
  {
    n: '03',
    title: 'Download assets',
    body: 'Pull MIDI, MusicXML, isolated stems, and the engraved PDF score from signed URLs.',
    chip: (
      <>
        <span style={{ color: '#c084fc' }}>GET</span> <span style={{ color: '#7aa3ff' }}>/v1/jobs/{'{id}'}</span>
      </>
    ),
  },
];

const LIMITS = [
  {
    Icon: Timer,
    label: 'Minutes',
    value: '1 min = 1 credit',
    body: 'API jobs draw from the same monthly minute allowance as your account.',
  },
  {
    Icon: Gauge,
    label: 'Rate limits',
    value: '60 req / min',
    body: 'Beta default. Bursts above the limit queue automatically rather than failing.',
  },
  {
    Icon: Stack,
    label: 'Concurrency',
    value: '5 parallel jobs',
    body: 'Higher queue tiers lift the cap and add priority processing on Pro plans.',
  },
];

export default async function DevelopersPage(props: LocaleParams) {
  await routeLocale(props);
  const gated = GATED;

  return (
    <div className="api-page">
      <div className="api-dot-grid" />
      <Header />

      <div className="api-content">
        {/* The public API is not live yet: this page previews the planned
            developer surface. Be explicit so nobody codes against /v1. */}
        <div
          role="status"
          style={{
            maxWidth: '1190px',
            margin: '18px auto 0',
            padding: '12px 18px',
            borderRadius: 8,
            border: '1px solid var(--color-warning, #f59e0b)',
            color: 'var(--color-warning, #f59e0b)',
            background: 'rgba(245,158,11,.08)',
            fontSize: 14,
          }}
        >
          The GrooveSheet API is in private development and not yet live {'\u2014'} the endpoints below are a preview of
          what&apos;s coming. Want early access? Email{' '}
          <a href="mailto:support@groovesheet.net" style={{ color: 'inherit' }}>
            support@groovesheet.net
          </a>
          .
        </div>
        {/* ============ HERO ============ */}
        <section
          className="api-hero"
          style={{
            maxWidth: '1190px',
            margin: '0 auto',
            padding: '56px 24px 64px',
            display: 'grid',
            gridTemplateColumns: '1.05fr 1fr',
            gap: '56px',
            alignItems: 'center',
          }}
        >
          <div style={{ maxWidth: '560px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '120px',
                background: 'var(--color-panel2)',
                marginBottom: '22px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  boxShadow: '0 0 8px rgba(1,47,167,.8)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: '11px',
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--color-foreground)',
                }}
              >
                {gated ? 'Private beta' : 'Now in beta'}
              </span>
            </div>

            <h1
              style={{
                fontSize: '58px',
                lineHeight: 1.04,
                letterSpacing: '-1.2px',
                fontWeight: 400,
                margin: '0 0 20px',
              }}
            >
              GrooveSheet API
            </h1>
            <p
              style={{
                fontSize: '21px',
                lineHeight: 1.5,
                color: 'var(--color-muted-foreground)',
                margin: '0 0 32px',
              }}
            >
              Transcribe audio to MIDI, MusicXML, and stems {'\u2014'} programmatically. The engine behind the app,
              exposed as a simple async job API.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <a href="#request" className="api-btn-primary" style={primaryBtn}>
                {gated ? 'Request API access' : 'Get your API key'}
              </a>
              <a href="#docs" className="api-btn-ghost" style={ghostBtn}>
                Read the docs
              </a>
            </div>

            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Info size={15} color="var(--color-muted-foreground)" />
              <span style={{ fontSize: '13.5px', color: 'var(--color-muted-foreground)' }}>
                {gated
                  ? 'Self-serve keys are coming. Join the waitlist for early access.'
                  : 'Free during beta \u2014 usage metered in the same minutes as the app.'}
              </span>
            </div>
          </div>

          {/* Hero terminal / live job demo */}
          <ApiJobDemo />
        </section>

        {/* ============ WHAT YOU CAN DO ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '64px 24px' }}>
          <p style={monoLabel}>What you can do</p>
          <h2 style={sectionTitle}>Everything the app does, callable from your stack.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
              gap: '18px',
            }}
          >
            {CAPABILITIES.map((f) => (
              <div key={f.title} style={card}>
                <div style={{ color: 'var(--color-foreground)', marginBottom: '20px' }}>
                  <svg
                    width="38"
                    height="38"
                    viewBox="0 0 38 38"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {f.svg}
                  </svg>
                </div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 500,
                    margin: '0 0 9px',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: 0,
                  }}
                >
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}>
          <p style={monoLabel}>How it works</p>
          <h2 style={sectionTitle}>Three calls from audio to score.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: '18px',
            }}
          >
            {STEPS.map((s) => (
              <div key={s.n} style={{ ...card, padding: '28px' }}>
                <div
                  style={{
                    fontSize: '40px',
                    fontWeight: 300,
                    color: 'var(--color-surface-muted)',
                    lineHeight: 1,
                    marginBottom: '18px',
                  }}
                >
                  {s.n}
                </div>
                <h3
                  style={{
                    fontSize: '19px',
                    fontWeight: 500,
                    margin: '0 0 10px',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: '0 0 16px',
                  }}
                >
                  {s.body}
                </p>
                <div style={codeChip}>{s.chip}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ============ QUICKSTART ============ */}
        <section style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}>
          <div
            className="api-quickstart-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '0.85fr 1.15fr',
              gap: '48px',
              alignItems: 'start',
            }}
          >
            <div style={{ paddingTop: '8px' }}>
              <p style={monoLabel}>Quickstart</p>
              <h2 style={{ ...sectionTitle, margin: '0 0 16px' }}>One request to your first score.</h2>
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: 1.6,
                  color: 'var(--color-muted-foreground)',
                  margin: '0 0 22px',
                }}
              >
                Authenticate with a bearer token, point us at a track, and pick a workflow. Everything else is async.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'var(--color-panel2)',
                }}
              >
                <WarningCircle size={15} color="var(--color-muted-foreground)" />
                <span style={{ fontSize: '12.5px', color: 'var(--color-muted-foreground)' }}>
                  Endpoints shown are illustrative placeholders.
                </span>
              </div>
            </div>

            <div>
              {/* request block */}
              <ApiQuickstartCode />

              {/* response block */}
              <div
                style={{
                  marginTop: '14px',
                  background: '#1b191c',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(255,255,255,.02)',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: '#22c55e',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-family-mono)',
                      fontSize: '11.5px',
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    200 {'·'} response
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '14px 18px 18px',
                    fontFamily: 'var(--font-family-mono)',
                    fontSize: '12.5px',
                    lineHeight: 1.65,
                    color: 'var(--color-foreground)',
                    overflowX: 'auto',
                    whiteSpace: 'pre',
                  }}
                  dangerouslySetInnerHTML={{ __html: hlJson(RESPONSE_CODE) }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============ PRICING / LIMITS ============ */}
        <section id="pricing" style={{ maxWidth: '1190px', margin: '0 auto', padding: '48px 24px 64px' }}>
          <p style={monoLabel}>Pricing &amp; limits</p>
          <h2 style={sectionTitle}>Metered in minutes {'\u2014'} the same currency as the app.</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(248px,1fr))',
              gap: '18px',
            }}
          >
            {LIMITS.map(({ Icon, label, value, body }) => (
              <div key={label} style={{ ...card, padding: '28px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '14px',
                  }}
                >
                  <Icon size={20} color="var(--color-foreground)" />
                  <span
                    style={{
                      fontSize: '13px',
                      textTransform: 'uppercase',
                      letterSpacing: '.1em',
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '32px',
                    fontWeight: 300,
                    margin: '0 0 8px',
                    color: 'var(--color-text)',
                  }}
                >
                  {value}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'var(--color-muted-foreground)',
                    margin: 0,
                  }}
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
          <a
            href="#pricing"
            className="api-link-arrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              marginTop: '24px',
              fontSize: '15px',
              color: 'var(--color-foreground)',
              fontWeight: 500,
            }}
          >
            See full pricing <ArrowRight size={15} />
          </a>
        </section>

        {/* ============ ACCESS ============ */}
        <section id="request" style={{ maxWidth: '1190px', margin: '0 auto', padding: '40px 24px 96px' }}>
          <div
            style={{
              background: 'var(--color-panel2)',
              borderRadius: '20px',
              padding: '64px 40px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(circle, var(--color-dot-pattern) 1.5px, transparent 1.5px)',
                backgroundSize: '38px 38px',
                opacity: 0.3,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative' }}>
              <h2
                style={{
                  fontSize: '38px',
                  letterSpacing: '-.8px',
                  fontWeight: 400,
                  margin: '0 0 14px',
                }}
              >
                Building with GrooveSheet?
              </h2>
              <p
                style={{
                  fontSize: '17px',
                  lineHeight: 1.55,
                  color: 'var(--color-muted-foreground)',
                  margin: '0 auto 30px',
                  maxWidth: '480px',
                }}
              >
                {gated
                  ? "We're onboarding teams in batches during the private beta. Tell us what you're building and we'll get you a key."
                  : "Generate a key and make your first call in minutes. Usage draws from your plan's minutes."}
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}
              >
                <a href="#" className="api-btn-primary" style={{ ...primaryBtn, padding: '15px 30px' }}>
                  {gated ? 'Request access' : 'Create an API key'}
                </a>
                <a href="#" className="api-btn-ghost" style={{ ...ghostBtn, padding: '15px 28px' }}>
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
