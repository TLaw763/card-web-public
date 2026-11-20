import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  ProxyRequestError,
  BFF_CDN_CACHE_CONTROL,
  applyBffCachePolicy,
  buildUpstreamUrl,
  isCdnCacheable,
  isAllowedCardApiPath,
  isAssetPath,
  proxyCardApiRequest,
} from "../lib/card-api-proxy.js";

describe("card-api proxy", () => {
  it("allows only public catalog routes", () => {
    assert.equal(isAllowedCardApiPath(["v1", "cards"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "cards", "search"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "sets"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "sets", "LOB-EN"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "assets", "a".repeat(64)]), true);
    assert.equal(isAllowedCardApiPath(["v1", "admin", "publish"]), false);
    assert.equal(isAllowedCardApiPath(["health"]), false);
  });

  it("allows estimate lookups but not the estimate change feed", () => {
    assert.equal(isAllowedCardApiPath(["v1", "estimates"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "printings", "x", "estimate"]), true);
    assert.equal(isAllowedCardApiPath(["v1", "estimates", "changes"]), false);
    assert.equal(isAllowedCardApiPath(["v1", "estimatesx"]), false);
  });

  it("builds upstream URLs from path segments", () => {
    const url = buildUpstreamUrl(
      { cardApiOrigin: "http://localhost:3001", serviceToken: null },
      ["v1", "cards"],
      "?page[limit]=20",
    );

    assert.equal(url.origin, "http://localhost:3001");
    assert.equal(url.pathname, "/v1/cards");
    assert.equal(url.searchParams.get("page[limit]"), "20");
  });

  it("recognizes immutable asset routes", () => {
    assert.equal(isAssetPath(["v1", "assets", "a".repeat(64)]), true);
    assert.equal(isAssetPath(["v1", "cards", "search"]), false);
  });

  it("caches catalog JSON on the CDN only, never in the browser", () => {
    const searchHeaders = new Headers({
      "cache-control": "public, max-age=300",
    });
    applyBffCachePolicy(["v1", "cards", "search"], searchHeaders);
    assert.equal(searchHeaders.get("cache-control"), "no-cache");
    assert.equal(searchHeaders.get("vercel-cdn-cache-control"), BFF_CDN_CACHE_CONTROL);
    assert.equal(isCdnCacheable(searchHeaders), true);

    const printingsHeaders = new Headers();
    applyBffCachePolicy(["v1", "cards", "card-id", "printings"], printingsHeaders, 200);
    assert.equal(printingsHeaders.get("cache-control"), "no-cache");
    assert.equal(isCdnCacheable(printingsHeaders), true);

    const assetHeaders = new Headers({
      "cache-control": "public, max-age=31536000, immutable",
    });
    applyBffCachePolicy(["v1", "assets", "a".repeat(64)], assetHeaders);
    assert.match(assetHeaders.get("cache-control") ?? "", /immutable/);
    assert.equal(isCdnCacheable(assetHeaders), false);
  });

  it("never caches probes, errors or 304s on the CDN", () => {
    for (const path of [
      ["v1", "health"],
      ["v1", "data-version"],
    ]) {
      const headers = new Headers();
      applyBffCachePolicy(path, headers);
      assert.equal(headers.get("cache-control"), "no-store");
      assert.equal(isCdnCacheable(headers), false);
    }

    const errorHeaders = new Headers();
    applyBffCachePolicy(["v1", "cards"], errorHeaders, 500);
    assert.equal(errorHeaders.get("cache-control"), "no-store");
    assert.equal(isCdnCacheable(errorHeaders), false);

    const notModified = new Headers();
    applyBffCachePolicy(["v1", "cards"], notModified, 304);
    assert.equal(notModified.get("cache-control"), "no-cache");
    assert.equal(isCdnCacheable(notModified), false);
  });

  it("forwards safe response headers and injects the service token", async () => {
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = async (_input, init) => {
      capturedHeaders = init?.headers as Headers;
      return new Response(JSON.stringify({ status: "ok", requestId: "req-1" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          etag: '"v1"',
          "x-data-version": "v1",
        },
      });
    };

    try {
      const response = await proxyCardApiRequest(
        { cardApiOrigin: "http://localhost:3001", serviceToken: "server-only-token" },
        {
          method: "GET",
          pathSegments: ["v1", "health"],
          search: "",
          requestId: "bff-req-1",
        },
      );

      assert.equal(response.status, 200);
      assert.equal(response.headers.get("etag"), '"v1"');
      assert.equal(capturedHeaders?.get("X-API-Key"), "server-only-token");
      assert.equal(capturedHeaders?.get("X-Request-Id"), "bff-req-1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("rejects disallowed routes before calling upstream", async () => {
    await assert.rejects(
      () =>
        proxyCardApiRequest(
          { cardApiOrigin: "http://localhost:3001", serviceToken: null },
          {
            method: "GET",
            pathSegments: ["v1", "admin", "publish"],
            search: "",
          },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ProxyRequestError);
        assert.equal(error.status, 404);
        return true;
      },
    );
  });
});

describe("card-web secret boundary", () => {
  const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  function walkSourceFiles(directory: string): string[] {
    const entries = readdirSync(directory);
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        files.push(...walkSourceFiles(fullPath));
        continue;
      }

      if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  it("does not expose the service token through public client modules", () => {
    const publicSources = [
      join(appRoot, "app", "page.tsx"),
      join(appRoot, "app", "browse", "page.tsx"),
      join(appRoot, "app", "search", "page.tsx"),
      join(appRoot, "components", "CatalogStatus.tsx"),
      join(appRoot, "components", "BrowseExplorer.tsx"),
      join(appRoot, "components", "SetsExplorer.tsx"),
      join(appRoot, "lib", "card-client.browser.ts"),
    ];

    for (const file of publicSources) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /CARD_API_SERVICE_TOKEN/);
      assert.doesNotMatch(source, /server-config/);
      assert.doesNotMatch(source, /card-api-proxy/);
    }
  });

  it("does not import database packages", () => {
    const forbidden = ["@enigmic/db", "packages/db"];
    const files = walkSourceFiles(appRoot).filter(
      (file) => !file.includes(`${join(appRoot, "test")}`),
    );

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, new RegExp(pattern.replace("/", "\\/")));
      }
    }
  });
});
