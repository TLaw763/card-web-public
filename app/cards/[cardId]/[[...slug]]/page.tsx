import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { CardDetailExplorer } from "@/components/CardDetailExplorer";
import {
  cardDescription,
  cardJsonLd,
  cardPreviewImage,
  serializeJsonLd,
  siteUrl,
} from "@/lib/card-seo";
import { loadCardPageData } from "@/lib/catalog.server";
import { cardDetailPath, requestedCardPath, searchParamsSuffix } from "@/lib/detail-url";

interface CardPageProps {
  // `cardId` is the short id (D-067) or, on old links, the uuid; `slug` is the
  // card name in the URL, never used to look the card up.
  params: Promise<{ cardId: string; slug?: string[] }>;
  // Read so the page renders per request: the rules picker state lives in the
  // query string, and a statically rendered page would show only the loading
  // fallback in its HTML. Catalog data still comes from the data cache.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { cardId } = await params;
  const data = await loadCardPageData(cardId);
  if (!data) {
    return { title: "Card not found", robots: { index: false } };
  }

  const { card } = data;
  const description = cardDescription(card);
  const image = cardPreviewImage(data.artworks, siteUrl());
  const images = image ? [{ ...image, alt: card.name }] : undefined;

  return {
    title: card.name,
    description,
    alternates: { canonical: cardDetailPath(card) },
    openGraph: {
      type: "article",
      title: card.name,
      description,
      url: cardDetailPath(card),
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: card.name,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

export default async function CardDetailPage({ params, searchParams }: CardPageProps) {
  const [{ cardId, slug }, query] = await Promise.all([params, searchParams]);
  const data = await loadCardPageData(cardId);
  if (!data) {
    notFound();
  }

  // One URL per card: an old uuid link, a missing or out-of-date slug all get
  // a 308 to /cards/<shortId>/<slug>, keeping the query string (rules picker).
  // Nothing has streamed yet (no loading.tsx), so this is a real HTTP 308.
  const canonical = cardDetailPath(data.card);
  if (requestedCardPath(cardId, slug) !== canonical) {
    permanentRedirect(`${canonical}${searchParamsSuffix(query)}`);
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Escaped by serializeJsonLd; a data block, not executed.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(cardJsonLd(data.card, data.artworks, siteUrl())),
        }}
      />
      <p className="mb-4">
        <Link
          href="/browse"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to browse
        </Link>
      </p>
      <CardDetailExplorer
        cardId={data.card.id}
        card={{ id: data.card.id, name: data.card.name, shortId: data.card.shortId }}
        initialData={data}
      />
    </>
  );
}
