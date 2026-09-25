/**
 * A single comparison page, /compare/:competitor.
 *
 * The competitor's column is static, sourced and dated in
 * lib/seo/competitors.ts. GrooveSheet's column is not: it is read from the
 * live billing catalog and lib/constants at render time, so a price change
 * reaches this page the way it reaches the pricing page, instead of waiting
 * for someone to remember a comparison table exists.
 *
 * The "what they do better" section is deliberately above the fold of the
 * table and never empty. A comparison page that only flatters the host is one
 * readers discount, and one a competitor can fairly complain about.
 */
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { Link } from '@/lib/navigation';
import { buildLocalePath, type Locale } from '@/lib/locales';
import { getBillingPlans } from '@/lib/api-server';
import { MAX_UPLOAD_MB } from '@/lib/constants';
import { SITE_NAME, SITE_URL } from '@/lib/seo/metadata';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/jsonld';
import { COMPETITORS, comparePath, type Competitor } from '@/lib/seo/competitors';
import JsonLd from '@/app/[locale]/explore/_components/JsonLd';
import FaqAccordion from '../../_components/FaqAccordion';
import './Compare.css';

const NOT_LISTED = 'Not listed';

/** The cheapest paid plan in the catalog, as a sentence. Null if unavailable. */
function entryPlanLabel(plans: { price_monthly_usd?: number; price_monthly?: number; minutes_per_month?: number }[]): string | null {
  const paid = plans
    .map((p) => ({ price: p.price_monthly_usd ?? p.price_monthly, minutes: p.minutes_per_month }))
    .filter((p): p is { price: number; minutes: number | undefined } => typeof p.price === 'number' && p.price > 0)
    .sort((a, b) => a.price - b.price);
  const cheapest = paid[0];
  if (!cheapest) return null;
  const minutes = cheapest.minutes ? `, ${cheapest.minutes} minutes a month` : '';
  return `From $${cheapest.price.toFixed(2)}/month${minutes}`;
}

/**
 * GrooveSheet's side of each row, keyed by the row label the competitor entry
 * uses. Anything without an entry renders an em-free dash placeholder, which
 * is the honest answer for a row that only describes the other product.
 */
function oursByLabel(entry: string | null): Record<string, string> {
  return {
    'Free tier': '10-second preview of any song, no account needed to browse the library',
    'Published price': entry || 'See the pricing page',
    'Entry paid plan': entry || 'See the pricing page',
    'Next plan up': 'See the pricing page',
    'How you pay': 'By the minute of audio, monthly plans or one-off top-ups',
    Price: entry || 'See the pricing page',
    'Free trial': '10-second preview of any song',
    'Longest single transcription': `No length cap; files up to ${MAX_UPLOAD_MB} MB`,
    'Instruments transcribed': 'Drums, piano and bass',
    'Notation exports': 'PDF, MusicXML and MIDI',
    'Guitar tab': 'No',
    'Isolated stems': 'Yes: vocals, drums, bass, piano, guitar and the rest of the mix',
    'Input from a YouTube link': 'No, upload a file',
    'Scans printed sheet music': 'No',
    Platforms: 'Browser, including on a phone',
    'Runs on': 'Browser, including on a phone',
    'Works offline': 'No',
    'Manual note editing': 'No, export MusicXML or MIDI and edit there',
    Tablature: 'No, standard notation with a fretboard view',
    'Opt out of model training': NOT_LISTED,
    'API access': 'Yes, see the developers page',
    'Browsable library of transcriptions': 'Yes, free to browse and download',
  };
}

