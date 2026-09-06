import {
  track,
  trackExploreView,
  trackDownloadIntent,
  trackSignUp,
  trackPurchase,
  adsConversion,
  adsPurchaseEvent,
  ADS_LABELS,
  EVENTS,
} from './analytics';
import {
  captureAttribution,
  captureClickId,
  getClickIds,
  parseCampaign,
  sourcePlatform,
  getFirstTouch,
  getLastTouch,
  attributionProps,
  _resetAttribution,
} from './attribution';

const SOCIAL_QUERY =
  '?utm_source=youtube&utm_medium=social&utm_campaign=stem_video' +
  '&utm_content=0f9c1e2a-3b4c-4d5e-8f60-112233445566:drums&gs_v=dQw4w9WgXcQ';

beforeEach(() => {
  window.dataLayer = [];
  _resetAttribution();
  try {
    window.localStorage.clear();
  } catch (e) {
    /* ignore */
  }
});

describe('attribution capture', () => {
  it('parses the full social campaign contract', () => {
    const c = parseCampaign(SOCIAL_QUERY);
    expect(c.gs_source_platform).toBe('youtube');
    expect(c.gs_campaign).toBe('stem_video');
    expect(c.gs_content).toBe('0f9c1e2a-3b4c-4d5e-8f60-112233445566:drums');
    expect(c.gs_video_id).toBe('dQw4w9WgXcQ');
    expect(c.utm_medium).toBe('social');
  });

  it('returns null for a landing with no campaign parameters', () => {
    expect(parseCampaign('?foo=bar')).toBeNull();
    expect(parseCampaign('')).toBeNull();
  });

  it('classifies source platforms', () => {
    expect(sourcePlatform('youtube')).toBe('youtube');
    expect(sourcePlatform('bilibili')).toBe('bilibili');
    expect(sourcePlatform('newsletter')).toBe('other');
    expect(sourcePlatform('', 'https://google.com')).toBe('organic');
    expect(sourcePlatform('', '')).toBe('direct');
  });

  it('writes both first touch and last touch on the first campaign landing', () => {
    captureAttribution(SOCIAL_QUERY);
    expect(getFirstTouch().gs_source_platform).toBe('youtube');
    expect(getLastTouch().gs_source_platform).toBe('youtube');
  });

  it('never overwrites first touch on a later campaign landing', () => {
    captureAttribution(SOCIAL_QUERY);
    captureAttribution('?utm_source=bilibili&utm_medium=social&utm_campaign=piano_transcription');

    expect(getFirstTouch().gs_source_platform).toBe('youtube');
    expect(getFirstTouch().gs_campaign).toBe('stem_video');
    // Last touch does move.
    expect(getLastTouch().gs_source_platform).toBe('bilibili');
    expect(getLastTouch().gs_campaign).toBe('piano_transcription');
  });

  it('an organic return visit erases neither record', () => {
    captureAttribution(SOCIAL_QUERY);
    captureAttribution('');

    expect(getFirstTouch().gs_source_platform).toBe('youtube');
    expect(getLastTouch().gs_source_platform).toBe('youtube');
  });

  it('never throws when localStorage is unavailable', () => {
    const original = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => captureAttribution(SOCIAL_QUERY)).not.toThrow();
    window.localStorage.setItem = original;
  });

  it('reports direct when nothing was ever captured', () => {
    expect(attributionProps().gs_source_platform).toBe('direct');
  });

  it('marks properties as first_touch once captured', () => {
    captureAttribution(SOCIAL_QUERY);
    expect(attributionProps().gs_attribution_age).toBe('first_touch');
  });
});

describe('never-throw analytics wrapper', () => {
  it('pushes an event onto the dataLayer', () => {
    expect(track('test_event', { a: 1 })).toBe(true);
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer[0].event).toBe('test_event');
    expect(window.dataLayer[0].a).toBe(1);
  });

  it('creates the dataLayer when GTM has not loaded', () => {
    delete window.dataLayer;
    expect(track('test_event')).toBe(true);
    expect(Array.isArray(window.dataLayer)).toBe(true);
  });

  it('never throws when dataLayer is not an array', () => {
    window.dataLayer = { push: null };
    expect(() => track('test_event')).not.toThrow();
  });

  it('never throws on malformed properties', () => {
    const circular = {};
    circular.self = circular;
    expect(() => track('test_event', circular)).not.toThrow();
    expect(() => track('test_event', null)).not.toThrow();
    expect(() => track(null)).not.toThrow();
    expect(track(null)).toBe(false);
  });

  it('drops non-primitive properties rather than sending objects', () => {
    track('test_event', { good: 'yes', bad: { nested: true }, arr: [1, 2] });
    expect(window.dataLayer[0].good).toBe('yes');
    expect(window.dataLayer[0].bad).toBeUndefined();
    expect(window.dataLayer[0].arr).toBeUndefined();
  });

  it('strips forbidden keys so no raw identifier reaches GA4', () => {
    track('test_event', {
      ip: '203.0.113.9',
      gs_anon: 'cookie-value',
      access_token: 'secret',
      gs_track_id: 'keep-me',
    });
    const pushed = window.dataLayer[0];
    expect(pushed.ip).toBeUndefined();
    expect(pushed.gs_anon).toBeUndefined();
    expect(pushed.access_token).toBeUndefined();
    expect(pushed.gs_track_id).toBe('keep-me');
  });

  it('attaches campaign properties to every event', () => {
    captureAttribution(SOCIAL_QUERY);
    track('test_event');
    const pushed = window.dataLayer[0];
    expect(pushed.gs_source_platform).toBe('youtube');
    expect(pushed.gs_campaign).toBe('stem_video');
    expect(pushed.gs_video_id).toBe('dQw4w9WgXcQ');
  });

  it('campaign properties survive a later client-side navigation', () => {
    captureAttribution(SOCIAL_QUERY);
    // Simulates navigating to a second page where the query string is gone.
    track(EVENTS.TRACK_PLAY, { gs_track_id: 'second-page' });
    expect(window.dataLayer[0].gs_campaign).toBe('stem_video');
  });
});

