import type { CardIconRef } from "@enigmic-co/card-react";

// Konami's game icons, served from public/icons/ (D-054: shown as fan content,
// covered by the footer's notice, removed on request). card-react shows them
// next to the text value, never instead of it.
const ICON_BASE = "/icons";

const ATTRIBUTES = new Set(["dark", "divine", "earth", "fire", "light", "water", "wind"]);

const RACES = new Set([
  "aqua",
  "beast",
  "beast-warrior",
  "cyberse",
  "dinosaur",
  "divine-beast",
  "dragon",
  "fairy",
  "fiend",
  "fish",
  "illusion",
  "insect",
  "machine",
  "plant",
  "psychic",
  "pyro",
  "reptile",
  "rock",
  "sea-serpent",
  "spellcaster",
  "thunder",
  "warrior",
  "winged-beast",
  "wyrm",
  "zombie",
]);

const SPELL_TRAP_PROPERTIES = new Set([
  "continuous",
  "counter",
  "equip",
  "field",
  "normal",
  "quick-play",
  "ritual",
]);

const BAN_STATUSES: Record<string, string> = {
  forbidden: "forbidden",
  banned: "forbidden",
  limited: "limited",
  "semi-limited": "semi-limited",
};

/** "WINGED_BEAST", "Quick Play Spell", "Semi-Limited" → "winged-beast", … */
function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

export function cardIconUrl({ kind, value }: CardIconRef): string | null {
  const key = slug(value);

  switch (kind) {
    case "attribute":
      return ATTRIBUTES.has(key) ? `${ICON_BASE}/attribute/${key}.svg` : null;
    case "race":
      return RACES.has(key) ? `${ICON_BASE}/race/${key}.png` : null;
    case "cardType":
      // Spell and Trap cards carry these in the attribute position.
      return key === "spell" || key === "trap"
        ? `${ICON_BASE}/attribute/${key}.svg`
        : null;
    case "spellTrap": {
      // card-api sends the subtype with the card type: "Quick Play Spell".
      const property = key.replace(/-(spell|trap)$/, "");
      return SPELL_TRAP_PROPERTIES.has(property)
        ? `${ICON_BASE}/spell-trap/${property}.png`
        : null;
    }
    case "level":
      return `${ICON_BASE}/stat/level.svg`;
    case "rank":
      return `${ICON_BASE}/stat/rank.svg`;
    case "banStatus": {
      const status = BAN_STATUSES[key];
      return status ? `${ICON_BASE}/ban/${status}.png` : null;
    }
    default:
      return null;
  }
}
