/* Date formatting shared by the lead table and the lead detail page.

   Kept out of the pages themselves because a route file may only export the
   handful of things Next recognises, and both screens format the same two
   timeline dates the same way. */

/** A day, with the year only when it is not this one. */
export function formatDay(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

/** "today", "yesterday", then "n days". Reads next to a date, not instead. */
export function daysSince(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days`;
}
