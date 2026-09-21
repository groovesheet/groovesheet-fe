import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

/**
 * Last-resort 404 for requests that never reach a locale segment (proxy.ts
 * skips paths with a dot, for example). The root layout is a pass-through, so
 * this renders its own document with no providers: no Header, Footer or
 * auth. It shows the same design artwork as the localized 404
 * (components/NotFound) and keeps a real <h1> and link for no-JS clients.
 */
export const metadata: Metadata = {
  title: 'Page not found | GrooveSheet',
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" data-theme="dark">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h1
            style={{
              position: 'absolute', width: 1, height: 1, margin: -1, padding: 0,
              overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
            }}
          >
            Page not found
          </h1>
          <iframe
            title="Page not found"
            src="/design/not-found.html"
            style={{ flex: 1, width: '100%', minHeight: '100vh', border: 'none', display: 'block' }}
          />
          <noscript>
            <p style={{ textAlign: 'center', padding: 24 }}>
              <Link href="/">Back to GrooveSheet</Link>
            </p>
          </noscript>
        </main>
      </body>
    </html>
  );
}
