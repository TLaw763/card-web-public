import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "@/lib/catalog.server";

/**
 * Drops cached catalog data after a release is published or rolled back, so
 * rendered pages show the new release instead of waiting for the hourly
 * refresh. Call with `Authorization: Bearer <CARD_WEB_REVALIDATE_SECRET>`.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CARD_WEB_REVALIDATE_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "revalidation_disabled" }, { status: 404 });
  }

  const presented =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!safeEqual(presented, secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // `{ expire: 0 }` keeps the pre-Next-16 behaviour: the next request refetches
  // instead of serving stale data. `updateTag` is only for Server Actions.
  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  return Response.json({ revalidated: true, tag: CATALOG_CACHE_TAG, now: Date.now() });
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
