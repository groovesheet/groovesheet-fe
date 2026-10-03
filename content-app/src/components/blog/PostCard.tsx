import Link from "next/link";
import type { BlogCard } from "@/lib/blogIndex";

/* The one post card. Same markup the index always used, now fed from
   src/lib/blogIndex.ts instead of being written out per post. */
export default function PostCard({ card }: { card: BlogCard }) {
  return (
    <Link className="post-card" href={card.href}>
      <div className="media-frame ar-16-9">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={card.image} alt={card.alt} />
      </div>
      <div className="post-card__body">
        <span className="article-meta">{card.meta}</span>
        <span className="post-card__title">{card.title}</span>
        <p className="post-card__desc">{card.desc}</p>
      </div>
    </Link>
  );
}
