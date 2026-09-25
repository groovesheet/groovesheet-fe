/**
 * Inline JSON-LD for structured data. Server-safe; `<` is escaped so a title
 * containing "</script>" cannot close the tag early.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
