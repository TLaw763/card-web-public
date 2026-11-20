import {
  parseDetailRulesParams,
  serializeDetailRulesUrl,
  type CardDetailRulesState,
} from "@enigmic-co/card-search-core";

/** What a card URL is built from. `shortId` comes from card-api (D-067). */
export interface CardPathTarget {
  id: string;
  name?: string;
  shortId?: string;
}

const SLUG_MAX_LENGTH = 80;

/**
 * URL slug from a card name: lowercase ASCII words joined by hyphens
 * ("Blue-Eyes White Dragon" → "blue-eyes-white-dragon"). Accents are dropped,
 * other symbols become separators. May be empty (a name of symbols only).
 */
export function cardSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Canonical path of a card page (D-067): `/cards/<shortId>/<slug>`. Only the
 * id is looked up; the slug is for people and search engines. Falls back to
 * `/cards/<uuid>` when card-api sent no short id.
 */
export function cardDetailPath(card: CardPathTarget | string): string {
  if (typeof card === "string") {
    return `/cards/${card}`;
  }
  if (!card.shortId) {
    return `/cards/${card.id}`;
  }
  const slug = card.name ? cardSlug(card.name) : "";
  return slug ? `/cards/${card.shortId}/${slug}` : `/cards/${card.shortId}`;
}

/** The path a request asked for, from the route params, to compare with the canonical one. */
export function requestedCardPath(cardId: string, slug: string[] | undefined): string {
  return slug && slug.length > 0
    ? `/cards/${cardId}/${slug.join("/")}`
    : `/cards/${cardId}`;
}

/** Query string to carry over on a redirect (the rules picker state lives there). */
export function searchParamsSuffix(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const entry of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value]) {
      params.append(key, entry);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function parseDetailRulesFromParams(
  params: URLSearchParams | { toString(): string },
): CardDetailRulesState {
  return parseDetailRulesParams(new URLSearchParams(params.toString()));
}

export function hrefForDetailRulesState(
  card: CardPathTarget | string,
  state: CardDetailRulesState,
): string {
  return serializeDetailRulesUrl(cardDetailPath(card), state);
}
