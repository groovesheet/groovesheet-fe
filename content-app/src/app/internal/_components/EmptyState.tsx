/* Used for the two placeholder modules and for a filter that matches nothing.
   Same plate either way, so an empty table does not look like a broken one. */
export default function EmptyState({
  glyph = "◷",
  title,
  desc,
}: {
  glyph?: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="int-soon">
      <span
        className="gs-glyph-plate"
        style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}
      >
        {glyph}
      </span>
      <span className="gs-title-md">{title}</span>
      <p className="int-soon-desc">{desc}</p>
    </div>
  );
}
