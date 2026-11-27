"use client";

import { CardResultList } from "@enigmic-co/card-react";
import type { CardApiCard } from "@enigmic-co/card-api-contracts";

// card-react's CardResultList reads the toolkit context but isn't marked as a
// client component, so server pages render it through this wrapper.
export function CardGrid({ cards }: { cards: CardApiCard[] }) {
  return <CardResultList cards={cards} />;
}
