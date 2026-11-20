import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isImageHostUrl,
  resolveCardImageUrl,
  rewriteAssetUrlForBff,
} from "../lib/card-image.js";

const hash = "a".repeat(64);
const id = "0d0f6a52-6b0f-4b7c-9a44-0d3b5f2d9c11";
const imageOrigin = "https://images.example";

describe("card-web card image", () => {
  it("loads image-host URLs directly", () => {
    const stored = `${imageOrigin}/v1/assets/${hash}`;
    const unstored = `${imageOrigin}/v1/assets/by-id/${id}`;
    assert.equal(resolveCardImageUrl(stored, { imageOrigin }), stored);
    assert.equal(resolveCardImageUrl(unstored, { imageOrigin }), unstored);
  });

  it("sends card-api URLs on another origin through the BFF", () => {
    assert.equal(
      resolveCardImageUrl(`http://localhost:3001/v1/assets/${hash}`, { imageOrigin }),
      `/api/cards/v1/assets/${hash}`,
    );
    assert.equal(
      resolveCardImageUrl(`https://api-dev.example/v1/assets/by-id/${id}`, {
        imageOrigin,
      }),
      `/api/cards/v1/assets/by-id/${id}`,
    );
  });

  it("does not treat look-alike paths on the image host as images", () => {
    assert.equal(isImageHostUrl(`${imageOrigin}/v1/cards`, imageOrigin), false);
    assert.equal(
      isImageHostUrl(`${imageOrigin}/v1/assets/${hash}?x=1`, imageOrigin),
      false,
    );
    assert.equal(
      isImageHostUrl(`${imageOrigin}.evil.test/v1/assets/${hash}`, imageOrigin),
      false,
    );
  });

  it("leaves BFF and foreign URLs alone", () => {
    assert.equal(
      resolveCardImageUrl(`/api/cards/v1/assets/${hash}`, { imageOrigin }),
      `/api/cards/v1/assets/${hash}`,
    );
    const foreign = "https://images.ygoprodeck.com/images/cards/89631139.jpg";
    assert.equal(resolveCardImageUrl(foreign, { imageOrigin }), foreign);
  });

  it("keeps the old helper working", () => {
    assert.equal(
      rewriteAssetUrlForBff(`http://localhost:3001/v1/assets/${hash}`),
      `/api/cards/v1/assets/${hash}`,
    );
  });
});
