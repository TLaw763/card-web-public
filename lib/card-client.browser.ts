import { CardApi } from "@enigmic-co/card-sdk";

export function createBrowserCardClient(): CardApi {
  return new CardApi({
    baseUrl: "/api/cards",
  });
}
