import { configureBffRateLimit } from "./bff-rate-limit";
import { loadCardWebEnv } from "./env";

let bffRateLimitInitialized = false;

export function getCardWebBffConfig() {
  const env = loadCardWebEnv();
  return {
    cardApiOrigin: env.cardApiOrigin,
    serviceToken: env.serviceToken,
  };
}

export function ensureBffRateLimitConfigured(): void {
  if (bffRateLimitInitialized) {
    return;
  }

  const env = loadCardWebEnv();
  configureBffRateLimit({
    enabled: env.bffRateLimitEnabled,
    limitPerMinute: env.bffRateLimitPerMinute,
  });
  bffRateLimitInitialized = true;
}
