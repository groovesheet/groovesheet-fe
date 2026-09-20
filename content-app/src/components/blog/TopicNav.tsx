import Link from "next/link";

/* Topic links, as real links to real pages rather than a client-side filter:
   each hub is a crawlable URL with its own title and description, and this
   nav is the internal linking that gets them found. */
export default function TopicNav({
  topics,
  current,
}: {
  topics: { slug: string; label: string; count: number }[];
  current?: string;
}) {
  if (topics.length === 0) return null;
  return (
    <nav aria-label="Blog topics">
      <ul className="topic-nav">
        <li>
          <Link href="/blog" aria-current={current ? undefined : "page"}>
            All posts
          </Link>
        </li>
        {topics.map((t) => (
          <li key={t.slug}>
            <Link href={`/blog/category/${t.slug}`} aria-current={current === t.slug ? "page" : undefined}>
              {t.label} <span className="topic-count">{t.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
