import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cli = fileURLToPath(new URL("../brand-leak-guard.mjs", import.meta.url));

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "brand-leak-guard-test-"));
  for (const [relative, content] of Object.entries(files)) {
    const target = join(root, relative);
    mkdirSync(join(target, ".."), { recursive: true });
    writeFileSync(target, content);
  }
  return root;
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [cli, directory, ...args], { encoding: "utf8" });
}

test("clean site exits zero and reports its scan count", () => {
  const root = fixture({ "index.html": "<title>Own Site</title>", "asset.png": "ignored" });
  try {
    const result = run(root, "--self", "own.example", "--terms", "Other Brand,other.example", "--json");
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.filesScanned, 1);
    assert.deepEqual(report.hits, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("visible and metadata leaks fail with exact locations", () => {
  const root = fixture({ "index.html": "<meta content=\"other.example\">\nOther Brand" });
  try {
    const result = run(root, "--self", "own.example", "--terms", "Other Brand,other.example", "--json");
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.hits.length, 2);
    assert.deepEqual(report.hits.map((hit) => hit.line), [1, 2]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a forbidden term matching the site's own domain is a usage error", () => {
  const root = fixture({ "index.html": "clean" });
  try {
    const result = run(root, "--self", "own.example", "--terms", "own.example");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /matches the site's own domain/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
