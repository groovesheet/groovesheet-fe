/**
 * /compare, the index of the comparison pages. Short by design: its job is to
 * be the crawlable parent of the pages under it and to say what they are for.
 */
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { Link } from '@/lib/navigation';
import { staticRouteMetadata, SITE_NAME } from '@/lib/seo/metadata';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld';
import { COMPETITORS, comparePath } from '@/lib/seo/competitors';
import JsonLd from '@/app/[locale]/explore/_components/JsonLd';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import './_components/Compare.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/compare', locale);
}

export default async function CompareIndex(props: LocaleParams) {
  const locale = await routeLocale(props);

  return (
    <div className="cmp-page">
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: SITE_NAME, path: '/' },
          { name: 'Compare', path: '/compare' },
        ])}
      />
      <Header />

      <main className="cmp-main">
        <header className="cmp-hero">
          <h1 className="cmp-title">GrooveSheet compared with the alternatives</h1>
          <p className="cmp-lede">
            Honest side-by-side pages for the tools people weigh GrooveSheet against. Each one states what the other
            tool does better, lists its prices as that vendor publishes them, and says when the page was last checked
            against their site. Where their own pages do not answer a question, these pages say so rather than guess.
          </p>
        </header>

        <section aria-labelledby="cmp-index-heading">
          <h2 id="cmp-index-heading">The comparisons</h2>
          <ul className="cmp-index-list">
            {COMPETITORS.map((c) => (
              <li key={c.slug}>
                <Link href={comparePath(c)}>
                  GrooveSheet vs {c.name}
                  <span>{c.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="cmp-cta" style={{ marginTop: '48px' }} aria-labelledby="cmp-index-cta">
          <h2 id="cmp-index-cta">Or just try it</h2>
          <p>
            Every tool in this category lets you check the result on your own music before paying. GrooveSheet previews
            the first 10 seconds of any song free, and the library of finished transcriptions is free to browse and
            download in full.
          </p>
          <div className="cmp-actions">
            <Link className="cmp-btn" href="/">
              Transcribe a song
            </Link>
            <Link className="cmp-btn cmp-btn-quiet" href="/explore">
              Browse the library
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
