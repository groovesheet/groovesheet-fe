import { describe, expect, it } from 'vitest';
import {
  INSTRUMENT_HUBS,
  hubBySlug,
  hubLinkLabel,
  hubPath,
  hubPaths,
  hubsForTrack,
  hubsOfKind,
  primaryHubFor,
} from '@/lib/seo/instrumentHubs';
import { ROUTE_META } from '@/lib/seo/routeMeta';
import { indexableStaticPaths } from '@/lib/seo/sitemap';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { searchLibraryQuery } from '@/lib/libraryApi';

/**
 * The hubs are the only pages that assert what the product transcribes, so
 * these are claims tests as much as routing tests: a hub under /sheet-music
 * promises notation, and only drums, piano and bass have a transcriber behind
 * them. Moving vocals or guitar there needs a model, not an edit.
 */
describe('instrument hubs', () => {
  // The count on a notation hub comes from ?notation=<part>, so it counts
  // tracks transcribed for that instrument, not tracks that merely have its
  // stem. The sentence has to name the set it counts.
  it('describes notation, not stems, in the notation hub ledes', () => {
    for (const hub of hubsOfKind('notation')) {
      expect(hub.lede).toMatch(new RegExp(`carry ${hub.adjective} notation`));
      expect(hub.lede).not.toMatch(/isolated \w+ part/);
    }
    for (const hub of hubsOfKind('stems')) {
      expect(hub.lede).toMatch(new RegExp(`isolated ${hub.adjective} stem`));
    }
  });

  it('only puts transcribed instruments under /sheet-music', () => {
    expect(hubsOfKind('notation').map((h) => h.slug).sort()).toEqual(['bass', 'drums', 'piano']);
    for (const hub of hubsOfKind('notation')) expect(hubPath(hub)).toBe(`/sheet-music/${hub.slug}`);
  });

  it('puts stem-only parts under /stems and says so in the copy', () => {
    const stemHubs = hubsOfKind('stems');
    expect(stemHubs.map((h) => h.slug).sort()).toEqual(['guitar', 'vocals']);
    for (const hub of stemHubs) {
      expect(hubPath(hub)).toBe(`/stems/${hub.slug}`);
      // The lede must disclaim notation, since the URL and title do not.
      expect(hub.lede).toMatch(/not transcriptions|does not transcribe/i);
      expect(hub.title).not.toMatch(/sheet music/i);
    }
  });

  it('gives every hub a title within the SERP budget and a description', () => {
    for (const hub of INSTRUMENT_HUBS) {
      expect(hub.title.length).toBeLessThanOrEqual(46);
      expect(hub.description.length).toBeGreaterThan(60);
      expect(hub.description.length).toBeLessThanOrEqual(165);
      expect(hub.faq.length).toBeGreaterThanOrEqual(3);
      expect(hub.lede).toContain('{count}');
      // The count substitutes in as a noun phrase ("270 tracks"), so the
      // template repeating the noun renders "270 tracks tracks in the ...".
      expect(hub.lede).not.toMatch(/\{count\}\s+tracks/);
      // Reads correctly with a number and with the bare-noun fallback.
      for (const count of ['242 tracks', 'Tracks']) {
        expect(hub.lede.replace('{count}', count)).toMatch(
          /^(242 tracks|Tracks) in the GrooveSheet library (carry|have)/
        );
      }
    }
  });

  it('has a unique slug and path per hub', () => {
    expect(new Set(hubPaths()).size).toBe(INSTRUMENT_HUBS.length);
  });

  it('registers every hub in the route table, so it is titled and in the sitemap', () => {
    const indexable = indexableStaticPaths();
    for (const path of hubPaths()) {
      expect(ROUTE_META[path]).toBeTruthy();
      expect(indexable).toContain(path);
      expect(() => staticRouteMetadata(path, 'en')).not.toThrow();
    }
  });

  it('resolves a hub by kind and slug, and not across kinds', () => {
    expect(hubBySlug('notation', 'drums')?.noun).toBe('Drums');
    expect(hubBySlug('stems', 'drums')).toBeUndefined();
    expect(hubBySlug('notation', 'vocals')).toBeUndefined();
  });

  it('prefers a transcribed part when choosing a track’s parent hub', () => {
    expect(primaryHubFor(['Vocals', 'Drums'])?.slug).toBe('drums');
    expect(primaryHubFor(['Vocals', 'Guitar'])?.slug).toBe('vocals');
    expect(primaryHubFor(['Triangle'])).toBeUndefined();
  });
});

describe('hubsForTrack', () => {
  // The catalog separates bass out of nearly every track while transcribing
  // only drums and piano, so matching a /sheet-music hub on stems alone put
  // "Bass sheet music" on tracks that have no bass notation.
  it('offers a sheet-music hub only for parts that were transcribed', () => {
    const hubs = hubsForTrack({
      notated: ['piano', 'drums'],
      stems: ['piano', 'drums', 'bass', 'vocals', 'guitar', 'other'],
    });
    expect(hubs.map(hubPath)).toEqual([
      '/sheet-music/drums',
      '/sheet-music/piano',
      '/stems/vocals',
      '/stems/guitar',
    ]);
    expect(hubs.map(hubPath)).not.toContain('/sheet-music/bass');
  });

  it('offers a stems hub whenever the part was separated', () => {
    expect(hubsForTrack({ notated: [], stems: ['Vocals'] }).map(hubPath)).toEqual(['/stems/vocals']);
  });

  it('offers nothing for a track with no assets', () => {
    expect(hubsForTrack({ notated: [], stems: [] })).toEqual([]);
  });

  it('labels a hub with the instrument adjective, not the plural noun', () => {
    expect(hubLinkLabel(hubBySlug('notation', 'drums')!)).toBe('Drum sheet music, MIDI and stems');
    expect(hubLinkLabel(hubBySlug('stems', 'vocals')!)).toBe('Isolated vocal stems');
  });
});

describe('library query', () => {
  it('sends the notation filter separately from the instrument filter', () => {
    const qs = searchLibraryQuery({ instruments: ['drums'], notation: 'drums', sort: 'popular', limit: 24 });
    const params = new URLSearchParams(qs);
    expect(params.get('instrument')).toBe('drums');
    expect(params.get('notation')).toBe('drums');
    expect(params.get('sort')).toBe('popular');
  });

  it('omits the notation filter when it is not asked for', () => {
    expect(new URLSearchParams(searchLibraryQuery({ instruments: ['vocals'] })).has('notation')).toBe(false);
  });
});
