import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  checkBffRateLimit,
  configureBffRateLimit,
  resetBffRateLimitForTests,
  resolveBffClientKey,
} from "../lib/bff-rate-limit.js";

afterEach(() => {
  resetBffRateLimitForTests();
});

describe("bff rate limit", () => {
  it("resolves the first forwarded client IP", () => {
    const request = new Request("http://localhost/api/cards/v1/health", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    assert.equal(resolveBffClientKey(request), "ip:203.0.113.10");
  });

  it("blocks after the configured per-minute limit", () => {
    configureBffRateLimit({ enabled: true, limitPerMinute: 2 });

    const first = checkBffRateLimit("ip:test");
    const second = checkBffRateLimit("ip:test");
    const third = checkBffRateLimit("ip:test");

    assert.equal(first?.allowed, true);
    assert.equal(second?.allowed, true);
    assert.equal(third?.allowed, false);
  });
});
