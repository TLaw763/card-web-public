import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadCardWebEnv } from "../lib/env.js";

describe("card-web env", () => {
  it("defaults to a local card-api with no key and rate limiting on", () => {
    assert.deepEqual(loadCardWebEnv({}), {
      cardApiOrigin: "http://localhost:3001",
      serviceToken: null,
      bffRateLimitEnabled: true,
      bffRateLimitPerMinute: 120,
      contactEmail: null,
    });
  });

  it("reads the deployed values", () => {
    const env = loadCardWebEnv({
      PUBLIC_CARD_API_ORIGIN: "https://api-dev.enigmic.co.za",
      CARD_API_SERVICE_TOKEN: "card-web-test-key",
      CARD_WEB_BFF_RATE_LIMIT_ENABLED: "false",
      CARD_WEB_BFF_RATE_LIMIT_PER_MINUTE: "60",
      CARD_WEB_CONTACT_EMAIL: "cards@example.org",
    });
    assert.equal(env.cardApiOrigin, "https://api-dev.enigmic.co.za");
    assert.equal(env.serviceToken, "card-web-test-key");
    assert.equal(env.bffRateLimitEnabled, false);
    assert.equal(env.bffRateLimitPerMinute, 60);
    assert.equal(env.contactEmail, "cards@example.org");
  });

  it("uses CARD_API_PORT for the local origin and treats blanks as unset", () => {
    const env = loadCardWebEnv({
      PUBLIC_CARD_API_ORIGIN: " ",
      CARD_API_PORT: "4100",
      CARD_API_SERVICE_TOKEN: "",
    });
    assert.equal(env.cardApiOrigin, "http://localhost:4100");
    assert.equal(env.serviceToken, null);
  });

  it("rejects invalid values", () => {
    assert.throws(() => loadCardWebEnv({ PUBLIC_CARD_API_ORIGIN: "not a url" }), /URL/);
    assert.throws(
      () => loadCardWebEnv({ CARD_API_SERVICE_TOKEN: "short" }),
      /8 characters/,
    );
    assert.throws(
      () => loadCardWebEnv({ CARD_WEB_BFF_RATE_LIMIT_ENABLED: "yes" }),
      /true, false/,
    );
    assert.throws(
      () => loadCardWebEnv({ CARD_WEB_BFF_RATE_LIMIT_PER_MINUTE: "0" }),
      /positive integer/,
    );
    assert.throws(
      () => loadCardWebEnv({ CARD_WEB_CONTACT_EMAIL: "not an email" }),
      /email address/,
    );
  });
});
