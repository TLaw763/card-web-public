"use client";

import {
  CardSearchBox,
  useCardSearchAutocomplete,
  useCardToolkit,
} from "@enigmic-co/card-react";
import { defaultCardSearchState } from "@enigmic-co/card-search-core";
import { useMemo, useState } from "react";
import { hrefForSearchState } from "@/lib/search-url";

/** The home page search: suggestions open a card, submit searches /browse. */
export function HomeSearch() {
  const { navigation } = useCardToolkit();
  const [query, setQuery] = useState("");
  const filterState = useMemo(() => defaultCardSearchState(), []);
  const autocomplete = useCardSearchAutocomplete({ query, filterState });

  return (
    <CardSearchBox
      value={query}
      onChange={setQuery}
      onSubmit={() => {
        const q = query.trim();
        navigation.navigate(hrefForSearchState({ ...defaultCardSearchState(), q }));
      }}
      label="Search cards"
      placeholder="Card name or text, e.g. Dark Magician"
      submitLabel="Search"
      suggestions={autocomplete.suggestions}
      suggestionsStatus={autocomplete.status}
      activeSuggestionId={autocomplete.activeSuggestionId}
      onSuggestionHighlight={autocomplete.setActiveSuggestionId}
      onSuggestionSelect={(suggestion) =>
        navigation.navigate(navigation.hrefForCard(suggestion.id))
      }
      onSuggestionsClose={autocomplete.clearSuggestions}
      onClear={() => setQuery("")}
    />
  );
}
