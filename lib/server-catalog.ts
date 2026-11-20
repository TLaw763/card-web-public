import type { CatalogStatusSnapshot } from "./server-catalog-types";
import { createServerCardClient } from "./card-client.server";

export type { CatalogStatusSnapshot } from "./server-catalog-types";

export async function loadCatalogStatusServer(): Promise<CatalogStatusSnapshot> {
  try {
    const client = createServerCardClient();
    const [health, version] = await Promise.all([
      client.getHealth(),
      client.getDataVersion(),
    ]);

    return {
      health: health.status,
      dataVersion: version.data.version,
      error: null,
    };
  } catch (error) {
    return {
      health: null,
      dataVersion: null,
      error:
        error instanceof Error
          ? error.message
          : "The catalog service is temporarily unavailable.",
    };
  }
}
