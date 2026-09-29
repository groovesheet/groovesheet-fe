/**
 * The first-party copy of funnel events (POST /api/funnel/events).
 *
 * GA4 and PostHog lose visitors to ad blockers and cannot be joined to the
 * backend's preview and payment rows, so funnel steps are also posted to our
 * own API. These pin what goes there: only funnel events, with a session id
 * that survives sign-up, the signed-in user once known, and a beacon on exit.
 */
import { FUNNEL, flushFunnel, setFunnelUser, track, trackFunnel, _resetFunnel } from '@/lib/analytics';

type Sent = { session_id: string; user_id?: string; events: { event: string; preview_id?: string; props: Record<string, unknown> }[] };

let fetchMock: ReturnType<typeof vi.fn>;

const sentBodies = (): Sent[] =>
  fetchMock.mock.calls
    .filter(([url]) => url === '/api/funnel/events')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Sent);

beforeEach(() => {
  _resetFunnel();
  window.dataLayer = [];
  window.localStorage.clear();
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('first-party funnel sink', () => {
  it('posts funnel events with a stable session id', () => {
    trackFunnel(FUNNEL.PREVIEW_READY, { preview_id: 'PRV123', surface: 'transcribe' });
    trackFunnel(FUNNEL.PREVIEW_PLAYED, { preview_id: 'PRV123' });
    flushFunnel();

    const [batch] = sentBodies();
    expect(batch.session_id).toMatch(/^s_[a-z0-9]+$/);
    expect(batch.events.map((e) => e.event)).toEqual(['preview_ready', 'preview_played']);
    expect(batch.events[0].preview_id).toBe('PRV123');
    expect(batch.events[0].props.surface).toBe('transcribe');
    // The same id comes back next time: it lives in localStorage.
    expect(window.localStorage.getItem('gs_funnel_sid')).toBe(batch.session_id);
  });

  it('keeps non-funnel events off our API', () => {
    track('explore_track_view', { gs_track_id: 't1' });
    flushFunnel();
    expect(sentBodies()).toEqual([]);
  });

  it('sends sign_up and purchase too, since they bracket the funnel', () => {
    track('sign_up', { method: 'google' });
    track('purchase', { value: 12, currency: 'USD' });
    flushFunnel();
    expect(sentBodies()[0].events.map((e) => e.event)).toEqual(['sign_up', 'purchase']);
  });

  it('attaches the signed-in user and drops it on sign-out', () => {
    setFunnelUser('user-1');
    trackFunnel(FUNNEL.FULL_SONG_CLICK, {});
    flushFunnel();
    setFunnelUser(null);
    trackFunnel(FUNNEL.UPLOAD_STARTED, {});
    flushFunnel();
    const [first, second] = sentBodies();
    expect(first.user_id).toBe('user-1');
    expect(second.user_id).toBeUndefined();
  });

  it('uses sendBeacon on page exit', () => {
    const beacon = vi.fn((_url: string, _body?: BodyInit) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    trackFunnel(FUNNEL.PREVIEW_EXIT, { dwell_sec: 4.2, played: false });
    flushFunnel(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('/api/funnel/events');
    expect(sentBodies()).toEqual([]);
  });

  it('sends at once by beacon when tracked while the page is hidden', () => {
    const beacon = vi.fn((_url: string, _body?: BodyInit) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    try {
      trackFunnel(FUNNEL.PREVIEW_EXIT, { reason: 'page_leave' });
      expect(beacon).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    }
  });

  it('never throws when fetch is missing', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() => {
      trackFunnel(FUNNEL.PAYWALL_SHOWN, {});
      flushFunnel();
    }).not.toThrow();
  });
});
