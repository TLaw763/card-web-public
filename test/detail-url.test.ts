import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultCardDetailRulesState } from "@enigmic-co/card-search-core";
import { isCardId } from "../lib/catalog.server.js";
import {
  cardDetailPath,
  cardSlug,
  hrefForDetailRulesState,
  parseDetailRulesFromParams,
  requestedCardPath,
  searchParamsSuffix,
} from "../lib/detail-url.js";

const CARD_ID = "57a903ca-598e-49a4-bac4-ce3afa50d671";
const CARD = { id: CARD_ID, name: "Blue-Eyes White Dragon", shortId: "k7m2qp" };

describe("card detail URL helpers", () => {
  it("builds /cards/<shortId>/<slug> (D-067)", () => {
    assert.equal(cardDetailPath(CARD), "/cards/k7m2qp/blue-eyes-white-dragon");
  });

  it("falls back to the uuid when card-api sent no short id", () => {
    assert.equal(cardDetailPath(CARD_ID), `/cards/${CARD_ID}`);
    assert.equal(cardDetailPath({ id: CARD_ID, name: CARD.name }), `/cards/${CARD_ID}`);
  });

  it("leaves the slug out when the name has no letters or digits", () => {
    assert.equal(cardDetailPath({ ...CARD, name: "★☆" }), "/cards/k7m2qp");
  });

  it("makes readable ASCII slugs", () => {
    assert.equal(cardSlug("Blue-Eyes White Dragon"), "blue-eyes-white-dragon");
    assert.equal(cardSlug("Ō  Pokémon & Friends!"), "o-pokemon-friends");
    assert.equal(
      cardSlug("Elemental HERO Neos (Alternate Art)"),
      "elemental-hero-neos-alternate-art",
    );
    assert.equal(cardSlug("  --Number 39: Utopia--  "), "number-39-utopia");
    const long = cardSlug("word ".repeat(40));
    assert.ok(long.length <= 80 && !long.endsWith("-"));
  });

  it("compares the requested path with the canonical one", () => {
    assert.equal(
      requestedCardPath("k7m2qp", ["blue-eyes-white-dragon"]),
      cardDetailPath(CARD),
    );
    assert.notEqual(requestedCardPath("k7m2qp", undefined), cardDetailPath(CARD));
    assert.notEqual(requestedCardPath(CARD_ID, undefined), cardDetailPath(CARD));
    assert.notEqual(requestedCardPath("k7m2qp", ["old-name"]), cardDetailPath(CARD));
    assert.equal(requestedCardPath(CARD_ID, []), `/cards/${CARD_ID}`);
  });

  it("keeps the query string on a redirect", () => {
    assert.equal(searchParamsSuffix({}), "");
    assert.equal(
      searchParamsSuffix({
        effectiveDate: "2024-01-01",
        format: ["tcg", "ocg"],
        x: undefined,
      }),
      "?effectiveDate=2024-01-01&format=tcg&format=ocg",
    );
  });

  it("accepts uuid and short ids as card page ids, nothing else", () => {
    assert.ok(isCardId(CARD_ID));
    assert.ok(isCardId("k7m2qp"));
    assert.ok(!isCardId("K7M2QP"));
    assert.ok(!isCardId("4007"));
    assert.ok(!isCardId("kilouq"));
  });

  it("round-trips historical rules query params on the short URL", () => {
    const href = hrefForDetailRulesState(CARD, {
      ...defaultCardDetailRulesState(),
      effectiveDate: "2024-01-01",
    });

    assert.equal(href, "/cards/k7m2qp/blue-eyes-white-dragon?effectiveDate=2024-01-01");

    const parsed = parseDetailRulesFromParams(
      new URLSearchParams("effectiveDate=2024-01-01"),
    );
    assert.equal(parsed.effectiveDate, "2024-01-01");
  });
});
