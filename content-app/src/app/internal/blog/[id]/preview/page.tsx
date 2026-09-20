import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { getDraft } from "@/lib/content/store";
import { prepareBody } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/* The saved draft, set in the public article styles, behind the portal
   session. Its own route rather than a panel on the editor: MDX that will not
   compile should cost the reviewer the preview, not the editor. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = /^\d+$/.test(id) ? await getDraft(Number(id)) : null;
  if (!draft) notFound();

  const { content } = await compileMDX({
    source: prepareBody(draft.bodyMarkdown),
    options: { parseFrontmatter: false },
  });

  return (
    <div style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", padding: "40px clamp(20px, 4vw, 64px)" }}>
      <span className="gs-overline">Blog · {draft.category}</span>
      <h1 style={{ maxWidth: 820, margin: "16px 0" }}>{draft.title}</h1>
      <p className="hero-sub" style={{ maxWidth: 640 }}>{draft.summary}</p>
      <article className="article" style={{ marginTop: 40 }}>{content}</article>
      {draft.faqs.length ? (
        <article className="article" style={{ marginTop: 48 }}>
          <h2>Frequently asked questions</h2>
          {draft.faqs.map((f) => (
            <div key={f.q}>
              <h3>{f.q}</h3>
              <p>{f.a}</p>
            </div>
          ))}
        </article>
      ) : null}
    </div>
  );
}
