/* The same rules scripts/generate-post.mjs enforces on a file, applied to a
   draft row. Thresholds, banned phrases and money pages all come from
   scripts/pipeline.config.json, so the two validators cannot drift apart on
   values, only on code.

   Errors block approval. Warnings are shown to the reviewer and block nothing. */
import cfg from "../../../scripts/pipeline.config.json";
import type { Faq, Validation } from "./types";

export type Checkable = {
  seoTitle?: string;
  slug: string;
  title: string;
  description: string;
  summary: string;
  faqs: Faq[];
  bodyMarkdown: string;
};

export function moneyPaths(): string[] {
  return cfg.moneyPages.map((m) => m.path);
}

export function validateDraft(d: Checkable): Validation {
  const v = cfg.validation;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!new RegExp(v.slugPattern).test(d.slug)) {
    errors.push(`slug.pattern: "${d.slug}" must match ${v.slugPattern}`);
  }
  if (d.slug.length > v.slugMaxChars) {
    errors.push(`slug.length: ${d.slug.length} chars, limit ${v.slugMaxChars}`);
  }

  if (v.reservedSlugs.includes(d.slug)) {
    errors.push(`slug.reserved: "${d.slug}" is a section of the blog, pick another`);
  }
  if (d.seoTitle && d.seoTitle.length > 60) {
    errors.push(`seoTitle.length: ${d.seoTitle.length} chars, limit 60`);
  }

  if (!d.title.trim()) errors.push("title: missing");
  if (d.title.length > v.titleMaxChars) {
    errors.push(
      `title.length: ${d.title.length} chars, limit ${v.titleMaxChars} (the layout appends "${cfg.content.titleSuffix}")`,
    );
  }
  if (d.title.includes(cfg.content.titleSuffix.trim())) {
    errors.push("title.suffix: the layout adds the site name, leave it out");
  }

  const dl = d.description.length;
  if (dl < v.descriptionMinChars || dl > v.descriptionMaxChars) {
    errors.push(
      `description.length: ${dl} chars, must be ${v.descriptionMinChars} to ${v.descriptionMaxChars}`,
    );
  }
  if (!d.summary.trim()) errors.push("summary: missing");
  if (d.summary.length > v.summaryMaxChars) {
    errors.push(`summary.length: ${d.summary.length} chars, limit ${v.summaryMaxChars}`);
  }

  const { min, max } = cfg.content.faqCount;
  if (d.faqs.length < min || d.faqs.length > max) {
    errors.push(`faqs.count: ${d.faqs.length}, must be ${min} to ${max}`);
  }
  if (d.faqs.some((f) => !f.q?.trim() || !f.a?.trim())) {
    errors.push("faqs.shape: every FAQ needs a question and an answer");
  }

  const body = d.bodyMarkdown;
  if (body.length < v.minBodyChars) {
    errors.push(`body.length: ${body.length} chars, minimum ${v.minBodyChars}`);
  }

  const linked = new Set<string>();
  for (const m of body.matchAll(/\]\((\/[^)\s#?]*)/g)) {
    const path = m[1].replace(/\/$/, "") || "/";
    if (moneyPaths().includes(path)) linked.add(path);
  }
  if (linked.size < v.minMoneyPageLinks) {
    errors.push(
      `links.money: ${linked.size} distinct money pages linked, minimum ${v.minMoneyPageLinks} (${moneyPaths().join(", ")})`,
    );
  }

  if (/^\s*(import|export)\s/m.test(body) || /<[A-Z][A-Za-z]*[\s/>]/.test(body)) {
    errors.push("body.jsx: markdown only, no imports, exports or components");
  }

  // Bare URLs: anything not sitting inside a markdown link target or angle brackets.
  const withoutLinks = body.replace(/\]\([^)]*\)/g, "]()").replace(/<https?:[^>]+>/g, "");
  if (/https?:\/\//.test(withoutLinks)) {
    errors.push("body.bareUrl: wrap every URL in a markdown link");
  }

  /* Voice rules apply to everything a reader sees, not only the body. */
  const prose = [d.title, d.description, d.summary, body, ...d.faqs.flatMap((f) => [f.q, f.a])].join(
    "\n",
  );
  const lower = prose.toLowerCase();
  for (const phrase of cfg.voice.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) errors.push(`voice.banned: "${phrase}"`);
  }
  for (const p of cfg.voice.bannedPatterns) {
    if (new RegExp(p.pattern, "i").test(prose)) errors.push(`voice.pattern: ${p.reason}`);
  }

  for (const disc of cfg.voice.requiredDisclaimers) {
    const hit = disc.whenBodyMentions.find((w) =>
      new RegExp(`(^|[^a-z])${w.replace(/[$]/g, "\\$")}([^a-z]|$)`, "i").test(body),
    );
    if (hit) warnings.push(`${disc.id}: mentions "${hit}". ${disc.text}`);
  }

  return { errors, warnings };
}

/** Captions carry the same voice bans as posts. */
export function validateCaption(text: string, limit: number): string[] {
  const errors: string[] = [];
  if (!text.trim()) errors.push("empty");
  if (text.length > limit) errors.push(`${text.length} chars, limit ${limit}`);
  const lower = text.toLowerCase();
  for (const phrase of cfg.voice.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) errors.push(`banned phrase "${phrase}"`);
  }
  if (/[\u2014\u2013]/.test(text)) errors.push("contains a dash character");
  return errors;
}
