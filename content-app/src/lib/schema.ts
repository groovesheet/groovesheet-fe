/* The three JSON-LD builders the blog uses.

   Volumet's version also carried product, service and LocalBusiness nodes for
   its rental pages. None of them apply: GrooveSheet is a web product, not a
   local business with a counter, so the publisher here is an Organization and
   nothing claims an address, a price range or an area served.

   The @id is the important part. Every post points its publisher at one node,
   so the articles reinforce a single entity instead of minting a new one per
   page. The node itself is defined on the CRA app's home page; referencing an
   @id that another page defines is exactly what @id is for. */

const BASE = "https://www.groovesheet.net";
const PUBLISHER_ID = `${BASE}/#organization`;

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${BASE}${item.path}`,
    })),
  };
}

/* The publisher, emitted once per post alongside the article so the reference
   above always resolves even when a crawler sees only this page. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": PUBLISHER_ID,
  name: "GrooveSheet",
  url: BASE,
  logo: `${BASE}/images/Logo_White.png`,
  description:
    "AI music transcription: upload audio and get editable notation as PDF, MusicXML and MIDI, plus stem separation and audio to MIDI.",
  sameAs: [
    "https://www.youtube.com/@GrooveSheet_AI",
    "https://www.instagram.com/groovesheet/",
    "https://x.com/groovesheet_",
    "https://www.linkedin.com/in/groovesheet/",
    "https://www.facebook.com/profile.php?id=61584710236945",
    "https://www.pinterest.com/groovesheet/",
    "https://github.com/groovesheet",
  ],
};

/* Complete BlogPosting node. Always emits url + mainEntityOfPage and an
   absolute image URL, which schema.org requires. */
export function articleJsonLd({
  path,
  headline,
  description,
  datePublished,
  dateModified,
  image,
  authorName,
  section,
  keywords,
}: {
  /** A named person. Omit, or pass a name containing "GrooveSheet", for the organisation. */
  authorName?: string;
  /** Primary topic label, e.g. "Stem separation". */
  section?: string;
  keywords?: string[];
  /** Route path, e.g. "/blog/understanding-ghost-notes-detection". */
  path: string;
  headline: string;
  description: string;
  /** ISO date, e.g. "2026-06-01". */
  datePublished: string;
  dateModified?: string;
  /** Site-relative image path, or an absolute URL; made absolute here. */
  image?: string;
}) {
  const url = `${BASE}${path}`;
  /* Covers come from three places: /blog-media/<id> for a re-hosted press
     image, a path under /images for a default, and an absolute URL for the
     originals, whose cover_image_url points at wherever they were uploaded.
     Only the first two need a prefix. */
  const absolute = (src: string) =>
    /^https?:\/\//.test(src) ? src : `${BASE}${encodeURI(src)}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished,
    ...(dateModified ? { dateModified } : {}),
    ...(image ? { image: absolute(image) } : {}),
    ...(section ? { articleSection: section } : {}),
    ...(keywords?.length ? { keywords: keywords.join(", ") } : {}),
    author:
      authorName && !/groovesheet/i.test(authorName)
        ? { "@type": "Person", name: authorName, worksFor: { "@id": PUBLISHER_ID } }
        : { "@type": "Organization", name: "GrooveSheet", url: BASE },
    publisher: { "@id": PUBLISHER_ID },
  };
}

/* FAQPage node from plain question/answer pairs. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
