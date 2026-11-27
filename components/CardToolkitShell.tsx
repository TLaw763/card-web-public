"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { CardToolkitProvider } from "@enigmic-co/card-react";
import { createBrowserCardClient } from "@/lib/card-client.browser";
import { cardIconUrl } from "@/lib/card-icons";
import { cardDetailPath } from "@/lib/detail-url";
import { resolveCardImageUrl } from "@/lib/card-image";
import { hrefForSetFilter } from "@/lib/search-url";

const cardClient = createBrowserCardClient();

export function CardToolkitShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  // Card links navigate in a transition, so a slow server render shows the
  // progress bar instead of looking like an ignored click. (Card pages have
  // no loading.tsx: streaming would turn their 404/500 into 200.)
  const [navigating, startNavigation] = useTransition();

  return (
    <CardToolkitProvider
      client={cardClient}
      navigation={{
        hrefForCard: (cardId, card) => cardDetailPath(card ?? cardId),
        hrefForSetSearch: hrefForSetFilter,
        navigate: (href) => startNavigation(() => router.push(href)),
        replace: (href) => startNavigation(() => router.replace(href)),
      }}
      image={{
        resolveAssetUrl: (url) => resolveCardImageUrl(url),
        iconUrl: cardIconUrl,
      }}
      // ZAR price estimates per printing on card pages (D-061). Reads
      // "No estimate yet" until estimates exist.
      features={{ prices: true }}
    >
      {navigating ? <NavigationProgress /> : null}
      <div className="enigmic-card-root">{children}</div>
    </CardToolkitProvider>
  );
}

function NavigationProgress() {
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      <span className="sr-only">Loading…</span>
      <div className="h-full w-1/3 animate-[navigation-progress_1.2s_ease-in-out_infinite] bg-foreground motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-60" />
    </div>
  );
}
