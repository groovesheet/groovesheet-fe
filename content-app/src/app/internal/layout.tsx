import type { Metadata } from "next";
import { getSession } from "./_lib/auth";
import Chrome from "./_components/Chrome";
import type { Badges } from "./_lib/nav";
import "./internal.css";
import { countDraftsToReview } from "@/lib/content/store";

/* Not indexable, not linked from the public nav or footer, and excluded from
   src/app/sitemap.ts. middleware.ts adds X-Robots-Tag on top of this. */
export const metadata: Metadata = {
  title: "Internal",
  robots: { index: false, follow: false },
};

/* Draft counts change on every click, so nothing here is worth caching. */
export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  /* /internal/login is the one route middleware.ts lets through without a
     session, and it lives under this layout, so "no session" means "this is
     the login page". Render it bare: it draws its own full-bleed screen and
     must not get the shell (or the badge query, which would run before anyone
     had signed in). Every other route was already redirected. */
  if (!session) return <div className="int-root">{children}</div>;

  /* Never let the content tables take the whole portal down: before
     src/lib/content/schema.sql is applied this query throws. */
  const toReview = await countDraftsToReview().catch(() => 0);

  const badges: Badges = {
    draftsToReview: toReview > 0 ? String(toReview) : undefined,
  };

  return (
    <div className="int-root">
      <Chrome user={session.user} badges={badges}>
        {children}
      </Chrome>
    </div>
  );
}
