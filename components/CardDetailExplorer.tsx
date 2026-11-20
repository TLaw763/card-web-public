"use client";

import {
  CardDetailView,
  useCardToolkit,
  type CardDetailInitialData,
} from "@enigmic-co/card-react";
import type { CardDetailRulesState } from "@enigmic-co/card-search-core";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  hrefForDetailRulesState,
  parseDetailRulesFromParams,
  type CardPathTarget,
} from "@/lib/detail-url";

interface CardDetailExplorerProps {
  /** The card's uuid (card-react matches initialData on it). */
  cardId: string;
  /** Builds the page URL when the rules picker changes (short id + slug). */
  card?: CardPathTarget;
  /** Loaded on the server so the card is in the page HTML. */
  initialData?: CardDetailInitialData;
}

// No Suspense boundary: the card page renders per request, so useSearchParams
// is available on the server and the card goes straight into the HTML.
export function CardDetailExplorer({
  cardId,
  card,
  initialData,
}: CardDetailExplorerProps) {
  const searchParams = useSearchParams();
  const { navigation } = useCardToolkit();

  const rulesState = useMemo(
    () => parseDetailRulesFromParams(searchParams),
    [searchParams],
  );

  const onRulesStateChange = useCallback(
    (next: CardDetailRulesState) => {
      const href = hrefForDetailRulesState(card ?? cardId, next);
      if (navigation.replace) {
        navigation.replace(href);
        return;
      }

      navigation.navigate(href);
    },
    [card, cardId, navigation],
  );

  return (
    <CardDetailView
      cardId={cardId}
      rulesState={rulesState}
      onRulesStateChange={onRulesStateChange}
      initialData={initialData}
    />
  );
}
