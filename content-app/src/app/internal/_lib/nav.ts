/* The whole nav, as data.

   Adding a module is one entry in NAV plus its page directory. Nothing else in
   the shell needs to change: the sidebar, the breadcrumb and the page title all
   read from here.

   Only the Content group is ported. The Volumet portal also carried Sales and
   Documents modules (leads, prospects, quotes, invoices, resources); none of
   them exist here, so they are not listed and their badge queries are gone
   from the layout too.

   Glyphs are mono characters rather than icon components so this stays plain
   serialisable data, passable from the server layout into the client sidebar. */

export type BadgeKey = "draftsToReview";

export type NavItem = {
  href: string;
  label: string;
  glyph: string;
  badge?: BadgeKey;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: "Content",
    items: [
      { href: "/internal/blog", label: "Blog", glyph: "✎", badge: "draftsToReview" },
      { href: "/internal/social", label: "Social", glyph: "◎" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem | null = null;

/** Resolved server-side in the layout and handed to the sidebar. */
export type Badges = Partial<Record<BadgeKey, string>>;

/** Page title and one-line description, keyed by route. */
export const PAGE_META: Record<string, { title: string; desc: string }> = {
  "/internal": {
    title: "Internal",
    desc: "The content pipeline and what it has published.",
  },
  "/internal/blog": {
    title: "Blog",
    desc: "Music tech news drafted into posts, held for approval.",
  },
  "/internal/social": {
    title: "Social",
    desc: "The LinkedIn, Facebook, Instagram and Pinterest posts written from each blog post.",
  },
};

/** Which nav item a given path lights up. A record keeps its module active. */
export function activeHref(pathname: string): string {
  const all = NAV.flatMap((g) => g.items);
  const hit = all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return hit?.href ?? "/internal";
}
