import { act } from 'react';

// React only runs act() without warnings when told it is in a test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import Pricing from '@/app/[locale]/(marketing)/_components/Pricing';
import { saveCheckoutIntent, takeCheckoutIntent } from '@/lib/checkoutIntent';

// A pricing card clicked while signed out has to survive the sign-in reload
// and open Checkout afterwards. The signed-in half needs a real Google or
// email sign-in, which a local browser check cannot reach. These pin it.

const auth = { isSignedIn: false, isLoaded: true };
const openLoginModal = vi.fn();
const createCheckoutSession = vi.fn();
const startProviderCheckout = vi.fn();

vi.mock('@/lib/auth', () => ({
  useUser: () => auth,
  useAuth: () => ({ getToken: async () => 'token' }),
}));
vi.mock('@/components/chrome/LoginModalProvider', () => ({ useLoginModal: () => ({ openLoginModal }) }));
vi.mock('@/lib/api', () => ({ createCheckoutSession: (...args: unknown[]) => createCheckoutSession(...args) }));
vi.mock('@/lib/airwallex', () => ({ startProviderCheckout: (...args: unknown[]) => startProviderCheckout(...args) }));
vi.mock('@/lib/analytics', () => ({ FUNNEL: new Proxy({}, { get: (_t, k) => String(k) }), trackFunnel: vi.fn() }));
vi.mock('@/lib/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/useBillingCatalog', () => ({
  default: () => ({ catalog: null, loading: false, currency: 'usd', wallets: [] }),
  formatMoney: (v: unknown) => String(v ?? ''),
  walletNames: () => '',
}));

let root: Root;
let container: HTMLDivElement;

async function render() {
  await act(async () => {
    root.render(<Pricing />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.isSignedIn = false;
  createCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });
  startProviderCheckout.mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('pricing checkout across sign-in', () => {
  it('remembers the plan picked while signed out and opens sign-in', async () => {
    await render();
    // The primary plan card is Pro; the page opens on annual billing.
    const pro = container.querySelector<HTMLButtonElement>('.pricing-btn.primary');
    expect(pro).not.toBeNull();
    await act(async () => {
      pro!.click();
    });
    expect(openLoginModal).toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    const intent = takeCheckoutIntent();
    expect(intent?.plan).toBe('tier2_annual');
    expect(intent?.currency).toBe('usd');
  });

  it('opens Checkout for that plan once signed in, exactly once', async () => {
    saveCheckoutIntent('tier2_annual', 'usd');
    auth.isSignedIn = true;
    await render();
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith('/api', 'tier2_annual', expect.any(Function), null, 'usd', expect.anything());
    expect(startProviderCheckout).toHaveBeenCalledTimes(1);
    expect(takeCheckoutIntent()).toBeNull();
    // A re-render (or a second pricing section) must not open it again.
    await render();
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a signed-in visitor with no saved pick', async () => {
    auth.isSignedIn = true;
    await render();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('drops a pick older than 15 minutes', async () => {
    localStorage.setItem('gs_checkout_intent', JSON.stringify({ plan: 'topup-60', savedAt: Date.now() - 16 * 60 * 1000 }));
    auth.isSignedIn = true;
    await render();
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(localStorage.getItem('gs_checkout_intent')).toBeNull();
  });
});
