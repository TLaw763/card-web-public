import { randomUUID } from "node:crypto";
import { getCardWebBffConfig, ensureBffRateLimitConfigured } from "@/lib/server-config";
import {
  ProxyRequestError,
  isCdnCacheable,
  proxyCardApiRequest,
} from "@/lib/card-api-proxy";
import {
  applyBffRateLimitHeaders,
  checkBffRateLimit,
  resolveBffClientKey,
} from "@/lib/bff-rate-limit";

function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  requestId: string,
): Response {
  return Response.json(
    {
      type: `https://api.enigmic.invalid/problems/${code}`,
      title,
      status,
      code,
      detail,
      requestId,
    },
    {
      status,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    },
  );
}

async function handleProxy(request: Request, pathSegments: string[]): Promise<Response> {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  ensureBffRateLimitConfigured();
  const rateLimit = checkBffRateLimit(resolveBffClientKey(request));
  if (rateLimit && !rateLimit.allowed) {
    const headers = new Headers({
      "Content-Type": "application/problem+json",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    });
    applyBffRateLimitHeaders(headers, rateLimit);

    return new Response(
      JSON.stringify({
        type: "https://api.enigmic.invalid/problems/rate_limited",
        title: "Rate limit exceeded",
        status: 429,
        code: "rate_limited",
        detail:
          "Too many requests from this client. Retry after the interval in Retry-After.",
        requestId,
      }),
      { status: 429, headers },
    );
  }

  try {
    const config = getCardWebBffConfig();
    const upstream = await proxyCardApiRequest(config, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      pathSegments,
      search: new URL(request.url).search,
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
      requestId,
    });

    // A CDN-cached copy is served to everyone: leave out this client's counters.
    if (rateLimit && !isCdnCacheable(upstream.headers)) {
      const headers = new Headers(upstream.headers);
      applyBffRateLimitHeaders(headers, rateLimit);
      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    }

    return upstream;
  } catch (error) {
    if (error instanceof ProxyRequestError) {
      return problemResponse(
        error.status,
        error.code,
        error.code === "not_found" ? "Not found" : "Catalog unavailable",
        error.message,
        requestId,
      );
    }

    return problemResponse(
      500,
      "internal_error",
      "Internal error",
      "The BFF failed to process the request.",
      requestId,
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handleProxy(request, path);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  return handleProxy(request, path);
}
