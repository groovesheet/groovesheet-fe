'use client';

import { useParams } from 'next/navigation';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { normalizeHandle } from '@/lib/creatorApi';
import { Link } from '@/lib/navigation';
import './CreatorProfile.css';

/** The creator-specific 404, as the CRA page drew it. */
export default function CreatorNotFound() {
  const { username } = useParams<{ username: string }>();
  let handle = '';
  try {
    handle = normalizeHandle(decodeURIComponent(username || ''));
  } catch {
    handle = normalizeHandle(username);
  }

  return (
    <div className="creator-page">
      <div className="dot-grid" />
      <Header />
      <main className="creator-main">
        <div className="creator-notfound">
          <div className="creator-404">404</div>
          <h1 className="creator-title">We couldn&apos;t find that creator</h1>
          <p className="creator-notfound-sub">
            The profile <span>@{handle || 'unknown'}</span> doesn&apos;t exist, or it may have been removed.
          </p>
          <Link href="/explore" className="cp-btn cp-btn-primary">
            Browse Explore
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
