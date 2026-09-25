/**
 * App-wide side effects that src/index.js and src/App.js ran once per page
 * load: campaign attribution capture, PostHog/Clarity boot, and the two
 * post-sign-in claim runners. Mounted once by the locale layout; renders
 * nothing.
 */
'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@/lib/auth';
import { captureAttribution, captureClickId } from '@/lib/attribution';
import { initObservability } from '@/lib/observability';
import { claimPendingPreviewIfAny } from '@/lib/previewApi';
import { claimPendingCampaignIfAny } from '@/lib/api';
import config from '@/lib/config';

export default function AppBoot() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  // Snapshot the campaign query string on the first client render, before any
  // client-side navigation drops it. Both captures are never-throw. The Google
  // Ads click id is stored separately: it is last-touch, and it has to survive
  // all the way to checkout so a payment can be traced back to its ad.
  useEffect(() => {
    captureAttribution(window.location.search, document.referrer);
    captureClickId(window.location.search);
    // No-ops entirely until the PostHog / Clarity keys are configured.
    initObservability();
  }, []);

  // When a previously-anonymous user signs in, claim any pending preview they
  // uploaded before signing up. Safe no-op when nothing is pending.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const result = await claimPendingPreviewIfAny(config.apiBaseUrl, getToken);
        if (!cancelled && result) {
          console.info('Pending preview claimed:', result);
        }
      } catch (err) {
        console.warn('Pending preview claim failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, getToken]);

  // A visitor who signed up through a /signup/:code link may land anywhere
  // after the OAuth round trip, so the campaign grant is claimed app-wide
  // rather than only on the campaign page. Idempotent server-side.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return undefined;
    // The campaign page claims for itself while it is mounted, so that it can
    // render the "credit granted" state. Claiming from here too would race it
    // and win often enough to show "already claimed" to someone who just
    // signed up.
    if (/^\/(zh-CN\/|zh-TW\/)?signup\//.test(window.location.pathname)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const result = await claimPendingCampaignIfAny('/api', getToken);
        if (!cancelled && result) {
          console.info('Campaign credit claimed:', result);
        }
      } catch (err) {
        console.warn('Campaign claim failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, isLoaded, getToken]);

  return null;
}
