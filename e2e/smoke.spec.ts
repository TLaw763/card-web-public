import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CARD_PATH = /\/cards\/[0-9a-f-]{36}$/;

/** WCAG 2.x A/AA checks; fails on serious and critical violations. */
async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations
    .filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    )
    .flatMap((violation) =>
      violation.nodes.map((node) => `${violation.id} ${node.target.join(" ")}`),
    );
  expect(serious).toEqual([]);
}

// Everything comes from the app and the stub; images on other hosts would
// make the run depend on the network.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
});

test("security headers: CSP without eval or plugins, no framing", async ({ request }) => {
  const response = await request.get("/");
  const csp = response.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).not.toContain("unsafe-eval");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
});

test("home: search box, newest sets and cards", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Enigmic Cards" }),
  ).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search cards" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Newest sets" }).getByRole("listitem"),
  ).toHaveCount(6);
  await expect(
    page.getByRole("region", { name: "Newest cards" }).getByRole("listitem"),
  ).toHaveCount(12);
  await expectNoSeriousA11yViolations(page);
});

test("skip link: first Tab shows it, Enter moves focus into main", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("home search: suggestions, then submit goes to /browse", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search cards" }).fill("dark magician");
  await expect(
    page
      .getByRole("listbox", { name: "Card name suggestions" })
      .getByRole("option")
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/browse\?q=dark(\+|%20)magician/);
  await expect(page.getByRole("combobox", { name: "Find cards" })).toHaveValue(
    "dark magician",
  );
  await expect(
    page.getByRole("link", { name: "Dark Magician", exact: true }),
  ).toBeVisible();
});

