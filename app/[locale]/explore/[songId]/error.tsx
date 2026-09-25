'use client';

import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { Link } from '@/lib/navigation';
import '@/components/player/song/Song.css';

/**
 * The library API failed for a reason other than 404 (a 5xx, a rate limit).
 * That is an outage, not a missing track, so it gets a retry instead of the
 * 404 page, and nothing about it is cached.
 */
export default function SongError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="gs-song-page">
      <Header />
      <div className="gs-nav-divider" />
      <div style={{ padding: '120px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
          Could not load this track
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', marginBottom: 18 }}>
          The library did not answer. Try again in a moment.
        </p>
        <div style={{ display: 'inline-flex', gap: 10 }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid var(--color-border-light)',
              background: 'var(--color-surface-light)',
              color: 'var(--color-text)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <Link
            href="/explore"
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text)',
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            Back to explore
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
