"use client";

import {
  CardExplorer,
  useCardToolkit,
  type CardExplorerInitialData,
} from "@enigmic-co/card-react";
import { type CardSearchState } from "@enigmic-co/card-search-core";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  BROWSE_PATH,
  hrefForSearchState,
  parseSearchStateFromParams,
} from "@/lib/search-url";

interface BrowseExplorerProps {
  /** First page loaded on the server so the results are in the page HTML. */
  initialData?: CardExplorerInitialData;
}

// No Suspense boundary: /browse renders per request, so useSearchParams is
// available on the server and the results go straight into the HTML.
export function BrowseExplorer({ initialData }: BrowseExplorerProps) {
  const searchParams = useSearchParams();
  const { navigation } = useCardToolkit();

  const state = useMemo(() => parseSearchStateFromParams(searchParams), [searchParams]);

  const onStateChange = useCallback(
    (next: CardSearchState) => {
      const href = hrefForSearchState(next);
      if (navigation.replace) {
        navigation.replace(href);
        return;
      }

      navigation.navigate(href);
    },
    [navigation],
  );

  return (
    <CardExplorer
      state={state}
      onStateChange={onStateChange}
      searchPath={BROWSE_PATH}
      defaultBrowse
      browseLayout
      infiniteScroll
      initialData={initialData}
    />
  );
}
