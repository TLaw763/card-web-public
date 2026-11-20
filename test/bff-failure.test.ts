import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ProxyRequestError, proxyCardApiRequest } from "../lib/card-api-proxy.js";

const proxyConfig = {
  cardApiOrigin: "http://localhost:3001",
  serviceToken: null,
};

describe("bff failure modes", () => {
  it("maps upstream aborts to 504 gateway timeouts", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      throw new DOMException("The operation was aborted.", "AbortError");
    };

    try {
      await assert.rejects(
        () =>
          proxyCardApiRequest(proxyConfig, {
            method: "GET",
            pathSegments: ["v1", "health"],
            search: "",
          }),
        (error: unknown) => {
          assert.ok(error instanceof ProxyRequestError);
          assert.equal(error.status, 504);
          assert.equal(error.code, "unavailable");
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("maps upstream network failures to 503 unavailable", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };

    try {
      await assert.rejects(
        () =>
          proxyCardApiRequest(proxyConfig, {
            method: "GET",
            pathSegments: ["v1", "health"],
            search: "",
          }),
        (error: unknown) => {
          assert.ok(error instanceof ProxyRequestError);
          assert.equal(error.status, 503);
          return true;
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("coalesces concurrent identical upstream requests", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCount = 0;

    globalThis.fetch = async () => {
      fetchCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 25));
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const [first, second] = await Promise.all([
        proxyCardApiRequest(proxyConfig, {
          method: "GET",
          pathSegments: ["v1", "health"],
          search: "",
        }),
        proxyCardApiRequest(proxyConfig, {
          method: "GET",
          pathSegments: ["v1", "health"],
          search: "",
        }),
      ]);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(fetchCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
