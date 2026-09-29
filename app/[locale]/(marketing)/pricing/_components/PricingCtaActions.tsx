'use client';

import { useUser } from '@/lib/auth';
import { LocalizedLink } from '@/lib/navigation';

/**
 * The final call to action's buttons. The primary one goes to the uploader for
 * everyone: the first step is a free preview that needs no account, so asking
 * a signed-out visitor to sign in first (the old "Get started free") put a
 * wall in front of the free part.
 */
export default function PricingCtaActions() {
  const { isSignedIn } = useUser();

  return (
    <div className="pp-cta-actions">
      <LocalizedLink to="/" className="gs-btn gs-btn-primary">
        {isSignedIn ? 'Go to upload' : 'Try a free preview'}
      </LocalizedLink>
      <LocalizedLink to="/about" className="gs-btn gs-btn-outline">
        Talk to us
      </LocalizedLink>
    </div>
  );
}
