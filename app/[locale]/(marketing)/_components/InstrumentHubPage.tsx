/**
 * The shared body of every instrument hub (/sheet-music/:instrument and
 * /stems/:instrument).
 *
 * These pages exist for one structural reason: the ~300 track pages had no
 * indexable parent. They were reachable from the Explore rails, which show the
 * newest 60, and from the sitemap, which is a list and not a recommendation.
 * A hub gives each instrument's tracks a crawlable page that says what they
 * are, and gives the track pages a breadcrumb to sit under.
 *
 * Everything on it is server-rendered from the live library, so the counts and
 * the track list cannot drift from the catalog the way hand-written copy does.
 *
 * The cards lead to the song page, not to /explore/:song/:part, even on a hub
 * already filtered to one instrument. `?notation=` counts MIDI as notation
 * while a part page requires a MusicXML score, so a rail here can hold tracks
 * that have no page for this part: those links would 404. The song page links
 * down to whichever parts do have one.
 */
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { Link } from '@/lib/navigation';
import { buildLocalePath, type Locale } from '@/lib/locales';
import { searchLibraryTracksServer } from '@/lib/api-server';
import { SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { INSTRUMENT_HUBS, hubPath, type InstrumentHub } from '@/lib/seo/instrumentHubs';
import JsonLd from '@/app/[locale]/explore/_components/JsonLd';
import Section from '@/app/[locale]/explore/_components/Section';
import { serverCard, type SongCardModel } from '@/app/[locale]/explore/_components/trackToCard';
import FaqAccordion from './FaqAccordion';
import './InstrumentHub.css';

const RAIL_LIMIT = 24;

interface HubData {
  popular: SongCardModel[];
  newest: SongCardModel[];
  total: number | null;
}

/**
 * Two rails' worth of tracks for this instrument. `notation` asks the API to
 * keep only tracks that carry notation for this part; an API without that
 * parameter ignores it and answers the instrument filter alone, which is a
 * superset rather than an error.
 *
 * Both rails walk the same sort, page 1 then page 2, rather than pairing
 * "popular" against "newest". Every track in the catalog currently has a
 * popularity of 0, so those two sorts resolve to the same rows and the second
 * rail deduplicated itself to nothing: one rail of 24 links where the page is
 * meant to be the crawlable parent of the whole instrument. Paging is stable
 * (every sort ends on id), so the two rails cannot overlap.
 */
async function loadHub(hub: InstrumentHub): Promise<HubData> {
  const base = {
    instruments: [hub.apiInstrument],
    ...(hub.kind === 'notation' ? { notation: hub.apiInstrument } : {}),
    sort: 'popular',
    limit: RAIL_LIMIT,
  };
  const [first, second] = await Promise.all([
    searchLibraryTracksServer({ ...base, page: 1 }).catch(() => null),
    searchLibraryTracksServer({ ...base, page: 2 }).catch(() => null),
  ]);
  const firstTracks = (first?.tracks || []).map(serverCard);
  const seen = new Set(firstTracks.map((t) => t.id));
  return {
    popular: firstTracks,
    newest: (second?.tracks || []).map(serverCard).filter((t) => !seen.has(t.id)),
    total: typeof first?.total === 'number' ? first.total : null,
  };
}

export default async function InstrumentHubPage({ hub, locale }: { hub: InstrumentHub; locale: Locale }) {
  const { popular, newest, total } = await loadHub(hub);
  const path = hubPath(hub);
  const url = `${SITE_URL}${buildLocalePath(locale, path)}`;
  const browseAll = `/explore/search?instrument=${hub.apiInstrument}`;

  // Only claim a number when the API gave one; otherwise open with the noun,
  // which keeps the sentence true and grammatical either way.
  const countLabel = total === null ? 'Tracks' : `${total.toLocaleString('en-US')} tracks`;
  const lede = hub.lede.replace('{count}', countLabel);
  const listed = [...popular, ...newest];
  const siblings = INSTRUMENT_HUBS.filter((h) => h.slug !== hub.slug);

  return (
    <div className="hub-page">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: hub.heading,
          description: hub.description,
          url,
          ...(listed.length
            ? {
                mainEntity: {
                  '@type': 'ItemList',
                  numberOfItems: listed.length,
                  itemListElement: listed.slice(0, 30).map((t, i) => ({
                    '@type': 'ListItem',
                    position: i + 1,
                    url: `${SITE_URL}${buildLocalePath(locale, `/explore/${encodeURIComponent(t.id)}`)}`,
                    name: t.artist ? `${t.title} by ${t.artist}` : t.title,
                  })),
                },
              }
            : {}),
        }}
      />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: SITE_NAME, path: '/' },
          { name: 'Explore', path: '/explore' },
          { name: hub.noun, path },
        ])}
      />
      <JsonLd data={faqJsonLd(hub.faq)} />

      <Header />

      <main className="hub-main">
        <nav className="hub-crumbs" aria-label="Breadcrumb">
          <Link href="/explore">Explore</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{hub.noun}</span>
        </nav>

        <header className="hub-hero">
          <p className="hub-eyebrow">{hub.kind === 'notation' ? 'Notation and stems' : 'Isolated stems'}</p>
          <h1 className="hub-title">{hub.heading}</h1>
          <p className="hub-lede">{lede}</p>
          <div className="hub-actions">
            <Link className="hub-cta" href={hub.toolPath}>
              {hub.kind === 'notation' ? `Transcribe your own ${hub.adjective} track` : `Separate your own song`}
            </Link>
            <Link className="hub-cta hub-cta-quiet" href={browseAll}>
              Browse every {hub.adjective} track
            </Link>
          </div>
        </header>

        {listed.length === 0 ? (
          <p className="hub-empty">
            The library is not answering right now. <Link href="/explore">Browse Explore</Link> instead, or refresh in a
            moment.
          </p>
        ) : (
          <>
            <Section
              eyebrow="Most played"
              title={`Popular ${hub.adjective} tracks`}
              subtitle={`Open a track to play it back, solo the ${hub.adjective} part and see what it carries.`}
              songs={popular}
              viewAllHref={browseAll}
            />
            {newest.length > 0 && (
              <Section
                eyebrow="Keep going"
                title={`More ${hub.adjective} tracks`}
                songs={newest}
                viewAllHref={`${browseAll}&page=2`}
              />
            )}
          </>
        )}

        <section className="hub-siblings" aria-labelledby="hub-siblings-heading">
          <h2 id="hub-siblings-heading">Other parts</h2>
          <ul>
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link href={hubPath(s)}>
                  <strong>{s.noun}</strong>
                  <span>{s.kind === 'notation' ? 'Sheet music, MIDI and stems' : 'Isolated stems'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <FaqAccordion
          title={`${hub.noun} questions`}
          sections={[
            {
              // Not the H1 again: the band already carries "<Instrument>
              // questions", so the section names what the answers cover.
              title: hub.kind === 'notation' ? 'Notation, playback and exports' : 'Separation and downloads',
              items: hub.faq.map((f, i) => ({ id: `${hub.slug}-${i}`, question: f.question, answer: f.answer })),
            },
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
