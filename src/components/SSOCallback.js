import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../auth';

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
        if (mounted) navigate('/', { replace: true });
      }
    };

    finish();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return <div style={{ padding: '2rem', color: 'white' }}>Signing you in…</div>;
}