describe('funnel helpers', () => {
  it('explore_track_view carries the track identity', () => {
    trackExploreView({ id: 'uuid-1', slug: 'a-slug' }, { resolved_by: 'slug' });
    const pushed = window.dataLayer[0];
    expect(pushed.event).toBe('explore_track_view');
    expect(pushed.gs_track_id).toBe('uuid-1');
    expect(pushed.gs_track_slug).toBe('a-slug');
    expect(pushed.resolved_by).toBe('slug');
  });

  it('download intent reports whether the visitor was authenticated', () => {
    trackDownloadIntent({ id: 'uuid-1' }, { authenticated: false });
    expect(window.dataLayer[0].event).toBe('track_download_intent');
    expect(window.dataLayer[0].authenticated).toBe(false);
  });

  it('uses the GA4 recommended name for sign_up', () => {
    trackSignUp('google');
    expect(window.dataLayer[0].event).toBe('sign_up');
    expect(window.dataLayer[0].method).toBe('google');
  });

  it('sends the Google Ads conversion alongside the sign_up event', () => {
    window.gtag = jest.fn();
    trackSignUp('email');
    expect(window.gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: `AW-18426875153/${ADS_LABELS.SIGN_UP}`,
      value: 1.0,
      currency: 'SGD',
    });
    delete window.gtag;
  });

  it('still records sign_up when gtag is blocked', () => {
    delete window.gtag;
    expect(() => trackSignUp('email')).not.toThrow();
    expect(window.dataLayer[0].event).toBe('sign_up');
  });

  it('adsConversion no-ops without gtag and refuses an empty label', () => {
    delete window.gtag;
    expect(adsConversion(ADS_LABELS.SIGN_UP)).toBe(false);
    window.gtag = jest.fn();
    expect(adsConversion('')).toBe(false);
    expect(window.gtag).not.toHaveBeenCalled();
    delete window.gtag;
  });

  it('uses the GA4 recommended name for purchase', () => {
    trackPurchase({ value: 10, currency: 'USD', transaction_id: 'cs_123', tier: 'lite_monthly' });
    const pushed = window.dataLayer[0];
    expect(pushed.event).toBe('purchase');
    expect(pushed.value).toBe(10);
    expect(pushed.currency).toBe('USD');
    expect(pushed.transaction_id).toBe('cs_123');
  });

  it('tolerates a missing track object', () => {
    expect(() => trackExploreView(null)).not.toThrow();
    expect(window.dataLayer[0].event).toBe('explore_track_view');
  });
});

/**
 * The ad click is the join between money and spend.
 *
 * Google Ads reported zero conversions for weeks while the database held no
 * record of a payment amount and no record of which click produced it. Even
 * once a sale happens, a conversion with no value teaches the bidder nothing
 * and makes return on ad spend uncomputable. These pin down the two halves:
 * the click survives from landing to checkout, and the amount reaches Google.
 */
