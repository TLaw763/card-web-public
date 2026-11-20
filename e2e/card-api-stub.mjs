// Stand-in card-api for the Playwright smoke tests.
//
// Replay (default): answers from e2e/fixtures/card-api/, so CI needs no key
// and doesn't depend on the iMac. Record (E2E_RECORD=1): forwards to the
// card-api in .env.local and saves each JSON response. Asset bytes are never
// recorded; every asset is served as a small placeholder PNG.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "card-api");
const PORT = Number(process.env.E2E_CARD_API_PORT ?? 3901);
const RECORD = process.env.E2E_RECORD === "1";
const SAVED_HEADERS = ["cache-control", "content-type", "etag", "x-data-version"];

// Fault injection for reviewing error/empty/loading states (regex on
// "METHOD /path?query"): E2E_STUB_FAIL answers 503, E2E_STUB_EMPTY an empty
// page, E2E_STUB_DELAY_MS waits before every answer. Clear Next's fetch
// cache (.next/cache/fetch-cache) first, or server renders reuse old data.
const FAIL = process.env.E2E_STUB_FAIL ? new RegExp(process.env.E2E_STUB_FAIL) : null;
const EMPTY = process.env.E2E_STUB_EMPTY ? new RegExp(process.env.E2E_STUB_EMPTY) : null;
const DELAY_MS = Number(process.env.E2E_STUB_DELAY_MS ?? 0);

// 1×1 grey PNG.
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4BwAA3gDduE5tUQAAAABJRU5ErkJggg==",
  "base64",
);

let upstream = null;
if (RECORD) {
  process.loadEnvFile(".env.local");
  upstream = {
    origin: process.env.PUBLIC_CARD_API_ORIGIN,
    apiKey: process.env.CARD_API_SERVICE_TOKEN || null,
  };
  if (!upstream.origin) {
    throw new Error("Recording needs PUBLIC_CARD_API_ORIGIN in .env.local.");
  }
  mkdirSync(FIXTURE_DIR, { recursive: true });
}

/**
 * A page cursor without its issue time and signature. card-api signs a new
 * cursor (`iat`) on every request, so the page-1 fixture recorded by one test
 * would otherwise point at a page 2 that no fixture has (2026-10-13).
 */
function stableCursor(cursor) {
  const [payload] = cursor.split(".");
  try {
    const { iat: _issuedAt, ...rest } = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    const sorted = Object.fromEntries(
      Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)),
    );
    return `cursor:${JSON.stringify(sorted)}`;
  } catch {
    return cursor;
  }
}

/** Method + path + sorted query, so parameter order doesn't matter. */
function requestKey(method, url) {
  const params = [...url.searchParams]
    .map(([name, value]) => [name, name === "page[after]" ? stableCursor(value) : value])
    .sort(([a], [b]) => a.localeCompare(b));
  const query = new URLSearchParams(params).toString();
  return `${method} ${url.pathname}${query ? `?${query}` : ""}`;
}

function fixturePath(key) {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return join(FIXTURE_DIR, `${hash}.json`);
}

async function record(key, url) {
  const headers = { Accept: "application/json" };
  if (upstream.apiKey) {
    headers["X-API-Key"] = upstream.apiKey;
  }
  const response = await fetch(new URL(url.pathname + url.search, upstream.origin), {
    headers,
  });
  const fixture = {
    key,
    status: response.status,
    headers: Object.fromEntries(
      SAVED_HEADERS.flatMap((name) => {
        const value = response.headers.get(name);
        return value ? [[name, value]] : [];
      }),
    ),
    body: await response.text(),
  };
  writeFileSync(fixturePath(key), `${JSON.stringify(fixture, null, 2)}\n`);
  return fixture;
}

function replay(key) {
  const path = fixturePath(key);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://stub.local");
  const method = req.method === "HEAD" ? "GET" : (req.method ?? "GET");

  if (url.pathname.startsWith("/v1/assets/")) {
    res.writeHead(200, {
      "content-type": "image/png",
      "cache-control": "public, max-age=31536000, immutable",
    });
    res.end(req.method === "HEAD" ? undefined : PLACEHOLDER_PNG);
    return;
  }

  const key = requestKey(method, url);
  if (DELAY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
  if (FAIL?.test(key)) {
    res.writeHead(503, { "content-type": "application/problem+json" });
    res.end(
      JSON.stringify({
        type: "about:blank",
        title: "Service unavailable (stub fault)",
        status: 503,
        code: "unavailable",
      }),
    );
    return;
  }
  if (EMPTY?.test(key)) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        data: [],
        meta: {
          dataVersion: "stub-empty",
          requestId: "00000000-0000-4000-8000-000000000000",
          page: {
            limit: Number(url.searchParams.get("page[limit]") ?? 20),
            hasMore: false,
            nextCursor: null,
          },
        },
      }),
    );
    return;
  }
  try {
    const fixture = RECORD ? await record(key, url) : replay(key);
    if (!fixture) {
      console.error(`[card-api-stub] no fixture for ${key} (run pnpm e2e:record)`);
      res.writeHead(404, { "content-type": "application/problem+json" });
      res.end(
        JSON.stringify({
          type: "about:blank",
          title: "No fixture",
          status: 404,
          code: "not_found",
        }),
      );
      return;
    }

    const etag = fixture.headers.etag;
    if (etag && req.headers["if-none-match"] === etag) {
      res.writeHead(304, { etag });
      res.end();
      return;
    }
    res.writeHead(fixture.status, fixture.headers);
    res.end(req.method === "HEAD" ? undefined : fixture.body);
  } catch (error) {
    console.error(`[card-api-stub] ${key} failed`, error);
    res.writeHead(502, { "content-type": "application/problem+json" });
    res.end(JSON.stringify({ title: "Stub upstream failed", status: 502 }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[card-api-stub] ${RECORD ? "recording" : "replaying"} on :${PORT}`);
});