test("browse: first page is in the server HTML", async ({ page, request }) => {
  const html = await (await request.get("/browse")).text();
  expect(html).toMatch(/href="\/cards\/[0-9a-f-]{36}"/);

  await page.goto("/browse");
  await expect(
    page.getByRole("heading", { level: 1, name: "Browse cards" }),
  ).toBeVisible();
  await expect(page.locator('a[href^="/cards/"]').first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("sets: a set link opens browse filtered to that set", async ({ page }) => {
  await page.goto("/sets");
  const table = page.getByRole("table", { name: "Catalog sets by product" });
  await expect(table).toBeVisible();

  // First set that has cards (the newest ones can be empty before release).
  const rows = table.locator("tbody tr");
  const count = await rows.count();
  let setLink = null;
  for (let index = 0; index < count; index += 1) {
    const cards = await rows.nth(index).locator("td").first().innerText();
    if (Number(cards.trim()) > 0) {
      setLink = rows.nth(index).getByRole("link");
      break;
    }
  }
  expect(setLink, "no set with cards in the first page").not.toBeNull();

  const href = await setLink!.getAttribute("href");
  await setLink!.click();
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[?]/g, "\\?")}$`));
  await expect(page.locator('a[href^="/cards/"]').first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("card page: server-rendered with metadata", async ({ page, request }) => {
  await page.goto("/");
  const firstCard = page
    .getByRole("region", { name: "Newest cards" })
    .getByRole("listitem")
    .first();
  const name = (await firstCard.getByRole("heading").innerText()).trim();
  const href = (await firstCard.getByRole("link").getAttribute("href"))!;

  const html = await (await request.get(href)).text();
  expect(html).toContain('type="application/ld+json"');
  expect(html).toContain(`<link rel="canonical"`);

  await page.goto(href);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page).toHaveTitle(`${name} · Enigmic Cards`);
  await expect(page.getByRole("heading", { name: "Card text" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Printings" })).toBeVisible();
  // ZAR estimates (D-061): none exist yet, so every printing says so.
  await expect(page.getByRole("columnheader", { name: "Estimate (ZAR)" })).toBeVisible();
  await expect(page.getByText("No estimate yet").first()).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("unknown card ids return 404", async ({ request }) => {
  expect((await request.get("/cards/not-a-card")).status()).toBe(404);
  expect(
    (await request.get("/cards/00000000-0000-4000-8000-000000000000")).status(),
  ).toBe(404);
});

test("deep links round-trip through back and forward", async ({ page }) => {
  await page.goto("/browse?q=dark+magician");
  const finder = page.getByRole("combobox", { name: "Find cards" });
  await expect(finder).toHaveValue("dark magician");

  await page.getByRole("link", { name: "Dark Magician", exact: true }).click();
  await expect(page).toHaveURL(CARD_PATH);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dark Magician" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/browse\?q=dark(\+|%20)magician/);
  await expect(finder).toHaveValue("dark magician");
  await expect(
    page.getByRole("link", { name: "Dark Magician", exact: true }),
  ).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(CARD_PATH);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dark Magician" }),
  ).toBeVisible();
});

// The sitemap walks the whole catalog (~90 card-api pages), too much to record.
test("robots.txt points at the sitemap", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Sitemap:");
});

test("color mode: follows the OS before first paint, no flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  // Record the mode as the HTML finishes parsing, before React hydrates.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { modeAtParse?: string }).modeAtParse =
        document.documentElement.dataset.colorMode;
    });
  });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => (window as unknown as { modeAtParse?: string }).modeAtParse,
    ),
  ).toBe("dark");
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
  ).toBe("dark");
  await expectNoSeriousA11yViolations(page);

  // An explicit choice beats the OS, from the first paint of the next page.
  await page.evaluate(() => localStorage.setItem("enigmic-color-mode", "light"));
  await page.reload();
  expect(
    await page.evaluate(
      () => (window as unknown as { modeAtParse?: string }).modeAtParse,
    ),
  ).toBe("light");
});

test("color mode: the theme control persists the choice", async ({ page }) => {
  await page.goto("/");
  const footerTheme = page.getByRole("contentinfo").getByRole("group", { name: "Theme" });
  await expect(footerTheme.getByRole("radio", { name: "System" })).toBeChecked();

  await footerTheme.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  // The nav control (wide screens) shows the same choice.
  await expect(
    page.getByRole("banner").getByRole("radio", { name: "Dark" }),
  ).toBeChecked();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "dark");
  await expect(footerTheme.getByRole("radio", { name: "Dark" })).toBeChecked();

  const card = page.locator('a[href^="/cards/"]').first();
  await card.click();
  await expect(page).toHaveURL(CARD_PATH);
  await expect(page.locator(".enigmic-card-anatomy-row")).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole("contentinfo").getByRole("radio", { name: "System" }).check();
  expect(
    await page.evaluate(() => localStorage.getItem("enigmic-color-mode")),
  ).toBeNull();
  await expect(page.locator("html")).toHaveAttribute("data-color-mode", "light");
});

test("browse: a failed search explains itself and can be retried", async ({ page }) => {
  await page.goto("/browse");
  await expect(page.locator('a[href^="/cards/"]').first()).toBeVisible();

  const fail = (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({
        title: "Upstream exploded",
        status: 503,
        code: "unavailable",
      }),
    });
  await page.route("**/api/cards/v1/cards/search**", fail);

  await page.getByRole("combobox").first().fill("dark magician");
  await page.keyboard.press("Enter");
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Couldn't load cards right now" });
  await expect(alert).toBeVisible();
  await expect(page.getByText("Upstream exploded")).toHaveCount(0);
  await expect(page.getByText("Loading latest cards…")).toHaveCount(0);

  await page.unroute("**/api/cards/v1/cards/search**", fail);
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator('a[href^="/cards/"]').first()).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test("browse search: one request per search, even when the server render is slow", async ({
  page,
}) => {
  const searches: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/cards/v1/cards/search")) {
      searches.push(request.url());
    }
  });
  await page.goto("/browse");
  await expect(page.locator('a[href^="/cards/"]').first()).toBeVisible();

  // The navigation's server render arriving after the search finished used to
  // rebuild the state and search a second time (CI, 2026-10-13).
  await page.route(/[?&]_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await page.getByRole("combobox").first().fill("dark magician");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Dark Magician", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2_500);
  expect(searches).toHaveLength(1);
});

test("browse search: Enter searches and closes suggestions; arrow keys + Enter open a card", async ({
  page,
}) => {
  await page.goto("/browse");
  const box = page.getByRole("combobox", { name: "Find cards" });
  const suggestions = page.getByRole("listbox", { name: "Card name suggestions" });

  await box.fill("dark magician");
  await expect(suggestions.getByRole("option").first()).toBeVisible();
  // Nothing is highlighted until the arrow keys move into the list.
  await expect(suggestions.getByRole("option", { selected: true })).toHaveCount(0);

  await box.press("Enter");
  await expect(page).toHaveURL(/\/browse\?q=dark(\+|%20)magician/);
  await expect(suggestions).toBeHidden();
  // Still closed once the search has settled (it doesn't reopen on its own).
  await expect(
    page.getByRole("link", { name: "Dark Magician", exact: true }),
  ).toBeVisible();
  await expect(suggestions).toBeHidden();

  // Changing the text brings them back; arrow down + Enter opens that card.
  await box.fill("dark magicia");
  await box.fill("dark magician");
  await expect(suggestions.getByRole("option").first()).toBeVisible();
  await box.press("ArrowDown");
  await expect(suggestions.getByRole("option", { selected: true })).toHaveCount(1);
  await box.press("Enter");
  await expect(page).toHaveURL(CARD_PATH);
});

test("browse: 60 cards, and the next 60 load from the 4th row", async ({ page }) => {
  await page.goto("/browse");
  const tiles = page.locator(".enigmic-card-result-list > li");
  await expect(tiles).toHaveCount(60);
  await expect(page.getByRole("button", { name: "Load more results" })).toHaveCount(0);

  // 6 columns at the default viewport: row 4 starts at tile 18.
  await tiles.nth(18).scrollIntoViewIfNeeded();
  await expect(tiles).toHaveCount(120);
  // Not again until row 4 of the new batch.
  await expect(tiles).toHaveCount(120, { timeout: 1_000 });
  // A jump past the trigger row still loads the next page.
  await tiles.nth(110).scrollIntoViewIfNeeded();
  await expect(tiles).toHaveCount(180);
});
