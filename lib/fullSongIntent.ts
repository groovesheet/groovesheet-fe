/**
 * "Get the full song" pressed on a preview, remembered across the two page
 * loads that can happen before the full song can run: the Google sign-in round
 * trip and the Checkout redirect.
 *
 * Before this, both reloads dropped the visitor on an empty upload box. On
 * 2026-10-01 the one visitor who clicked "Get the full song" signed up, lost the
 * preview, uploaded the file again and gave up. The upload card that owns the
 * preview reads this back, restores the preview and carries on: full song if
 * the account has minutes, otherwise the paywall (or the Checkout the visitor
 * already picked a pack for).
 */

export type FullSongStage = 'signin' | 'checkout';

export interface FullSongIntent {
  /** Upload card the preview belongs to ('transcribe', 'stem_splitter', 'midi_converter'). */
  surface: string;
  previewId: string;
  /** Path to send the visitor back to, locale prefix included. */
  path: string;
  instrument?: string;
  fileName?: string;
  /** Pack or plan picked before signing in, so Checkout can open without asking again. */
  plan?: string;
  stage: FullSongStage;
  savedAt: number;
}

const KEY = 'gs_full_song_intent';
// Long enough for a sign-up and a card payment, short enough that a stale
// preview never pops up on a later visit.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function saveFullSongIntent(intent: Omit<FullSongIntent, 'savedAt' | 'stage'> & { stage?: FullSongStage }): void {
  try {
    const value: FullSongIntent = { stage: 'signin', ...intent, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage disabled: the visitor just has to click again after signing in */
  }
}

export function loadFullSongIntent(): FullSongIntent | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FullSongIntent> | null;
    if (!parsed || !parsed.previewId || !parsed.surface || !parsed.path) return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      clearFullSongIntent();
      return null;
    }
    return parsed as FullSongIntent;
  } catch {
    return null;
  }
}

/** The intent, only when it belongs to this upload card. */
export function fullSongIntentFor(surface: string): FullSongIntent | null {
  const intent = loadFullSongIntent();
  return intent && intent.surface === surface ? intent : null;
}

export function markFullSongCheckout(plan: string): void {
  const intent = loadFullSongIntent();
  if (!intent) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...intent, plan, stage: 'checkout' }));
  } catch {
    /* storage disabled */
  }
}

export function clearFullSongIntent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage disabled */
  }
}

/** The current path with its query, which is what the visitor should come back to. */
export function currentPathForIntent(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}
