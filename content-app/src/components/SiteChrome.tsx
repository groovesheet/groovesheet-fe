/* The GrooveSheet header and footer, rebuilt for this app.

   The real ones live in groovesheet-fe/src/components/layout/. This is a
   separate Next.js build with no shared module graph, so they cannot be
   imported; they are rebuilt here against the same tokens and the same
   1414px container, and every link points back at the CRA app, which serves
   every route except /blog. The nav order matches Header.js.

   Because these links leave this app, they are plain <a> and not next/link:
   a client-side navigation to /pricing would 404 here. */
import Link from "next/link";

const PRODUCTS = [
  { href: "/", label: "Music Transcription" },
  { href: "/stem-splitter", label: "Stem Splitter" },
  { href: "/midi-converter", label: "MIDI Converter" },
];

const NAV = [
  { href: "/explore", label: "Explore" },
  { href: "/pricing", label: "Pricing" },
  { href: "/help", label: "Help" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-logo" aria-label="GrooveSheet">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/Logo_White.png" alt="GrooveSheet" height={32} />
        </a>
        <nav className="site-nav" aria-label="Main">
          {/* The three tools sit under one Products control, as they do in
              groovesheet-fe's Header.js. Listing them flat made the nav wrap
              onto a second row at 1024px. <details> rather than a React
              dropdown so this stays a server component and works without JS. */}
          <details className="site-products">
            <summary className="site-nav-item">Products</summary>
            <div className="site-products-menu">
              {PRODUCTS.map((p) => (
                <a key={p.href} href={p.href}>
                  {p.label}
                </a>
              ))}
            </div>
          </details>
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="site-nav-item">
              {n.label}
            </a>
          ))}
          <Link href="/blog" className="site-nav-item is-active">
            Blog
          </Link>
        </nav>
        <a href="/" className="gs-btn gs-btn--primary site-header-cta">
          Transcribe a Song
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/Logo_White.png" alt="GrooveSheet" height={26} />
          <p className="site-footer-tagline">
            Upload a song, get editable notation. PDF, MusicXML and MIDI.
          </p>
        </div>
        <div className="site-footer-cols">
          <div className="site-footer-col">
            <h2 className="gs-caption-strong">Product</h2>
            {PRODUCTS.map((p) => (
              <a key={p.href} href={p.href}>
                {p.label}
              </a>
            ))}
            <a href="/developers">API</a>
          </div>
          <div className="site-footer-col">
            <h2 className="gs-caption-strong">Company</h2>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <Link href="/blog">Blog</Link>
          </div>
          <div className="site-footer-col">
            <h2 className="gs-caption-strong">Legal</h2>
            <a href="/terms">Terms</a>
            <a href="/privacy-policy">Privacy</a>
            <a href="/refund-policy">Refunds</a>
          </div>
        </div>
      </div>
      <div className="site-footer-rule" />
      <div className="site-footer-inner site-footer-fine">
        <span>&copy; {new Date().getFullYear()} GrooveSheet</span>
      </div>
    </footer>
  );
}
