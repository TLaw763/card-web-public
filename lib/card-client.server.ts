import { CardApi } from "@enigmic-co/card-sdk";
import { loadCardWebEnv } from "./env";

export function createServerCardClient(): CardApi {
  const env = loadCardWebEnv();
  return new CardApi({
    baseUrl: env.cardApiOrigin,
    apiKey: env.serviceToken ?? undefined,
  });
}
