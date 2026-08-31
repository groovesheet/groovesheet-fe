import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth';

// Set by pages that must be returned to after the OAuth round trip (currently
// the campaign signup page, which shows the "credit granted" state on return).
const POST_AUTH_REDIRECT_KEY = 'gs_post_auth_redirect';

// Only ever honour a same-origin, absolute path we wrote ourselves. Anything
// else — a full URL, a protocol-relative "//evil.com" — is discarded, so a
// tampered localStorage value can't turn sign-in into an open redirect.
function takeReturnPath() {
  try {
    const stored = localStorage.getItem(POST_AUTH_REDIRECT_KEY);
    localStorage.removeItem(POST_AUTH_REDIRECT_KEY);
    if (!stored || !stored.startsWith('/') || stored.startsWith('//')) return '/';
    return stored;
  } catch (_) {
    return '/';
  }
}

export default function SSOCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const finish = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = new URLSearchParams(window.location.search);

        if (queryParams.get('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        } else if (hashParams.get('access_token') && hashParams.get('refresh_token')) {
          const { error } = await supabase.auth.setSession({
            access_token: hashParams.get('access_token'),
            refresh_token: hashParams.get('refresh_token'),
          });
          if (error) throw error;
        }
      } catch (error) {
        console.error('Error completing SSO callback:', error);
      } finally {
        if (mounted) navigate(takeReturnPath(), { replace: true });
      }
    };

    finish();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return <div style={{ padding: '2rem', color: 'white' }}>Signing you in…</div>;
}
