import {
  defaultCardSearchState,
  parseSearchParams,
  serializeSearchUrl,
  type CardSearchState,
} from "@enigmic-co/card-search-core";

export const BROWSE_PATH = "/browse";

export function toUrlSearchParams(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    params.set(key, value);
  }

  return params;
}

export function parseSearchStateFromParams(
  params: URLSearchParams | { toString(): string },
): CardSearchState {
  return parseSearchParams(new URLSearchParams(params.toString()));
}

export function hrefForSearchState(state: CardSearchState): string {
  return serializeSearchUrl(BROWSE_PATH, state);
}

export function hrefForSetFilter(setCode: string): string {
  return hrefForSearchState({
    ...defaultCardSearchState(),
    sets: [setCode.trim().toUpperCase()],
  });
}
