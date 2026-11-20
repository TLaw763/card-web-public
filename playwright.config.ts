import { defineConfig, devices } from "@playwright/test";

// Smoke tests run `next start` (build first) against e2e/card-api-stub.mjs.
// `pnpm e2e:record` refreshes the stub's fixtures from the card-api in .env.local.
const WEB_PORT = 3200;
const STUB_PORT = 3901;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/card-api-stub.mjs",
      url: `http://127.0.0.1:${STUB_PORT}/v1/assets/ready`,
      env: { E2E_CARD_API_PORT: String(STUB_PORT) },
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec next start -p ${WEB_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}/status`,
      env: {
        PUBLIC_CARD_API_ORIGIN: `http://127.0.0.1:${STUB_PORT}`,
        CARD_API_SERVICE_TOKEN: "",
        CARD_WEB_BFF_RATE_LIMIT_ENABLED: "false",
        CARD_WEB_SITE_URL: `http://127.0.0.1:${WEB_PORT}`,
      },
      reuseExistingServer: false,
    },
  ],
});
