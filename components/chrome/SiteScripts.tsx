/**
 * Third-party tags carried over from public/index.html. A Server Component:
 * it only emits script tags, identical for every visitor.
 *
 * Load order matters less than it did in index.html because every consumer
 * guards for the global being absent (lib/analytics.ts), but the gtag stub is
 * still defined inline first so dataLayer pushes queue until GTM arrives.
 */
import Script from 'next/script';
import { BRAND_SAME_AS } from '@/lib/brandProfiles';
import { COMPANY } from '@/lib/company';

const GTM_ID = 'GTM-PHXB57NW';
const GA4_ID = 'G-LJ5P8PF3YH';
const ADS_ID = 'AW-18426875153';
const META_PIXEL_ID = '2726179107784436';
const ADSENSE_CLIENT = 'ca-pub-8631844190242419';

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://www.groovesheet.net/#organization',
      name: 'GrooveSheet',
      // The two-word spelling is how a good share of people type the brand;
      // Google's "groove sheet" SERP is MDF panels and Groove Scribe today.
      alternateName: ['Groove Sheet', 'groovesheet.net'],
      url: 'https://www.groovesheet.net/',
      logo: 'https://www.groovesheet.net/icons/apple-touch-icon.png',
      // Every profile the footer links, from one list. This had drifted to
      // four of the sixteen, which understates the entity to Google for no
      // reason: sameAs is how it learns that the GitHub org and the LinkedIn
      // page ranking for "groovesheet" are this company.
      sameAs: BRAND_SAME_AS,
      // The company behind the brand. Google says it uses some of these to
      // tell one organization from another, and they are the same values a
      // Crunchbase profile carries, so the two citations agree by
      // construction rather than by someone remembering.
      legalName: COMPANY.legalName,
      foundingDate: COMPANY.incorporatedOn,
      email: COMPANY.businessEmail,
      telephone: COMPANY.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Unit 2A, 17/F, Glenealy Tower, No.1 Glenealy',
        addressLocality: 'Central',
        addressCountry: 'HK',
      },
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.groovesheet.net/#website',
      url: 'https://www.groovesheet.net/',
      name: 'GrooveSheet',
      publisher: { '@id': 'https://www.groovesheet.net/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'GrooveSheet',
      alternateName: 'Groove Sheet',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: 'https://www.groovesheet.net/',
      description:
        'AI music transcription: turn any recording into drum, piano and bass notation, separate stems, and convert audio to MIDI. Exports PDF, MusicXML and MIDI.',
      featureList: [
        'AI stem splitter (vocals, drums, bass, other)',
        'Audio to MIDI conversion',
        'Drum, piano and bass transcription to sheet music',
        'PDF, MusicXML and MIDI export',
      ],
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ],
};

/** Tags for <head>: GTM, gtag (GA4 + Ads), Meta Pixel, AdSense, Trustpilot, JSON-LD. */
export function HeadScripts() {
  return (
    <>
      {/* Google Tag Manager. GTM-PHXB57NW is ours; the older GTM-P9XDD5Z7
          sits under an account we cannot reach and must not come back. */}
      <Script id="gtm" strategy="afterInteractive">
        {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
      </Script>

      {/* Google tag: GA4 plus the Google Ads conversion destination. */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');
gtag('config', '${ADS_ID}');`}
      </Script>

      {/* Meta Pixel. Inline on purpose, not in GTM: conversions belong in
          code, versioned and reviewable, not in a container that can be edited
          silently from outside the repository. Do not move it into GTM. */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>

      {/* Google AdSense (Kelin Studio publisher account). An ad-serving
          library, not a measurement tag, so it is not in GTM. Paired with
          /ads.txt, without which AdSense drops unfilled ad requests. A plain
          async tag in the initial HTML, not next/script: AdSense rejects the
          data-nscript attribute next/script adds, and its reviewer and Auto
          ads both want the tag present on first paint. */}
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
        crossOrigin="anonymous"
      />

      {/* Trustpilot TrustBox bootstrap; components/chrome/TrustBox renders the widget. */}
      <Script src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js" strategy="lazyOnload" />

      <script
        type="application/ld+json"
        // Static, trusted JSON: nothing user-supplied reaches this string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
    </>
  );
}

/** The no-JavaScript fallbacks that belong at the top of <body>. */
export function BodyNoScript() {
  return (
    <>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
