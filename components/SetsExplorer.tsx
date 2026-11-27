"use client";

import {
  SetBrowseView,
  parseSetBrowseCategory,
  useCardToolkit,
  type SetBrowseInitialData,
} from "@enigmic-co/card-react";
import type { CardApiSetCategory } from "@enigmic-co/card-api-contracts";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

const SETS_PATH = "/sets";

function hrefForSetsState(input: {
  query: string;
  category: CardApiSetCategory | null;
}): string {
  const params = new URLSearchParams();
  if (input.query) {
    params.set("q", input.query);
  }
  if (input.category) {
    params.set("category", input.category);
  }

  return params.toString() ? `${SETS_PATH}?${params.toString()}` : SETS_PATH;
}

interface SetsExplorerProps {
  /** First page loaded on the server so the sets are in the page HTML. */
  initialData?: SetBrowseInitialData;
}

// No Suspense boundary: /sets renders per request, so useSearchParams is
// available on the server and the sets go straight into the HTML.
export function SetsExplorer({ initialData }: SetsExplorerProps) {
  const searchParams = useSearchParams();
  const { navigation } = useCardToolkit();

  const query = useMemo(() => searchParams.get("q")?.trim() ?? "", [searchParams]);
  const category = useMemo(
    () => parseSetBrowseCategory(searchParams.get("category")),
    [searchParams],
  );

  const navigate = useCallback(
    (next: { query: string; category: CardApiSetCategory | null }) => {
      const href = hrefForSetsState(next);
      if (navigation.replace) {
        navigation.replace(href);
        return;
      }

      navigation.navigate(href);
    },
    [navigation],
  );

  const onQueryChange = useCallback(
    (nextQuery: string) => {
      navigate({ query: nextQuery, category });
    },
    [category, navigate],
  );

  const onCategoryChange = useCallback(
    (nextCategory: CardApiSetCategory | null) => {
      navigate({ query, category: nextCategory });
    },
    [navigate, query],
  );

  return (
    <SetBrowseView
      query={query}
      category={category}
      onQueryChange={onQueryChange}
      onCategoryChange={onCategoryChange}
      initialData={initialData}
    />
  );
}
