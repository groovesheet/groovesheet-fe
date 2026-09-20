#!/usr/bin/env node
/**
 * Hard gate: no em-dash (—) anywhere in shipped content.
 *
 * House style, decided 2026-08-18: the em-dash reads as machine-written, so it
 * is banned from anything that ships. Use a colon where the clause elaborates,
 * a comma where it continues, or a full stop.
 *
 *   the LOD is stated in the quote — per system    ->  ...quote: per system
 *   a bigger job than a scan — and one we won't do ->  ...scan, and one we won't do
 *
 * NOT banned, and deliberately so:
 *   – en-dash, which is correct for numeric ranges (120–300 m, LOD 200–300)
 *   − minus sign
 *   - hyphen
 * Those carry meaning an em-dash does not, and replacing them would be wrong.
 *
 *   node scripts/check-em-dash.mjs          # check, exit 1 on any hit
 *   node scripts/check-em-dash.mjs --fix    # not provided on purpose, see below
 *
 * There is no --fix. Choosing between a colon and a comma needs to read the
 * sentence: a colon before a conjunction ("scan: and a claim...") is a grammar
 * error, and a blind pass produces exactly that. Fix them by hand.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["src", "content"];
const EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".yaml", ".yml", ".md", ".mdx", ".json", ".css"]);
const EM_DASH = "—";

/* The literal character is not the only way an em-dash ships. HTML entities
   render as one in the browser while reading as plain ASCII on disk, so a
   grep for the character alone let `&mdash;` through: seven of them had
   accumulated in src/app/blog/page.tsx. Match the entity forms too. */
const EM_DASH_ENTITIES = [/&mdash;/i, /&#8212;/, /&#x2014;/i];

/** Every way an em-dash can appear, with the column of the first hit. */
function findEmDash(line) {
  const i = line.indexOf(EM_DASH);
  if (i !== -1) return { col: i + 1, form: EM_DASH };
  for (const re of EM_DASH_ENTITIES) {
    const m = line.match(re);
    if (m) return { col: m.index + 1, form: m[0] };
  }
  return null;
}

/** This file necessarily contains the character it bans. */
const SELF = "scripts/check-em-dash.mjs";

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXTS.has(extname(p))) out.push(p);
  }
  return out;
}

const hits = [];
for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = walk(join(ROOT, dir));
  } catch {
    continue; // directory may not exist in every checkout
  }
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (rel === SELF) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const found = findEmDash(line);
      if (!found) return;
      hits.push({
        rel,
        line: i + 1,
        col: found.col,
        form: found.form,
        text: line.trim().slice(0, 120),
      });
    });
  }
}

if (hits.length === 0) {
  console.log("check-em-dash: clean, no em-dash in src/ or content/");
  process.exit(0);
}

console.error(`\ncheck-em-dash: ${hits.length} em-dash(es) found. House style bans them.\n`);
for (const h of hits) {
  console.error(`  ${h.rel}:${h.line}:${h.col}`);
  console.error(`    ${h.text}`);
}
console.error(
  "\nReplace each one by reading the sentence:\n" +
    "  elaboration  -> colon    (one thing matters: the deadline)\n" +
    "  continuation -> comma    (a big job, and one we will not quote)\n" +
    "  parenthetical-> commas   (the QP, a registered architect, remains responsible)\n" +
    "  hard break   -> full stop\n" +
    "Numeric ranges keep the en-dash (120–300 m). Do not convert those.\n"
);
process.exit(1);