describe('google ads click capture', () => {
  it('stores a gclid from the landing query string', () => {
    captureClickId('?gclid=Cj0KCQiA_abc123');
    expect(getClickIds()).toEqual({ gclid: 'Cj0KCQiA_abc123' });
  });

  it('accepts the iOS and app-campaign variants Google sends instead', () => {
    captureClickId('?gbraid=0AAAAA_braid');
    expect(getClickIds()).toEqual({ gbraid: '0AAAAA_braid' });
    _resetAttribution();
    captureClickId('?wbraid=0AAAAA_wbraid');
    expect(getClickIds()).toEqual({ wbraid: '0AAAAA_wbraid' });
  });

  it('keeps the click through later organic page views', () => {
    // The click id is gone from the URL the moment they navigate, but payment
    // happens many pages later — losing it here loses the attribution.
    captureClickId('?gclid=survives');
    captureClickId('');
    captureClickId('?utm_source=youtube');
    expect(getClickIds()).toEqual({ gclid: 'survives' });
  });

  it('takes the most recent click, unlike first-touch campaign attribution', () => {
    // Google bills and credits on the last click, so this deliberately
    // diverges from the first-touch rule used for campaign source.
    captureClickId('?gclid=older');
    captureClickId('?gclid=newer');
    expect(getClickIds()).toEqual({ gclid: 'newer' });
  });

  it('forgets a click older than Google would credit', () => {
    const stale = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(
      'gs_click_id',
      JSON.stringify({ gclid: 'expired', seen_at: stale })
    );
    // Past 90 days Google no longer credits the click either; keeping it would
    // only overstate our own attribution.
    expect(getClickIds()).toEqual({});
  });

  it('drops a value too long for Stripe metadata rather than breaking checkout', () => {
    captureClickId(`?gclid=${'x'.repeat(501)}`);
    expect(getClickIds()).toEqual({});
  });

  it('returns a spreadable object when there was never a click', () => {
    expect(getClickIds()).toEqual({});
    expect({ plan: 'tier2', ...getClickIds() }).toEqual({ plan: 'tier2' });
  });

  it('never throws on a malformed query string', () => {
    expect(() => captureClickId(undefined)).not.toThrow();
    expect(() => captureClickId('?%%%')).not.toThrow();
  });
});

describe('purchase reporting', () => {
  it('carries the real amount and a dedup id to Google Ads', () => {
    window.gtag = jest.fn();
    adsConversion('PURCHASE_LABEL', {
      value: 12,
      currency: 'USD',
      transaction_id: 'cs_test_123',
    });
    expect(window.gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: 'AW-18426875153/PURCHASE_LABEL',
      value: 12,
      currency: 'USD',
      // Without this a page refresh or a Stripe retry would book the sale twice.
      transaction_id: 'cs_test_123',
    });
    delete window.gtag;
  });

  it('reports the purchase to GA4 with its value', () => {
    trackPurchase({ value: 12, currency: 'USD', transaction_id: 'cs_1', tier: 'tier2' });
    expect(window.dataLayer[0].event).toBe('purchase');
    expect(window.dataLayer[0].value).toBe(12);
    expect(window.dataLayer[0].currency).toBe('USD');
    expect(window.dataLayer[0].transaction_id).toBe('cs_1');
  });

  it('reaches Google Ads by event name when no label is configured', () => {
    // The label lives only in the Ads UI. This is the second, label-free route,
    // and the one the account's Ads-created Purchase action is most likely
    // listening on — no label for it exists in the code or the GTM container.
    window.gtag = jest.fn();
    adsPurchaseEvent({ value: 12, currency: 'USD', transaction_id: 'cs_test_9' });
    expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', {
      send_to: 'AW-18426875153',
      value: 12,
      currency: 'USD',
      transaction_id: 'cs_test_9',
    });
    delete window.gtag;
  });

  it('sends both routes with one shared dedup id, so a sale counts once', () => {
    // Both may land. Google deduplicates on transaction_id, which is the whole
    // reason sending both is safe rather than a double-count.
    window.gtag = jest.fn();
    trackPurchase({ value: 12, currency: 'USD', transaction_id: 'cs_same' });
    const ids = window.gtag.mock.calls.map((c) => c[2].transaction_id);
    expect(ids.every((id) => id === 'cs_same')).toBe(true);
    delete window.gtag;
  });

  it('omits value and currency rather than inventing them', () => {
    // A purchase reported as 1.0 SGD by default would be a fabricated amount
    // sitting in the revenue column of the Ads report.
    window.gtag = jest.fn();
    adsPurchaseEvent({ transaction_id: 'cs_novalue' });
    expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', {
      send_to: 'AW-18426875153',
      value: undefined,
      currency: undefined,
      transaction_id: 'cs_novalue',
    });
    delete window.gtag;
  });

  it('never throws when gtag is blocked', () => {
    delete window.gtag;
    expect(() => adsPurchaseEvent({ value: 1, transaction_id: 'x' })).not.toThrow();
  });

  it('still records the sale when the Ads label is unconfigured', () => {
    // ADS_LABELS.PURCHASE comes from the environment and is empty here. A
    // missing label must cost the Google conversion, never the GA4 record.
    window.gtag = jest.fn();
    expect(ADS_LABELS.PURCHASE).toBe('');
    expect(() => trackPurchase({ value: 12, transaction_id: 'cs_2' })).not.toThrow();
    expect(window.dataLayer[0].event).toBe('purchase');
    // The labelled conversion no-ops, but the label-free event still goes, so
    // an unset label no longer means Ads hears nothing at all.
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
      send_to: 'AW-18426875153',
    }));
    delete window.gtag;
  });

  it('still records the sale when gtag is blocked entirely', () => {
    delete window.gtag;
    expect(() => trackPurchase({ value: 12, transaction_id: 'cs_3' })).not.toThrow();
    expect(window.dataLayer[0].event).toBe('purchase');
  });
});
