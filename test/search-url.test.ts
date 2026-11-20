import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultCardSearchState,
  parseSearchUrl,
  withCommittedQuery,
} from "@enigmic-co/card-search-core";
import {
  BROWSE_PATH,
  hrefForSearchState,
  hrefForSetFilter,
  parseSearchStateFromParams,
  toUrlSearchParams,
} from "../lib/search-url.js";

describe("card-web search url", () => {
  it("builds canonical /browse links from committed state", () => {
    const state = withCommittedQuery(defaultCardSearchState(), "blue eyes");
    assert.equal(hrefForSearchState(state), `${BROWSE_PATH}?q=blue+eyes`);
  });

  it("parses Next.js searchParams records into card search state", () => {
    const state = parseSearchStateFromParams(
      toUrlSearchParams({
        q: "dark magician",
        type: ["monster"],
        limit: "40",
      }),
    );

    assert.equal(state.q, "dark magician");
    assert.deepEqual(state.types, ["monster"]);
    assert.equal(state.limit, 40);
  });

  it("round-trips through the shared serializer for deep links", () => {
    const state = withCommittedQuery(defaultCardSearchState(), "blue eyes");
    const href = hrefForSearchState({
      ...state,
      types: ["monster"],
      limit: 40,
    });

    const parsed = parseSearchUrl(`https://cards.example.test${href}`);
    assert.equal(parsed.q, "blue eyes");
    assert.deepEqual(parsed.types, ["monster"]);
    assert.equal(parsed.limit, 40);
  });

  it("builds set-filter browse links from set codes", () => {
    assert.equal(hrefForSetFilter("sdwd-en002"), `${BROWSE_PATH}?set=SDWD-EN002`);
  });
});
