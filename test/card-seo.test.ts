import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CardApiArtwork, CardApiCard } from "@enigmic-co/card-api-contracts";
import {
  cardDescription,
  cardJsonLd,
  cardPreviewImage,
  cardSummaryLine,
  serializeJsonLd,
  siteUrl,
} from "../lib/card-seo";
import { isCardId } from "../lib/catalog.server";

const darkMagician: CardApiCard = {
  id: "6dc69440-2aa5-4fac-ae38-3a7162ce54fc",
  name: "Dark Magician",
  locale: "en",
  status: "verified",
  cardType: "monster",
  rulesText: "The ultimate wizard in terms of attack and defense.",
  attribute: "DARK",
  race: "SPELLCASTER",
  level: 7,
  atk: 2500,
  def: 2100,
  archetypeIds: [],
  updatedAt: "2026-10-11T12:00:00.000Z",
  source: { authority: "konami", verifiedAt: "2026-10-11T12:00:00.000Z" },
};

const hash = "a".repeat(64);

function artwork(overrides: Partial<CardApiArtwork> = {}): CardApiArtwork {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    cardId: darkMagician.id,
    ordinal: 1,
    status: "available",
    assets: [
      {
        kind: "full",
        url: `https://api-dev.enigmic.co.za/v1/assets/${hash}`,
        width: 421,
        height: 614,
        contentHash: hash,
      },
    ],
    updatedAt: "2026-10-11T12:00:00.000Z",
    ...overrides,
  };
}

describe("card SEO helpers", () => {
  it("summarises a monster's type and stats", () => {
    assert.equal(
      cardSummaryLine(darkMagician),
      "Monster · DARK · Spellcaster · Level 7 · ATK 2500 / DEF 2100",
    );
  });

  it("builds a description and caps it at 160 characters", () => {
    assert.equal(
      cardDescription(darkMagician),
      "Monster · DARK · Spellcaster · Level 7 · ATK 2500 / DEF 2100. The ultimate wizard in terms of attack and defense.",
    );

    const long = cardDescription({ ...darkMagician, rulesText: "word ".repeat(100) });
    assert.equal(long.length, 160);
    assert.ok(long.endsWith("…"));
  });

  it("drops Konami line breaks from the description", () => {
    const description = cardDescription({
      ...darkMagician,
      rulesText: "Activate 1 of these effects;<br>●Add 1 card.\n●Toss a coin.",
    });
    assert.ok(
      description.endsWith("Activate 1 of these effects; ●Add 1 card. ●Toss a coin."),
    );
  });

  it("uses our mirrored copy for preview images", () => {
    assert.deepEqual(cardPreviewImage([artwork()], "https://cards.example"), {
      url: `https://cards.example/api/cards/v1/assets/${hash}`,
      width: 421,
      height: 614,
    });
  });

  it("uses the image host's URL directly when the API gives one", () => {
    const hosted = artwork({
      assets: [
        {
          kind: "full",
          url: `https://images.enigmic.co.za/v1/assets/${hash}`,
          width: 421,
          height: 614,
          contentHash: hash,
        },
      ],
    });
    assert.equal(
      cardPreviewImage([hosted], "https://cards.example")?.url,
      `https://images.enigmic.co.za/v1/assets/${hash}`,
    );
  });

  it("leaves out images that are not stored yet", () => {
    const unstored = artwork({
      assets: [
        {
          kind: "full",
          url: "https://images.enigmic.co.za/v1/assets/by-id/0d0f6a52-6b0f-4b7c-9a44-0d3b5f2d9c11",
          width: 421,
          height: 614,
          contentHash: "",
        },
      ],
    });
    assert.equal(cardPreviewImage([unstored], "https://cards.example"), null);
  });

  it("never hotlinks source images or shows suppressed art", () => {
    const remote = artwork({
      assets: [
        {
          kind: "full",
          url: "https://images.ygoprodeck.com/images/cards/46986414.jpg",
          width: 421,
          height: 614,
          contentHash: hash,
        },
      ],
    });
    assert.equal(cardPreviewImage([remote], "https://cards.example"), null);
    assert.equal(
      cardPreviewImage([artwork({ status: "suppressed" })], "https://cards.example"),
      null,
    );
    assert.equal(cardPreviewImage(undefined, "https://cards.example"), null);
  });

  it("reads the site URL from the environment", () => {
    assert.equal(siteUrl({}), "https://cards.enigmic.co.za");
    assert.equal(
      siteUrl({ CARD_WEB_SITE_URL: "http://localhost:3000/" }),
      "http://localhost:3000",
    );
  });

  it("builds schema.org data for a card page", () => {
    const [work = {}, breadcrumbs = {}] = cardJsonLd(
      { ...darkMagician, passcode: "46986414" },
      undefined,
      "https://cards.example",
    );
    assert.equal(work["@type"], "CreativeWork");
    assert.equal(work.url, `https://cards.example/cards/${darkMagician.id}`);
    assert.equal(work.name, "Dark Magician");
    assert.equal(work.identifier, "46986414");
    assert.equal("image" in work, false);
    assert.equal(breadcrumbs["@type"], "BreadcrumbList");
  });

  it("uses the short card URL in schema.org data when there is a short id", () => {
    const [work = {}] = cardJsonLd(
      { ...darkMagician, shortId: "dm7k2p" },
      undefined,
      "https://cards.example",
    );
    assert.equal(work.url, "https://cards.example/cards/dm7k2p/dark-magician");
  });

  it("escapes < so card text can't close the script element", () => {
    const json = serializeJsonLd({ text: "</script><script>alert(1)</script>" });
    assert.doesNotMatch(json, /<\/script>/i);
    assert.deepEqual(JSON.parse(json), { text: "</script><script>alert(1)</script>" });
  });

  it("accepts only uuid card ids", () => {
    assert.ok(isCardId(darkMagician.id));
    assert.ok(!isCardId("dark-magician"));
    assert.ok(!isCardId("../v1/health"));
  });
});
