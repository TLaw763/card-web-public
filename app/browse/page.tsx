import type { Metadata } from "next";
import { hasSearchableState } from "@enigmic-co/card-search-core";
import { BrowseExplorer } from "@/components/BrowseExplorer";
import { loadBrowseFirstPage } from "@/lib/catalog.server";
import {
  BROWSE_PATH,
  parseSearchStateFromParams,
  toUrlSearchParams,
} from "@/lib/search-url";

interface BrowsePageProps {
  // Read so the page renders per request with the first page of results in
  // its HTML. Catalog data still comes from the data cache.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
  searchParams,
}: BrowsePageProps): Promise<Metadata> {
  const state = parseSearchStateFromParams(toUrlSearchParams(await searchParams));
  return {
    title: "Browse cards",
    description: "Browse and filter the Yu-Gi-Oh card catalog",
    alternates: { canonical: BROWSE_PATH },
    // Searches and filter combinations are endless near-duplicates of /browse.
    robots: hasSearchableState(state) ? { index: false, follow: true } : undefined,
  };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const state = parseSearchStateFromParams(toUrlSearchParams(await searchParams));
  const initialData = await loadBrowseFirstPage(state);

  return (
    <div className="space-y-0">
      <div className="mb-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Enigmic
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Browse cards</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and search the catalog with filters. Share or bookmark any view from the
          URL bar.
        </p>
      </div>
      <BrowseExplorer initialData={initialData} />
    </div>
  );
}
