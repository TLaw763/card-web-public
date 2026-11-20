const ALLOWED_PREFIXES = [
  "v1/health",
  "v1/data-version",
  "v1/meta",
  "v1/cards",
  "v1/artworks",
  "v1/assets",
  "v1/printings",
  "v1/products",
  "v1/sets",
  "v1/format-list-releases",
] as const;

/** Allowed only as-is, not below: `/v1/estimates?printingId=…` but not its change feed. */
const ALLOWED_EXACT = ["v1/estimates"] as const;

const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "etag",
  "last-modified",
  "surrogate-key",
  "x-data-version",
  "x-request-id",
] as const;

const MAX_QUERY_LENGTH = 2_048;
const MAX_RESPONSE_BYTES = 5_242_880;
const REQUEST_TIMEOUT_MS = 15_000;

const inflightRequests = new Map<string, Promise<Response>>();

export interface CardApiProxyConfig {
  cardApiOrigin: string;
  serviceToken: string | null;
}

export interface CardApiProxyRequest {
  method: "GET" | "HEAD";
  pathSegments: string[];
  search: string;
  ifNoneMatch?: string;
  requestId?: string;
}

export function isAllowedCardApiPath(pathSegments: string[]): boolean {
  if (pathSegments.length === 0) {
    return false;
  }

  const normalized = pathSegments.join("/");
  if ((ALLOWED_EXACT as readonly string[]).includes(normalized)) {
    return true;
  }
  return ALLOWED_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function isAssetPath(pathSegments: string[]): boolean {
  return (
    pathSegments.length === 3 && pathSegments[0] === "v1" && pathSegments[1] === "assets"
  );
}

export function buildUpstreamUrl(
  config: CardApiProxyConfig,
  pathSegments: string[],
  search: string,
): URL {
  const pathname = `/${pathSegments.join("/")}`;
  const url = new URL(pathname, config.cardApiOrigin);

  if (search.length > MAX_QUERY_LENGTH) {
    throw new ProxyRequestError(400, "invalid_request", "Query string is too long.");
  }

  if (search.length > 0) {
    url.search = search.startsWith("?") ? search.slice(1) : search;
  }

  return url;
}

export function buildCoalesceKey(
  config: CardApiProxyConfig,
  input: CardApiProxyRequest,
): string {
  const upstreamUrl = buildUpstreamUrl(config, input.pathSegments, input.search);
  return [
    input.method,
    upstreamUrl.toString(),
    input.ifNoneMatch ?? "",
    config.serviceToken ?? "",
  ].join("|");
}

export class ProxyRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProxyRequestError";
  }
}

export async function proxyCardApiRequest(
  config: CardApiProxyConfig,
  input: CardApiProxyRequest,
): Promise<Response> {
  if (!isAllowedCardApiPath(input.pathSegments)) {
    throw new ProxyRequestError(
      404,
      "not_found",
      "The requested catalog route is not available.",
    );
  }

  const coalesceKey = buildCoalesceKey(config, input);
  const inflight = inflightRequests.get(coalesceKey);
  if (inflight) {
    const response = await inflight;
    return response.clone();
  }

  const requestPromise = executeProxyRequest(config, input);
  inflightRequests.set(coalesceKey, requestPromise);

  try {
    const response = await requestPromise;
    return response.clone();
  } finally {
    inflightRequests.delete(coalesceKey);
  }
}

async function executeProxyRequest(
  config: CardApiProxyConfig,
  input: CardApiProxyRequest,
): Promise<Response> {
  const upstreamUrl = buildUpstreamUrl(config, input.pathSegments, input.search);
  const headers = new Headers();

  if (config.serviceToken) {
    headers.set("X-API-Key", config.serviceToken);
  }

  if (input.ifNoneMatch) {
    headers.set("If-None-Match", input.ifNoneMatch);
  }

  if (input.requestId) {
    headers.set("X-Request-Id", input.requestId);
  }

  headers.set("Accept", isAssetPath(input.pathSegments) ? "*/*" : "application/json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: input.method,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    const body =
      input.method === "HEAD" || upstream.status === 304
        ? null
        : await readLimitedBody(upstream);

    const responseHeaders = new Headers();
    for (const header of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    applyBffCachePolicy(input.pathSegments, responseHeaders, upstream.status);

    if (input.requestId && !responseHeaders.has("x-request-id")) {
      responseHeaders.set("X-Request-Id", input.requestId);
    }

    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProxyRequestError(
        504,
        "unavailable",
        "The catalog service did not respond in time.",
      );
    }

    throw new ProxyRequestError(
      503,
      "unavailable",
      "The catalog service is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Shared CDN cache for catalog JSON (Vercel's CDN only: Vercel-CDN-Cache-Control
 * is stripped before the browser sees it). Keyed by the full URL; paging cursors
 * carry the data version, so a cached next page always belongs to the same
 * release as the page that produced its cursor.
 */
export const BFF_CDN_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export function applyBffCachePolicy(
  pathSegments: string[],
  headers: Headers,
  status = 200,
): void {
  const normalized = pathSegments.join("/");

  if (normalized.startsWith("v1/assets/")) {
    return;
  }

  // Liveness and release probes must always reach card-api.
  if (normalized.startsWith("v1/health") || normalized.startsWith("v1/data-version")) {
    headers.set("Cache-Control", "no-store");
    return;
  }

  if (status !== 200) {
    // 304s answer one browser's If-None-Match; errors must never be cached.
    headers.set("Cache-Control", status === 304 ? "no-cache" : "no-store");
    return;
  }

  // Browsers revalidate every time (cheap 304s on the release-keyed ETag), so
  // they never keep a stale body; the CDN absorbs repeat requests.
  headers.set("Cache-Control", "no-cache");
  headers.set("Vercel-CDN-Cache-Control", BFF_CDN_CACHE_CONTROL);
}

export function isCdnCacheable(headers: Headers): boolean {
  return headers.has("vercel-cdn-cache-control");
}

async function readLimitedBody(response: Response): Promise<ArrayBuffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_RESPONSE_BYTES) {
    throw new ProxyRequestError(
      502,
      "unavailable",
      "The catalog response exceeded the allowed size.",
    );
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_RESPONSE_BYTES) {
    throw new ProxyRequestError(
      502,
      "unavailable",
      "The catalog response exceeded the allowed size.",
    );
  }

  return buffer;
}
