import Link from "next/link";
import type { Metadata } from "next";
import { CardApiSetCategory } from "@enigmic-co/card-api-contracts";
import { SetsExplorer } from "@/components/SetsExplorer";
import { loadSetsFirstPage } from "@/lib/catalog.server";
import { toUrlSearchParams } from "@/lib/search-url";

interface SetsPageProps {
  // Read so the page renders per request with the first page of sets in its
  // HTML. Catalog data still comes from the data cache.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseSetsQuery(input: Record<string, string | string[] | undefined>) {
  const params = toUrlSearchParams(input);
  return {
    query: params.get("q")?.trim() ?? "",
    // card-react's parseSetBrowseCategory is client-only; same check here.
    category: CardApiSetCategory.safeParse(params.get("category")).data ?? null,
  };
}

export async function generateMetadata({
  searchParams,
}: SetsPageProps): Promise<Metadata> {
  const { query, category } = parseSetsQuery(await searchParams);
  return {
    title: "Browse sets",
    description: "Browse Yu-Gi-Oh card sets in the catalog",
    alternates: { canonical: "/sets" },
    robots: query || category ? { index: false, follow: true } : undefined,
  };
}

export default async function SetsPage({ searchParams }: SetsPageProps) {
  const { query, category } = parseSetsQuery(await searchParams);
  const initialData = await loadSetsFirstPage(query, category);

  return (
    <>
      <p className="mb-4">
        <Link
          href="/browse"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Browse cards
        </Link>
      </p>
      <SetsExplorer initialData={initialData} />
    </>
  );
}
