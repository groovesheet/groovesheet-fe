import { getTranslations } from 'next-intl/server';
import Header from '@/components/chrome/Header';
import Footer from '@/components/chrome/Footer';
import { staticRouteMetadata } from '@/lib/seo/metadata';
import { routeLocale, type LocaleParams } from '../_components/routeLocale';
import './Changelog.css';

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  return staticRouteMetadata('/changelog', locale);
}

type ChangelogTag = 'new' | 'improved' | 'fixed';

interface ChangelogRelease {
  /** Key under `changelogPage.entries` in messages/{locale}.json. */
  id: string;
  datetime: string;
  version: string;
  tags: ChangelogTag[];
  /** Keys under `changelogPage.entries.<id>.items`, in display order. */
  items: string[];
  /** The release has a `caption` message and shows the illustration. */
  caption?: boolean;
}

/**
 * Releases, newest first. The words live in messages/{locale}.json under
 * `changelogPage.entries.<id>`, so the page reads in the visitor's language;
 * this list holds only the shape. Add a release here and in all three message
 * files when shipping.
 */
const RELEASES: ChangelogRelease[] = [
  {
    id: 'v1_9',
    datetime: '2026-10-05',
    version: '1.9',
    tags: ['new', 'improved', 'fixed'],
    items: ['wechat', 'keepPreview', 'phones', 'signIn', 'downloads'],
  },
  {
    id: 'v1_8',
    datetime: '2026-09-29',
    version: '1.8',
    tags: ['new', 'improved', 'fixed'],
    items: ['partPages', 'chinese', 'previewFirst', 'outOfMinutes', 'playback'],
  },
  {
    id: 'v1_7',
    datetime: '2026-09-07',
    version: '1.7',
    tags: ['new', 'improved'],
    items: ['pdf', 'search', 'views', 'phone', 'codes'],
  },
  {
    id: 'v1_6',
    datetime: '2026-08-25',
    version: '1.6',
    tags: ['new', 'improved', 'fixed'],
    items: ['geo', 'yuan', 'scorePreviews', 'credits', 'sync'],
  },
  {
    id: 'v1_5',
    datetime: '2026-07-11',
    version: '1.5',
    tags: ['new', 'improved', 'fixed'],
    items: ['drums', 'fullScreen', 'refunds', 'noNotes'],
  },
];

function CaptionArt() {
  return (
    <svg
      width="128"
      height="62"
      viewBox="0 0 128 62"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 14h112M8 24h112M8 34h112M8 44h112" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M22 34v-16M22 18l10-2v15" />
      <circle cx="20" cy="34" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="31" r="3.2" fill="currentColor" stroke="none" />
      <path d="M58 38v-20M58 18l11-2.5v18" />
      <circle cx="56" cy="38" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="67" cy="33.5" r="3.2" fill="currentColor" stroke="none" />
      <path d="M96 30v-14M96 16l9-1.5v13" />
      <circle cx="94" cy="30" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="103" cy="27.5" r="3.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default async function ChangelogPage(props: LocaleParams) {
  const locale = await routeLocale(props);
  const t = await getTranslations({ locale, namespace: 'changelogPage' });
  // Dates are stored as ISO days and read in the visitor's locale:
  // "October 5, 2026" in English, "2026年10月5日" in Chinese.
  const dateFormat = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

  return (
    <div className="changelog-page">
      <Header />

      <main className="changelog-main">
        <div className="changelog-head">
          <div>
            <h1 className="changelog-title">{t('title')}</h1>
            <p className="changelog-subtitle">{t('subtitle')}</p>
          </div>
        </div>

        <ol className="changelog-list">
          <div className="changelog-rail" aria-hidden="true" />
          {RELEASES.map((entry, i) => {
            const isLatest = i === 0;
            const key = `entries.${entry.id}`;
            return (
              <li className="changelog-item" key={entry.id}>
                <span
                  className={`changelog-dot${isLatest ? ' is-latest' : ''}`}
                  aria-hidden="true"
                />
                <article className="changelog-card">
                  <div className="changelog-card-head">
                    <div className="changelog-meta">
                      <h2 className="changelog-entry-title">{t(`${key}.title`)}</h2>
                      <div className="changelog-datewrap">
                        <time className="changelog-date" dateTime={entry.datetime}>
                          {dateFormat.format(new Date(entry.datetime))}
                        </time>
                        <span className="changelog-sep" aria-hidden="true">
                          ·
                        </span>
                        <span className="changelog-version">v{entry.version}</span>
                      </div>
                    </div>
                    <div className="changelog-badges">
                      {entry.tags.map((tag) => (
                        <span key={tag} className={`changelog-badge badge-${tag}`}>
                          {t(`badges.${tag}`)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ul className="changelog-body">
                    {entry.items.map((item) => (
                      <li key={item}>
                        <span className="changelog-bullet" aria-hidden="true" />
                        <span>{t(`${key}.items.${item}`)}</span>
                      </li>
                    ))}
                  </ul>

                  {entry.caption && (
                    <div className="changelog-image">
                      <CaptionArt />
                      <span className="changelog-caption">{t(`${key}.caption`)}</span>
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      </main>

      <Footer />
    </div>
  );
}