export default async function ComparePage({ competitor, locale }: { competitor: Competitor; locale: Locale }) {
  let entry: string | null = null;
  try {
    const catalog = await getBillingPlans();
    entry = catalog?.plans ? entryPlanLabel(catalog.plans) : null;
  } catch (err) {
    // A comparison page must not depend on the billing API being up; the
    // rows fall back to pointing at the pricing page.
    console.error('Compare page: catalog fetch failed', err);
  }

  const ours = oursByLabel(entry);
  const path = comparePath(competitor);
  const url = `${SITE_URL}${buildLocalePath(locale, path)}`;
  const checked = new Date(`${competitor.checked}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const others = COMPETITORS.filter((c) => c.slug !== competitor.slug);
  // The upload limit comes from the constant the uploader enforces, never
  // from a number typed into the copy.
  const faq = competitor.faq.map((f) => ({
    ...f,
    answer: f.answer.replace('{maxUploadMb}', String(MAX_UPLOAD_MB)),
  }));

  return (
    <div className="cmp-page">
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: SITE_NAME, path: '/' },
          { name: 'Compare', path: '/compare' },
          { name: competitor.name, path },
        ])}
      />
      <JsonLd data={faqJsonLd(faq)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: competitor.heading,
          description: competitor.description,
          url,
          dateModified: competitor.checked,
        }}
      />

      <Header />

      <main className="cmp-main">
        <nav className="cmp-crumbs" aria-label="Breadcrumb">
          <Link href="/compare">Compare</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{competitor.name}</span>
        </nav>

        <header className="cmp-hero">
          <h1 className="cmp-title">{competitor.heading}</h1>
          <p className="cmp-lede">{competitor.lede}</p>
        </header>

        <section className="cmp-fit" aria-labelledby="cmp-fit-heading">
          <h2 id="cmp-fit-heading">Which one to pick</h2>
          <div className="cmp-fit-grid">
            <div className="cmp-fit-card">
              <h3>Choose {competitor.name} if</h3>
              <p>{competitor.theirFit}</p>
            </div>
            <div className="cmp-fit-card cmp-fit-ours">
              <h3>Choose GrooveSheet if</h3>
              <p>{competitor.ourFit}</p>
            </div>
          </div>
        </section>

        <section className="cmp-lists" aria-labelledby="cmp-wins-heading">
          <div>
            <h2 id="cmp-wins-heading">What {competitor.name} does better</h2>
            <ul className="cmp-list">
              {competitor.wins.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>What GrooveSheet adds</h2>
            <ul className="cmp-list">
              {competitor.ours.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="cmp-table-heading">
          <h2 id="cmp-table-heading">Side by side</h2>
          <div className="cmp-tablewrap">
            <table className="cmp-table">
              <caption className="cmp-caption">
                {competitor.name} column read from{' '}
                <a href={competitor.source} rel="nofollow noopener" target="_blank">
                  {competitor.site}
                </a>{' '}
                on {checked}. &ldquo;{NOT_LISTED}&rdquo; means their own pages did not state it, not that the answer is
                no.
              </caption>
              <thead>
                <tr>
                  <th scope="col">&nbsp;</th>
                  <th scope="col">GrooveSheet</th>
                  <th scope="col">{competitor.name}</th>
                </tr>
              </thead>
              <tbody>
                {competitor.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{ours[row.label] || NOT_LISTED}</td>
                    <td className={row.theirs ? undefined : 'cmp-unlisted'}>{row.theirs || NOT_LISTED}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cmp-cta" aria-labelledby="cmp-cta-heading">
          <h2 id="cmp-cta-heading">Try before you pay either of us</h2>
          <p>
            Both tools let you check the result on your own music first. GrooveSheet previews the first 10 seconds of
            any song free, and the library of finished transcriptions is free to browse and download.
          </p>
          <div className="cmp-actions">
            <Link className="cmp-btn" href="/">
              Transcribe a song
            </Link>
            <Link className="cmp-btn cmp-btn-quiet" href="/explore">
              Browse the library
            </Link>
            <Link className="cmp-btn cmp-btn-quiet" href="/pricing">
              See pricing
            </Link>
          </div>
        </section>

        {others.length > 0 && (
          <section className="cmp-others" aria-labelledby="cmp-others-heading">
            <h2 id="cmp-others-heading">Other comparisons</h2>
            <ul>
              {others.map((c) => (
                <li key={c.slug}>
                  <Link href={comparePath(c)}>GrooveSheet vs {c.name}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <FaqAccordion
          title={`${competitor.name} questions`}
          sections={[
            {
              title: 'Choosing between the two',
              items: faq.map((f, i) => ({
                id: `${competitor.slug}-${i}`,
                question: f.question,
                answer: f.answer,
              })),
            },
          ]}
        />
      </main>

      <Footer />
    </div>
  );
}
