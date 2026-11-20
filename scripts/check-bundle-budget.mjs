#!/usr/bin/env node
// First-load JavaScript per page (gzipped), from the last `next build`.
// Fails when a page goes over its budget in bundle-budget.json.
//
//   pnpm build && pnpm budget
//
// Counts what the browser downloads on a first visit: the runtime chunks, the
// root layout's chunks and the page's own, each once. `next build` stopped
// printing a "First Load JS" column in Next 16, so this is the only number.
//
// Reads Turbopack's manifests (the default bundler since Next 16): runtime
// chunks from build-manifest.json `rootMainFiles`, and per route the
// `entryJSFiles` of server/app/<route>/page_client-reference-manifest.js.
// A `next build --webpack` output has no per-page chunk list, so it can't be
// checked.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { gzipSync } from "node:zlib";

const nextDir = ".next";
const budget = JSON.parse(readFileSync("bundle-budget.json", "utf8"));

const sizes = new Map();
function gzipKb(file) {
  if (!sizes.has(file)) {
    sizes.set(file, gzipSync(readFileSync(join(nextDir, file))).length / 1000);
  }
  return sizes.get(file);
}

/** @returns {Map<string, string[]>} route → JS files a first visit loads */
function turbopackRoutes() {
  const runtime = JSON.parse(
    readFileSync(join(nextDir, "build-manifest.json"), "utf8"),
  ).rootMainFiles;
  const routes = new Map();
  const appDir = join(nextDir, "server", "app");

  for (const rel of readdirSync(appDir, { recursive: true })) {
    if (!rel.endsWith("page_client-reference-manifest.js")) continue;
    // The file assigns globalThis.__RSC_MANIFEST[entry]; run it in a sandbox.
    const sandbox = { self: {} };
    sandbox.globalThis = sandbox;
    runInNewContext(readFileSync(join(appDir, rel), "utf8"), sandbox);

    for (const [entry, manifest] of Object.entries(sandbox.__RSC_MANIFEST)) {
      const files = manifest.entryJSFiles;
      if (!files) {
        console.error(
          "No entryJSFiles in the client manifest: was this a `next build --webpack`?",
        );
        process.exit(1);
      }
      const route = entry === "/page" ? "/" : entry.slice(0, -"/page".length);
      routes.set(route, [
        ...runtime,
        ...(files["[project]/app/layout"] ?? []),
        ...(files[`[project]/app${entry}`] ?? []),
      ]);
    }
  }
  return routes;
}

const routes = turbopackRoutes();
if (routes.size === 0) {
  console.error("No app routes found in .next. Run `pnpm build` first.");
  process.exit(1);
}

const rows = [];
let failed = false;

for (const [route, files] of routes) {
  const js = new Set(files.filter((f) => f.endsWith(".js")));
  const kb = [...js].reduce((sum, file) => sum + gzipKb(file), 0);
  const limit = budget.pages[route] ?? budget.default;
  const over = kb > limit;
  failed ||= over;
  rows.push({ route, kb: kb.toFixed(1), budget: limit, status: over ? "OVER" : "ok" });
}

rows.sort((a, b) => a.route.localeCompare(b.route));
console.table(rows);

if (failed) {
  console.error(
    "First-load JS is over budget. Trim the page, or raise its limit in bundle-budget.json with a reason in the PR.",
  );
  process.exit(1);
}
