import { FileText, Inbox, Share2, type LucideIcon } from "lucide-react";

/* Used for the two placeholder modules and for a filter that matches nothing.
   Same plate either way, so an empty table does not look like a broken one.

   Callers still pass the module's text glyph; it picks an outline icon, which
   is how the design system draws empty states (stroked, currentColor, never
   filled or coloured). */
const ICONS: Record<string, LucideIcon> = {
  "✎": FileText,
  "◎": Share2,
};

export default function EmptyState({
  glyph = "◷",
  title,
  desc,
}: {
  glyph?: string;
  title: string;
  desc: string;
}) {
  const Icon = ICONS[glyph] ?? Inbox;
  return (
    <div className="int-soon">
      <Icon className="int-soon-icon" size={44} strokeWidth={1.5} aria-hidden="true" />
      <span className="int-soon-title">{title}</span>
      <p className="int-soon-desc">{desc}</p>
    </div>
  );
}
