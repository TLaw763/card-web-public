import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { cardIconUrl } from "../lib/card-icons.js";

describe("cardIconUrl", () => {
  it("maps card-api values to icon files", () => {
    assert.equal(
      cardIconUrl({ kind: "attribute", value: "DARK" }),
      "/icons/attribute/dark.svg",
    );
    assert.equal(
      cardIconUrl({ kind: "race", value: "WINGED_BEAST" }),
      "/icons/race/winged-beast.png",
    );
    assert.equal(
      cardIconUrl({ kind: "race", value: "BEAST_WARRIOR" }),
      "/icons/race/beast-warrior.png",
    );
    assert.equal(
      cardIconUrl({ kind: "cardType", value: "trap" }),
      "/icons/attribute/trap.svg",
    );
    assert.equal(
      cardIconUrl({ kind: "spellTrap", value: "Quick Play Spell" }),
      "/icons/spell-trap/quick-play.png",
    );
    assert.equal(
      cardIconUrl({ kind: "spellTrap", value: "Continuous Trap" }),
      "/icons/spell-trap/continuous.png",
    );
    assert.equal(cardIconUrl({ kind: "level", value: "4" }), "/icons/stat/level.svg");
    assert.equal(cardIconUrl({ kind: "rank", value: "4" }), "/icons/stat/rank.svg");
    assert.equal(
      cardIconUrl({ kind: "banStatus", value: "Semi-Limited" }),
      "/icons/ban/semi-limited.png",
    );
  });

  it("returns null for values without an icon", () => {
    assert.equal(cardIconUrl({ kind: "race", value: "CREATOR_GOD" }), null);
    assert.equal(cardIconUrl({ kind: "cardType", value: "monster" }), null);
    assert.equal(cardIconUrl({ kind: "banStatus", value: "Unlimited" }), null);
  });

  it("points at files that exist in public/", () => {
    const values: Parameters<typeof cardIconUrl>[0][] = [
      ..."DARK DIVINE EARTH FIRE LIGHT WATER WIND".split(" ").map((value) => ({
        kind: "attribute" as const,
        value,
      })),
      ...[
        "AQUA",
        "BEAST",
        "BEAST_WARRIOR",
        "CYBERSE",
        "DINOSAUR",
        "DIVINE_BEAST",
        "DRAGON",
        "FAIRY",
        "FIEND",
        "FISH",
        "ILLUSION",
        "INSECT",
        "MACHINE",
        "PLANT",
        "PSYCHIC",
        "PYRO",
        "REPTILE",
        "ROCK",
        "SEA_SERPENT",
        "SPELLCASTER",
        "THUNDER",
        "WARRIOR",
        "WINGED_BEAST",
        "WYRM",
        "ZOMBIE",
      ].map((value) => ({ kind: "race" as const, value })),
      ..."Normal Continuous Counter Equip Field Quick-Play Ritual"
        .split(" ")
        .map((value) => ({
          kind: "spellTrap" as const,
          value: `${value} Spell`,
        })),
      { kind: "cardType", value: "spell" },
      { kind: "cardType", value: "trap" },
      { kind: "level", value: "1" },
      { kind: "rank", value: "1" },
      { kind: "banStatus", value: "Forbidden" },
      { kind: "banStatus", value: "Limited" },
      { kind: "banStatus", value: "Semi-Limited" },
    ];

    for (const ref of values) {
      const url = cardIconUrl(ref);
      assert.ok(url, `${ref.kind} ${ref.value} has an icon`);
      assert.ok(existsSync(join("public", url)), `${url} exists`);
    }
  });
});
