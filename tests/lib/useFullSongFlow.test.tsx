import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { saveFullSongIntent, loadFullSongIntent } from '@/lib/fullSongIntent';
import { useFullSongFlow, type UpgradeOutcome } from '@/lib/hooks/useFullSongFlow';

// The signed-in half of "Get the full song" runs after a real Google sign-in
// or Checkout redirect, which a local browser check cannot reach. These pin it.

const auth = { isSignedIn: true, isLoaded: true };
const showPaywall = vi.fn();
const openCheckout = vi.fn();
const openLoginModal = vi.fn();
const claim = vi.fn();

vi.mock('@/lib/auth', () => ({
  useUser: () => auth,
  useAuth: () => ({ getToken: async () => 'token' }),
}));
vi.mock('@/components/chrome/LoginModalProvider', () => ({ useLoginModal: () => ({ openLoginModal }) }));
vi.mock('@/lib/previewApi', () => ({ claimPendingPreviewIfAny: (...args: unknown[]) => claim(...args) }));
vi.mock('@/lib/analytics', () => ({ FUNNEL: new Proxy({}, { get: (_t, k) => String(k) }), trackFunnel: vi.fn() }));
vi.mock('@/components/billing/OutOfMinutesModal', () => ({
  usePaywall: () => ({ showPaywall, paywall: null }),
  openCheckout: (...args: unknown[]) => openCheckout(...args),
}));

type Upgrade = (trigger: string) => Promise<UpgradeOutcome>;

let root: Root;
let container: HTMLDivElement;
type Flow = ReturnType<typeof useFullSongFlow>;
const handle: { flow: Flow | null } = { flow: null };

function Harness({ upgrade, ready = true, jobId = 'PRVabc' }: { upgrade: Upgrade; ready?: boolean; jobId?: string }) {
  const flow = useFullSongFlow({
    surface: 'transcribe',
    jobId,
    ready,
    instrument: 'piano',
    fileName: 'song.mp3',
    persistPreview: () => {},
    upgrade,
  });
  useEffect(() => {
    handle.flow = flow;
  });
  return null;
}

async function render(el: React.ReactElement) {
  await act(async () => {
    root.render(el);
  });
  // let the async resume chain settle
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.isSignedIn = true;
  claim.mockResolvedValue(null);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useFullSongFlow', () => {
  it('does nothing on its own without a saved intent', async () => {
    const upgrade = vi.fn<Upgrade>();
    await render(<Harness upgrade={upgrade} />);
    expect(upgrade).not.toHaveBeenCalled();
  });

  it('starts the full song after sign-in and clears the intent', async () => {
    saveFullSongIntent({ surface: 'transcribe', previewId: 'PRVabc', path: '/' });
    const upgrade = vi.fn<Upgrade>().mockResolvedValue({ kind: 'started' });
    await render(<Harness upgrade={upgrade} />);
    expect(claim).toHaveBeenCalled();
    expect(upgrade).toHaveBeenCalledWith('after_signin');
    expect(loadFullSongIntent()).toBeNull();
    expect(showPaywall).not.toHaveBeenCalled();
  });

  it('goes straight to Checkout for the pack picked before signing in', async () => {
    saveFullSongIntent({ surface: 'transcribe', previewId: 'PRVabc', path: '/', plan: 'topup-30' });
    openCheckout.mockResolvedValue(undefined);
    const upgrade = vi.fn<Upgrade>().mockResolvedValue({ kind: 'out_of_minutes', message: 'Need 3 minutes' });
    await render(<Harness upgrade={upgrade} />);
    expect(openCheckout).toHaveBeenCalledWith('topup-30', expect.any(Function));
    expect(loadFullSongIntent()?.stage).toBe('checkout');
    expect(showPaywall).not.toHaveBeenCalled();
  });

  it('opens the paywall after sign-in when no pack was picked, keeping the intent', async () => {
    saveFullSongIntent({ surface: 'transcribe', previewId: 'PRVabc', path: '/' });
    const upgrade = vi.fn<Upgrade>().mockResolvedValue({ kind: 'out_of_minutes', message: 'Need 3 minutes' });
    await render(<Harness upgrade={upgrade} />);
    expect(showPaywall).toHaveBeenCalledWith('Need 3 minutes', 'PRVabc');
    expect(loadFullSongIntent()).not.toBeNull();
  });

  it('ignores an intent for another upload card or another preview', async () => {
    saveFullSongIntent({ surface: 'stem_splitter', previewId: 'PRVabc', path: '/stem-splitter' });
    const upgrade = vi.fn<Upgrade>();
    await render(<Harness upgrade={upgrade} />);
    saveFullSongIntent({ surface: 'transcribe', previewId: 'PRVother', path: '/' });
    await render(<Harness upgrade={upgrade} />);
    expect(upgrade).not.toHaveBeenCalled();
  });

  it('waits for the preview to be back on screen and for sign-in', async () => {
    saveFullSongIntent({ surface: 'transcribe', previewId: 'PRVabc', path: '/' });
    const upgrade = vi.fn<Upgrade>().mockResolvedValue({ kind: 'started' });
    auth.isSignedIn = false;
    await render(<Harness upgrade={upgrade} />);
    auth.isSignedIn = true;
    await render(<Harness upgrade={upgrade} ready={false} />);
    expect(upgrade).not.toHaveBeenCalled();
    await render(<Harness upgrade={upgrade} ready />);
    expect(upgrade).toHaveBeenCalledTimes(1);
  });

  it('signed out: shows prices first instead of a bare sign-up', async () => {
    auth.isSignedIn = false;
    await render(<Harness upgrade={vi.fn<Upgrade>()} />);
    act(() => handle.flow!.getFullSongSignedOut());
    expect(showPaywall).toHaveBeenCalledWith(null, 'PRVabc', 'signed_out');
    expect(openLoginModal).not.toHaveBeenCalled();
  });

  it('signed in: the button opens the paywall only when out of minutes', async () => {
    const upgrade = vi.fn<Upgrade>().mockResolvedValue({ kind: 'out_of_minutes', message: null });
    await render(<Harness upgrade={upgrade} />);
    await act(async () => {
      await handle.flow!.requestFullSong();
    });
    expect(upgrade).toHaveBeenCalledWith('click');
    expect(showPaywall).toHaveBeenCalledWith(null, 'PRVabc');
  });
});
