/* Who is signed into the portal.

   Volumet's equivalent was _lib/owners.ts, where the list existed so a lead
   could be owned by a person. Nothing here is owned. The name is still worth
   asking for, because approving a post writes it to content_drafts.approved_by
   and that is the only record of who let a post go live.

   In shared-password mode this is ATTRIBUTION, NOT AUTHENTICATION: anyone
   holding the password can claim to be either person. Set INTERNAL_USERS
   instead of INTERNAL_PASSWORD when that distinction starts to matter, and
   each name gets its own credential.

   The names come from pipeline.config.json so the sign-in list and the post
   byline list never drift apart. */
import cfg from "../../../../scripts/pipeline.config.json";

export type Editor = { id: string; name: string };

function idFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const EDITORS: Editor[] = cfg.taxonomy.authors.map((name: string) => ({
  id: idFor(name),
  name,
}));

export const DEFAULT_EDITOR = EDITORS[0].id;

export function isEditor(id: string): boolean {
  return EDITORS.some((e) => e.id === id);
}

/** Full name for display, falling back to the raw id for legacy sessions. */
export function editorName(id: string): string {
  return EDITORS.find((e) => e.id === id)?.name ?? id;
}
