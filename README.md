# brand-leak-guard

Fail the deploy when a built site mentions a brand it shouldn't.

```
$ node brand-leak-guard.mjs ./dist --self clientsite.com --terms "Agency Name,agencysite.com"
blog/index.html:214  [agencysite.com]  <a href="https://agencysite.com/portal">Account</a>
LEAKS: 1 — 87 files scanned, 2 forbidden terms, self=clientsite.com
```

## Why

If you run multiple white-label or client sites off shared infrastructure,
brand isolation is a promise: the client's site must never surface your agency
name, your other clients, or shared internal domains. The leaks never come from
the page you're editing — they come from a footer partial, a `mailto:`, a
JSON-LD block, a meta tag, a sitemap, an error page.

Humans miss these. Manual grep gets skipped under deadline. The fix is
**fail-closed**: make the check a hard gate in every deploy lane, so a hit
aborts the ship instead of relying on someone remembering to look.

## Usage

```
brand-leak-guard <dir> --self <own-domain> (--terms "a,b" | --terms-file <path>) [--json]
```

- `<dir>` — the **built** output you're about to deploy (scan what ships, not
  the source).
- `--self` — the site's own domain; guards against a forbidden term that would
  match the site itself.
- `--terms` / `--terms-file` — strings that must never appear: other brand
  names, other domains, internal hostnames, personal emails. `#` lines in the
  file are comments.
- `--json` — machine-readable output for CI.

Exit codes: `0` clean, `1` leaks, `2` usage error.

```bash
# deploy.sh
npm run build
node brand-leak-guard.mjs ./dist --self clientsite.com --terms-file forbidden.txt || exit 1
rsync -az ./dist/ deploy-target:/srv/site/
```

Scans text-bearing files by extension (`.html .js .css .json .xml .svg
.webmanifest .map` …) — case-insensitive, zero dependencies, plain Node.

## Free templates

- [Forbidden terms template](examples/forbidden-terms.template.txt) — copy and
  edit per client or product release.
- [GitHub Action template](examples/github-action.yml) — wire the guard into
  pull requests and `main` pushes.
- [White-label release checklist](docs/white-label-release-checklist.md) —
  what to scan before and after deploy.

## What it doesn't do

It can't see strings assembled at runtime, and it doesn't crawl the live site
after deploy. For belt-and-suspenders, follow the deploy with a crawl of every
sitemap URL and run the same term list over the responses.

## License

MIT
