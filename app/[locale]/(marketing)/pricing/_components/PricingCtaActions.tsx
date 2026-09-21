'use client';

import { useUser } from '@/lib/auth';
import { LocalizedLink } from '@/lib/navigation';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';

/**
 * The final call to action's buttons. Signed in, the primary one goes to the
 * uploader; signed out it opens sign-in. The server renders the signed-out
 * state, since the page is the same for every visitor.
 */
export default function PricingCtaActions() {
  const { isSignedIn } = useUser();
  const { openLoginModal } = useLoginModal();

  return (
    <div className="pp-cta-actions">
      {isSignedIn ? (
        <LocalizedLink to="/" className="gs-btn gs-btn-primary">
          Go to upload
        </LocalizedLink>
      ) : (
        <button type="button" className="gs-btn gs-btn-primary" onClick={openLoginModal}>
          Get started free
        </button>
      )}
      <LocalizedLink to="/about" className="gs-btn gs-btn-outline">
        Talk to us
      </LocalizedLink>
    </div>
  );
}
