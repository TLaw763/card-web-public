import { cache } from "react";
import type {
  CardExplorerInitialData,
  SetBrowseInitialData,
} from "@enigmic-co/card-react";
import { CardApi, isCardApiError } from "@enigmic-co/card-sdk";
import {
  hasSearchableState,
  mapSearchStateToSdkParams,
  normalizeCardSearchState,
  type CardSearchState,
} from "@enigmic-co/card-search-core";
import type {
  CardApiArtwork,
  CardApiCard,
  CardApiPrinting,
  CardApiSet,
  CardApiSetCategory,
} from "@enigmic-co/card-api-contracts";
import { loadCardWebEnv } from "./env";

/**
 * Server-side catalog reads for rendered pages. Responses go into Next's data
 * cache under one tag: `POST /api/revalidate` drops it after a catalog publish,
 * and the time limit is the fallback if that call never comes.
 */
export const CATALOG_CACHE_TAG = "catalog";
export const CATALOG_REVALIDATE_SECONDS = 3600;

const CARD_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Short public card id (D-067); same shape as card-api-contracts `CardShortId`. */
const CARD_SHORT_ID_PATTERN = /^[a-hjkmnp-tv-z][0-9a-hjkmnp-tv-z]{5}$/;
const PAGE_LIMIT = 100;
const MAX_PRINTING_PAGES = 10;

/** A card page id: the uuid (old links) or the short id (D-067). */
export function isCardId(value: string): boolean {
  return CARD_UUID_PATTERN.test(value) || CARD_SHORT_ID_PATTERN.test(value);
}

const SITEMAP_REVALIDATE_SECONDS = 86400;

/** card-sdk asks for `no-store`; pages want the data cache instead. */
function cachedFetch(revalidate: number): typeof fetch {
  return (input, init) => {
    const { cache: _noStore, ...rest } = init ?? {};
    return fetch(input, {
      ...rest,
      next: { revalidate, tags: [CATALOG_CACHE_TAG] },
    });
  };
}

function createCachedServerClient(revalidate = CATALOG_REVALIDATE_SECONDS): CardApi {
  const env = loadCardWebEnv();
  return new CardApi({
    baseUrl: env.cardApiOrigin,
    apiKey: env.serviceToken ?? undefined,
    fetch: cachedFetch(revalidate),
  });
}

export interface CardPageData {
  card: CardApiCard;
  /** Missing when the request failed; the page then loads them in the browser. */
  artworks?: CardApiArtwork[];
  printings?: CardApiPrinting[];
}

/**
 * Everything the card page renders on the server. `null` means no such card.
 * Wrapped in `cache` so metadata and the page share one set of requests.
 */
export const loadCardPageData = cache(
  async (cardId: string): Promise<CardPageData | null> => {
    if (!isCardId(cardId)) {
      return null;
    }

    const client = createCachedServerClient();
    let card: CardApiCard;
    try {
      const response = await client.getCard(cardId);
      if (!response.document) {
        return null;
      }
      card = response.document.data;
    } catch (error) {
      if (isCardApiError(error) && error.status === 404) {
        return null;
      }
      throw error;
    }

    // By uuid: the page may have been asked for by short id.
    const [artworks, printings] = await Promise.allSettled([
      client.listCardArtworks(card.id, { limit: PAGE_LIMIT }),
      loadPrintings(client, card.id),
    ]);

    return {
      card,
      artworks: artworks.status === "fulfilled" ? artworks.value.data : undefined,
      printings: printings.status === "fulfilled" ? printings.value : undefined,
    };
  },
);

async function loadPrintings(
  client: CardApi,
  cardId: string,
): Promise<CardApiPrinting[] | undefined> {
  const printings: CardApiPrinting[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PRINTING_PAGES; page += 1) {
    const response = await client.listCardPrintings(cardId, {
      limit: PAGE_LIMIT,
      after,
    });
    printings.push(...response.data);

    const next = response.meta.page?.nextCursor;
    if (!response.meta.page?.hasMore || !next) {
      return printings;
    }
    after = next;
  }

  // Unusually many printings: let the browser load the full list.
  return undefined;
}

/**
 * First page of /browse for `state`, fetched the way `useCardExplorer` does
 * (search when there's a query or filter, otherwise the latest cards), so the
 * client can use it as is. `undefined` on failure: the browser then loads it.
 */
export async function loadBrowseFirstPage(
  state: CardSearchState,
): Promise<CardExplorerInitialData | undefined> {
  const client = createCachedServerClient();
  const active = normalizeCardSearchState(state);
  try {
    const response = hasSearchableState(active)
      ? await client.searchCards(mapSearchStateToSdkParams(active))
      : await client.listCards({
          limit: active.limit,
          after: active.cursor ?? undefined,
        });
    return {
      state,
      cards: response.data,
      hasMore: response.meta.page?.hasMore ?? false,
      nextCursor: response.meta.page?.nextCursor ?? null,
    };
  } catch (error) {
    console.warn("browse first page failed; the browser will load it", error);
    return undefined;
  }
}

/** Page size `useSetBrowse` asks for; the first page must match it. */
const SET_PAGE_LIMIT = 40;

/** First page of /sets, fetched the way `useSetBrowse` does. */
export async function loadSetsFirstPage(
  query: string,
  category: CardApiSetCategory | null,
): Promise<SetBrowseInitialData | undefined> {
  const client = createCachedServerClient();
  try {
    const response = await client.listSets({
      limit: SET_PAGE_LIMIT,
      q: query || undefined,
      category: category ?? undefined,
    });
    return {
      query,
      category,
      sets: response.data,
      hasMore: response.meta.page?.hasMore ?? false,
      nextCursor: response.meta.page?.nextCursor ?? null,
    };
  } catch (error) {
    console.warn("sets first page failed; the browser will load it", error);
    return undefined;
  }
}

export interface SitemapCard {
  id: string;
  name: string;
  shortId?: string;
  updatedAt: string;
}

/** Every card id for the sitemap (~90 requests for the full catalog). */
export async function listAllCardsForSitemap(): Promise<SitemapCard[]> {
  const client = createCachedServerClient(SITEMAP_REVALIDATE_SECONDS);
  const cards: SitemapCard[] = [];
  let after: string | undefined;

  while (true) {
    const page = await client.listCardsPage({ limit: PAGE_LIMIT, after });
    for (const card of page.items) {
      cards.push({
        id: card.id,
        name: card.name,
        shortId: card.shortId,
        updatedAt: card.updatedAt,
      });
    }
    if (!page.hasMore || !page.nextCursor) {
      return cards;
    }
    after = page.nextCursor;
  }
}

const HOME_SET_COUNT = 6;
const HOME_CARD_COUNT = 12;

export interface HomePageData {
  /** Newest first (card-api orders sets by release date). */
  newestSets?: CardApiSet[];
  /** Newest printings first (card-api's default card order). */
  newestCards?: CardApiCard[];
}

/** Home page lists; a failed list is left out and the page renders without it. */
export async function loadHomePageData(): Promise<HomePageData> {
  const client = createCachedServerClient();
  const [sets, cards] = await Promise.allSettled([
    client.listSets({ limit: HOME_SET_COUNT }),
    client.listCards({ limit: HOME_CARD_COUNT }),
  ]);
  return {
    newestSets: sets.status === "fulfilled" ? sets.value.data : undefined,
    newestCards: cards.status === "fulfilled" ? cards.value.data : undefined,
  };
}
