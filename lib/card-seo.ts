import type { CardApiArtwork, CardApiCard } from "@enigmic-co/card-api-contracts";
import { isImageHostUrl } from "./card-image";
import { cardDetailPath } from "./detail-url";

export const SITE_NAME = "Enigmic Cards";
const DEFAULT_SITE_URL = "https://cards.enigmic.co.za";
const DESCRIPTION_MAX_LENGTH = 160;
const ASSET_PATH_PATTERN = /\/v1\/assets\/[a-f0-9]{64}$/;

/** Public origin for canonical URLs, the sitemap and preview images. */
export function siteUrl(
  source: Record<string, string | undefined> = process.env,
): string {
  const configured = source.CARD_WEB_SITE_URL?.trim();
  return (configured || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** "Monster · DARK · Spellcaster · Level 7 · ATK 2500 / DEF 2100" */
export function cardSummaryLine(card: CardApiCard): string {
  const parts: string[] = [titleCase(card.cardType)];

  if (card.attribute) {
    parts.push(card.attribute.toUpperCase());
  }
  if (card.race) {
    parts.push(titleCase(card.race));
  }
  if (card.spellTrapSubtype) {
    parts.push(titleCase(card.spellTrapSubtype));
  }
  if (card.level != null) {
    parts.push(`Level ${card.level}`);
  }
  if (card.rank != null) {
    parts.push(`Rank ${card.rank}`);
  }
  if (card.linkRating != null) {
    parts.push(`Link ${card.linkRating}`);
  }
  if (card.atk != null) {
    parts.push(
      card.def != null ? `ATK ${card.atk} / DEF ${card.def}` : `ATK ${card.atk}`,
    );
  }

  return parts.join(" · ");
}

export function cardDescription(card: CardApiCard): string {
  // One line for search snippets; Konami's escaped line breaks arrive as "<br>".
  const text = card.rulesText
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const full = text ? `${cardSummaryLine(card)}. ${text}` : cardSummaryLine(card);
  if (full.length <= DESCRIPTION_MAX_LENGTH) {
    return full;
  }
  return `${full.slice(0, DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Preview image for link cards: our own mirrored copy of the primary artwork,
 * from the image host when the API gives an image-host URL, else through the
 * BFF. Images not stored yet are left out (their URL is not permanent).
 */
export function cardPreviewImage(
  artworks: CardApiArtwork[] | undefined,
  baseUrl: string,
): { url: string; width: number; height: number } | null {
  const artwork =
    artworks?.find((candidate) => candidate.status === "available") ?? artworks?.[0];
  if (!artwork || artwork.status === "suppressed") {
    return null;
  }

  const asset =
    artwork.assets.find((candidate) => candidate.kind === "full") ??
    artwork.assets.find((candidate) => candidate.kind === "thumbnail");
  const path = asset?.url.match(ASSET_PATH_PATTERN)?.[0];
  if (!asset || !path) {
    return null;
  }

  const url = isImageHostUrl(asset.url) ? asset.url : `${baseUrl}/api/cards${path}`;
  return { url, width: asset.width, height: asset.height };
}

/**
 * schema.org data for a card page: the card as a CreativeWork (name, text,
 * our own preview image, passcode) and the breadcrumb Browse → card.
 */
export function cardJsonLd(
  card: CardApiCard,
  artworks: CardApiArtwork[] | undefined,
  baseUrl: string,
): Record<string, unknown>[] {
  const url = `${baseUrl}${cardDetailPath(card)}`;
  const image = cardPreviewImage(artworks, baseUrl);

  return [
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "@id": url,
      url,
      name: card.name,
      description: cardDescription(card),
      genre: cardSummaryLine(card),
      inLanguage: card.locale,
      dateModified: card.updatedAt,
      ...(image ? { image: image.url } : {}),
      ...(card.passcode ? { identifier: card.passcode } : {}),
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: baseUrl },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Browse cards",
          item: `${baseUrl}/browse`,
        },
        { "@type": "ListItem", position: 2, name: card.name, item: url },
      ],
    },
  ];
}

/**
 * JSON for an inline `<script type="application/ld+json">`. `<` is escaped so
 * card text can never close the script element.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
