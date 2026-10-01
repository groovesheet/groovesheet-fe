'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useAuth, useUser } from '@/lib/auth';
import { claimPendingPreviewIfAny } from '@/lib/previewApi';
import { FUNNEL, trackFunnel } from '@/lib/analytics';
import {
  clearFullSongIntent,
  currentPathForIntent,
  fullSongIntentFor,
  markFullSongCheckout,
  saveFullSongIntent,
} from '@/lib/fullSongIntent';
import { openCheckout, usePaywall, type PaywallMode } from '@/components/billing/OutOfMinutesModal';
import { useLoginModal } from '@/components/chrome/LoginModalProvider';
import config from '@/lib/config';

/** What asking the server for the full song came to. */
export type UpgradeOutcome =
  | { kind: 'started' }
  | { kind: 'out_of_minutes'; message: string | null }
  | { kind: 'failed' };

export type UpgradeTrigger = 'click' | 'after_signin' | 'after_checkout';

interface Options {
  /** Upload card name, as in the funnel events ('transcribe', 'stem_splitter', 'midi_converter'). */
  surface: string;
  /** The preview (PRV*) or full run on screen. */
  jobId: string | null;
  /** True once the finished preview is on screen. */
  ready: boolean;
  instrument: string;
  fileName?: string | null;
  /** Save what the card needs to show this preview again after a page load. */
  persistPreview: () => void;
  /** Ask the server for the full song. Must not open the paywall itself. */
  upgrade: (trigger: UpgradeTrigger) => Promise<UpgradeOutcome>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * "Get the full song", start to finish, for the three upload cards.
 *
 * - Signed in: ask for the full song; out of minutes opens the paywall.
 * - Signed out: the paywall opens in its signed-out form, with prices, before
 *   any sign-up. Picking a pack (or "I have a plan") remembers the preview and
 *   opens sign-in.
 * - Back from sign-in or Checkout (often a full page load): once the card has
 *   restored the preview, carry on by itself. Full song if the account now has
 *   minutes; otherwise straight to Checkout for the pack already picked, or the
 *   paywall.
 */
export function useFullSongFlow({ surface, jobId, ready, instrument, fileName, persistPreview, upgrade }: Options): {
  /** The result view's button for signed-in visitors. */
  requestFullSong: () => Promise<void>;
  /** The result view's button for signed-out visitors. */
  getFullSongSignedOut: () => void;
  /** For a 402 outside the full-song button (an upload refused for minutes). */
  showPaywall: (message: string | null, previewId?: string | null, mode?: PaywallMode) => void;
  paywall: ReactNode;
} {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { openLoginModal } = useLoginModal();

  // The latest props, for callbacks that outlive the render that made them.
  const latest = useRef({ jobId, instrument, fileName, persistPreview, upgrade });
  useEffect(() => {
    latest.current = { jobId, instrument, fileName, persistPreview, upgrade };
  });

  const rememberPreview = useCallback(
    (plan: string | null, stage: 'signin' | 'checkout') => {
      const { jobId: id, instrument: inst, fileName: name, persistPreview: persist } = latest.current;
      if (!id || !id.startsWith('PRV')) return;
      saveFullSongIntent({
        surface,
        previewId: id,
        path: currentPathForIntent(),
        instrument: inst,
        fileName: name || undefined,
        plan: plan || undefined,
        stage,
      });
      persist();
    },
    [surface]
  );

  const { showPaywall, paywall } = usePaywall(surface, {
    onSignInToBuy: (plan) => {
      rememberPreview(plan, 'signin');
      openLoginModal();
    },
    // Paying from the paywall leaves the site; come back to this preview.
    onBeforeCheckout: (plan) => rememberPreview(plan, 'checkout'),
  });

  const requestFullSong = useCallback(async () => {
    const previewId = latest.current.jobId;
    const outcome = await latest.current.upgrade('click');
    if (outcome.kind === 'out_of_minutes') showPaywall(outcome.message, previewId);
  }, [showPaywall]);

  const getFullSongSignedOut = useCallback(() => {
    const previewId = latest.current.jobId;
    trackFunnel(FUNNEL.UNLOCK_CLICK, { surface, preview_id: previewId || undefined, instrument: latest.current.instrument });
    showPaywall(null, previewId, 'signed_out');
  }, [surface, showPaywall]);

  // Back from sign-in or Checkout with the preview restored: carry on.
  const resumedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !ready || !jobId || !jobId.startsWith('PRV')) return;
    if (resumedFor.current === jobId) return;
    const intent = fullSongIntentFor(surface);
    if (!intent || intent.previewId !== jobId) return;
    resumedFor.current = jobId;

    (async () => {
      // The upgrade needs the preview to belong to this account first.
      try {
        await claimPendingPreviewIfAny(config.apiBaseUrl, getToken);
      } catch {
        /* claimed already, or by the AppBoot runner; the upgrade will say if not */
      }
      const afterCheckout = intent.stage === 'checkout';
      // Checkout returns before its webhook has always added the minutes.
      const attempts = afterCheckout ? 5 : 1;
      let outcome: UpgradeOutcome = { kind: 'failed' };
      for (let i = 0; i < attempts; i += 1) {
        outcome = await latest.current.upgrade(afterCheckout ? 'after_checkout' : 'after_signin');
        if (outcome.kind !== 'out_of_minutes' || i === attempts - 1) break;
        await sleep(3000);
      }
      if (outcome.kind !== 'out_of_minutes') {
        clearFullSongIntent();
        return;
      }
      if (!afterCheckout && intent.plan) {
        // They picked a pack before signing in: go on to pay for it.
        trackFunnel(FUNNEL.BEGIN_CHECKOUT, { plan: intent.plan, source: 'after_signin', surface, preview_id: jobId });
        markFullSongCheckout(intent.plan);
        latest.current.persistPreview();
        try {
          await openCheckout(intent.plan, getToken);
          return;
        } catch (err) {
          const message = (err instanceof Error && err.message) || 'Could not start checkout.';
          trackFunnel(FUNNEL.CHECKOUT_ERROR, { plan: intent.plan, source: 'after_signin', message });
        }
      }
      // Keep the intent: buying from this paywall should still bring them back here.
      showPaywall(outcome.message, jobId);
    })();
  }, [isLoaded, isSignedIn, ready, jobId, surface, getToken, showPaywall]);

  return { requestFullSong, getFullSongSignedOut, showPaywall, paywall };
}
