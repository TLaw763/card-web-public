/**
 * Card images (D-021, work plan WP2). card-api hands out image URLs on the
 * image host (`images.enigmic.co.za`), which browsers load straight from
 * Cloudflare's cache: no Vercel function per image, no API key. A URL on any
 * other card-api origin (the image host not configured yet) goes through the
 * BFF, which adds the key.
 */

/** Production image host; NEXT_PUBLIC_CARD_IMAGE_ORIGIN overrides it (e.g. in dev). */
export const CARD_IMAGE_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_CARD_IMAGE_ORIGIN || "https://images.enigmic.co.za",
);

/** `/v1/assets/<sha256>` (stored) or `/v1/assets/by-id/<uuid>` (not stored yet). */
const ASSET_PATH =
  /\/v1\/assets\/(?:[a-f0-9]{64}|by-id\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/** True for an image URL on the configured image host. */
export function isImageHostUrl(url: string, imageOrigin = CARD_IMAGE_ORIGIN): boolean {
  return url.startsWith(`${imageOrigin}/v1/assets/`) && ASSET_PATH.test(url);
}

/**
 * Where the browser loads a card image from: the image host as given, else
 * the BFF for card-api asset paths. Anything else is returned unchanged (the
 * CSP only allows this site and the image host, so it won't load).
 */
export function resolveCardImageUrl(
  url: string,
  options: { bffBase?: string; imageOrigin?: string } = {},
): string {
  const bffBase = trimTrailingSlash(options.bffBase ?? "/api/cards");
  if (isImageHostUrl(url, options.imageOrigin)) {
    return url;
  }
  if (url.startsWith(`${bffBase}/`)) {
    return url;
  }

  const assetMatch = url.match(ASSET_PATH);
  if (assetMatch) {
    return `${bffBase}${assetMatch[0]}`;
  }

  return url;
}

/** @deprecated Use resolveCardImageUrl. */
export function rewriteAssetUrlForBff(url: string, bffBase = "/api/cards"): string {
  return resolveCardImageUrl(url, { bffBase });
}
