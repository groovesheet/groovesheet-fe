import type { MetadataRoute } from "next";
import { allPostsAny } from "@/lib/posts";
import { liveCategories } from "@/lib/blogIndex";

const BASE = "https://www.groovesheet.net";

/* The blog's sitemap, and only the blog's.

   GrooveSheet already serves /sitemap.xml for the whole site: the main Vercel
   project rewrites it to api.groovesheet.net/seo/sitemap.xml, built by
   groovesheet-be/api-orchestrator/routes/seo.py. This app owns three route
   shapes and has no business listing the rest of the site, so it publishes a
   second sitemap covering those three. Two sitemaps on one host is normal and
   both can be submitted in Search Console.

   It is reached at https://www.groovesheet.net/blog-sitemap.xml through the
   rewrite documented in vercel.rewrites.json.

   Worth knowing when the backend one is next touched: seo.py's _blog_entries
   reads Supabase's blog_posts, so it lists the eleven originals and nothing
   the pipeline publishes, which lands in content_drafts. This file lists all
   of them. Overlap between the two is harmless; the gap in that one is why
   this exists.

   Approval calls revalidatePath, so a new post appears here at once. The
   hourly window is the backstop. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.8 },
  ];

  /* lastModified is the only one of the three optional fields Google actually
     uses; it ignores changefreq and priority. It is set only where there is a
     real edit date to set it from. Stamping build time on every URL would be
     worse than omitting it: a sitemap where everything changes on every deploy
     is one Google learns to discount. */
  for (const post of await allPostsAny()) {
    const date = post.frontmatter.updatedAt || post.frontmatter.publishedAt;
    entries.push({
      url: `${BASE}/blog/${post.slug}`,
      changeFrequency: "monthly",
      priority: 0.7,
      ...(date ? { lastModified: new Date(date) } : {}),
    });
  }

  // Topic hubs, only once they hold a post: an empty hub carries noindex.
  for (const topic of await liveCategories()) {
    entries.push({
      url: `${BASE}/blog/category/${topic.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return entries;
}
