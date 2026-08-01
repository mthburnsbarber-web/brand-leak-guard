#!/usr/bin/env node
// brand-leak-guard — fail a deploy when a built site mentions a brand it shouldn't.
//
// If you build multiple white-label or client sites from shared infrastructure,
// one stray string — a footer, a mailto:, a JSON-LD block, a meta tag — breaks
// the isolation. Humans miss these; grep-by-hand gets skipped under deadline.
// This is the fail-closed version: point it at a build output directory, tell
// it which domain the site IS, list the strings it must NEVER contain, and wire
// it into the deploy so a hit aborts the ship.
//
//   brand-leak-guard ./dist --self example.com --terms "Other Brand,otherbrand.com"
//   brand-leak-guard ./dist --self example.com --terms-file forbidden.txt
//
// Exit codes: 0 clean, 1 leaks found, 2 usage error.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

const TEXT_EXT = new Set([
  ".html", ".htm", ".xhtml", ".css", ".js", ".mjs", ".cjs", ".json", ".xml",
  ".txt", ".md", ".svg", ".webmanifest", ".map", ".yaml", ".yml", ".rss", ".atom",
]);

function usage(msg) {
  if (msg) console.error(`error: ${msg}\n`);
  console.error(
    `usage: brand-leak-guard <dir> --self <own-domain> (--terms "a,b" | --terms-file <path>) [--json]`,
  );
  process.exit(2);
}

// --- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
let dir, self, json = false;
const terms = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--self") self = argv[++i];
  else if (a === "--terms") terms.push(...String(argv[++i]).split(","));
  else if (a === "--terms-file")
    terms.push(...readFileSync(argv[++i], "utf8").split("\n"));
  else if (a === "--json") json = true;
  else if (!dir) dir = a;
  else usage(`unexpected argument: ${a}`);
}
if (!dir) usage("missing <dir>");
if (!self) usage("missing --self <own-domain>");
const forbidden = [...new Set(
  terms.map((t) => t.trim()).filter((t) => t && !t.startsWith("#")),
)];
if (forbidden.length === 0) usage("no forbidden terms given");

const selfLower = self.toLowerCase();
for (const t of forbidden) {
  if (selfLower.includes(t.toLowerCase()))
    usage(`term "${t}" matches the site's own domain "${self}" — every page would fail`);
}

// --- scan -------------------------------------------------------------------
function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (TEXT_EXT.has(extname(name).toLowerCase())) yield p;
  }
}

const hits = [];
let filesScanned = 0;
for (const file of walk(dir)) {
  filesScanned++;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    for (const term of forbidden) {
      const col = lower.indexOf(term.toLowerCase());
      if (col !== -1) {
        hits.push({
          file: relative(dir, file),
          line: idx + 1,
          term,
          excerpt: line.trim().slice(0, 160),
        });
      }
    }
  });
}

// --- report -----------------------------------------------------------------
if (json) {
  console.log(JSON.stringify({ dir, self, filesScanned, hits }, null, 2));
} else {
  for (const h of hits)
    console.log(`${h.file}:${h.line}  [${h.term}]  ${h.excerpt}`);
  console.log(
    `${hits.length === 0 ? "CLEAN" : "LEAKS: " + hits.length} — ${filesScanned} files scanned, ${forbidden.length} forbidden terms, self=${self}`,
  );
}
process.exit(hits.length === 0 ? 0 : 1);
