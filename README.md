# card-web

Public card browser for the Enigmic card catalog, live at **https://cards.enigmic.co.za**. Next.js 16 (Turbopack) + React 19; browse, search, sets and card detail pages built from `@enigmic-co/card-react`.

## Rendering

Every page arrives as server-rendered HTML; the browser then takes over for anything interactive.

| Route         | Server renders                                                                                                     | Then in the browser                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `/`           | Search box, newest sets and cards                                                                                  | Search submits to `/browse`                                                                        |
| `/browse`     | First page of results for the URL's query and filters (`noindex` when filtered; canonical `/browse`)               | Filters, infinite scroll (next 60 from row 4), back/forward                                        |
| `/sets`       | First page of sets (canonical `/sets`)                                                                             | Paging, set filters                                                                                |
| `/cards/<id>` | Card, artworks and printings; title, description, canonical URL, link-preview tags (`lib/card-seo.ts`) and JSON-LD | Rules picker (state kept in the query string); ZAR estimates per printing (`/v1/estimates`, D-061) |
| `/status`     | API and catalog status                                                                                             |                                                                                                    |
| `/search`     | Redirects to `/browse` with the same query (old links)                                                             |                                                                                                    |

Server reads go through `lib/catalog.server.ts` into Next's data cache under the tag `catalog` (refreshed hourly; the sitemap daily). `robots.txt` and `sitemap.xml` list every card. The initial data is handed to the `@enigmic-co/card-react` views (`initialData`), so they don't refetch on load.

The browser never calls card-api directly: `app/api/cards/[...path]` is a server-side proxy (BFF) that adds the card-api key, rate-limits per client IP and only forwards read routes. Its JSON is cached at Vercel's CDN for 60 s (`stale-while-revalidate` 300 s); browsers revalidate with the release-keyed ETag.

After a release is published or rolled back, card-admin-api's outbox processing calls `/api/revalidate` (once `CARD_WEB_REVALIDATE_URL` / `CARD_WEB_REVALIDATE_SECRET` are set there; ygo-enigmic #20). By hand:

```bash
curl -X POST -H "Authorization: Bearer $CARD_WEB_REVALIDATE_SECRET" https://cards.enigmic.co.za/api/revalidate
```

## Packages

The card UI, search state and API client (`@enigmic-co/card-api-contracts`, `card-sdk`, `card-search-core`, `card-rules-text`, `card-react`) come from the [ygo-enigmic](https://github.com/TLaw763/ygo-enigmic) monorepo. They're **vendored** as tarballs in `vendor/` and installed from there (`file:` dependencies plus `pnpm.overrides` so the packages' references to each other resolve to the same files). No registry and no token are needed, in CI, on Vercel or locally.

To update them after a change in ygo-enigmic (bump the package version there first):

```bash
# from ygo-enigmic, at the commit to ship:
scripts/pack-client-packages.sh ../card-web/vendor
# then in card-web: point package.json (dependencies + pnpm.overrides) at the new file names
pnpm install && pnpm typecheck && pnpm test && pnpm build
```

The same packages were also published to GitHub Packages under the `enigmic-co` org (2026-10-11). That org is on hold (hobby project, free tiers only), so card-web doesn't use the registry.

## Develop

```bash
pnpm install
cp .env.example .env.local   # card-api origin and key
pnpm dev                     # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Smoke tests (Playwright)

`pnpm test:e2e` runs `e2e/smoke.spec.ts` in Chromium against `next start` (port 3200), with `e2e/card-api-stub.mjs` standing in for card-api. The stub replays responses saved in `e2e/fixtures/card-api/`, so the tests need no key or network. Build first; the first time, run `pnpm exec playwright install chromium`.

When the tests start asking for something new (the stub logs `no fixture for …`) or the data should be refreshed, run `pnpm e2e:record`: it forwards to the card-api in `.env.local` and rewrites the fixtures (asset bytes are never saved). The tests also run axe (WCAG 2.2 A/AA) on each page and fail on serious or critical issues.

### Performance budgets

- `pnpm budget` (after `pnpm build`): gzipped JavaScript each page loads on a first visit: runtime, root layout and page chunks, read from the Turbopack manifests (`next build` no longer prints sizes). Limits in `bundle-budget.json`; ~162 kB per page in October 2026 on Next 15, 192-203 kB on Next 16.
- `pnpm lighthouse` (after `pnpm build`): Lighthouse CI, mobile with simulated slow 4G, 3 runs each on `/`, `/browse`, `/sets` and a card page, served by `next start` against the card-api stub. Fails on median CLS > 0.1, LCP > 4 s, TBT > 800 ms or accessibility < 0.95; warns below a 0.9 performance score. Limits in `lighthouserc.json`; reports land in `.lighthouseci/reports/`. These are lab numbers with placeholder images, for catching regressions; real-user numbers need Vercel Speed Insights.

CI runs ESLint, Prettier, typecheck, unit tests, build, the bundle budget, the smoke tests, Lighthouse and `pnpm audit --prod` (fails on high or critical). Dependabot opens weekly update PRs; the vendored `@enigmic-co/*` packages are updated by hand (see Packages).

**Audit exceptions:** none. If an advisory has no fix yet, add its GHSA to `pnpm.auditConfig.ignoreGhsas` in `package.json` and list it here with why it's accepted, the fix and a review date; remove both once fixed. (The last one, GHSA-mrhx-c7xc-m3w5 for zod 3, was removed in October 2026 when the vendored packages moved to zod 4.6.7.)

## Colour mode

System (default), light or dark, per D-049. An inline script in `<head>` (`COLOR_MODE_BOOTSTRAP` in `lib/color-mode.ts`, a fixed string so a CSP can allow it by hash) sets `data-color-mode="light|dark"` on `<html>` before first paint from `localStorage["enigmic-color-mode"]` or the OS setting. Tokens in `app/globals.css` switch on that attribute (with `color-scheme`), as do Tailwind's `dark:` variant and card-react's dark badge colours. `components/ColorModeControl.tsx` is the three-way radio group (nav on wide screens, footer always), synced across both and other tabs; it follows OS changes only while set to System. Without JavaScript the site stays light.

## Card images

Card images load straight from the image host `images.enigmic.co.za` (Cloudflare cache in front of card-api, D-021), not through a Vercel function: card-api hands out image-host URLs and `lib/card-image.ts` (`resolveCardImageUrl`) passes them through. A card-api image URL on any other origin (local dev, or the image host not configured) still goes through the BFF's `/api/cards/v1/assets/…`, which adds the key. The CSP's `img-src` allows only this site, `data:` and the image host. `NEXT_PUBLIC_CARD_IMAGE_ORIGIN` overrides the host (build time).

## Brand, icons and footer

- The mark is `app/icon.svg` (favicon) and `components/BrandMark.tsx` (nav). After changing it, `node scripts/render-icons.mjs` re-renders `app/apple-icon.png` and the manifest icons `public/icon-192.png` / `icon-512.png`; `app/manifest.ts` is the web app manifest.
- Game icons (attributes, monster types, Spell/Trap properties, Level/Rank, Forbidden/Limited) are Konami's, in `public/icons/`, shown next to the text values through card-react's `image.iconUrl` (`lib/card-icons.ts`). Decision D-054 in enigmic-card-platform: fan content under the footer's notice, removed on request.
- `components/SiteFooter.tsx`: non-affiliation notice, Konami and YGOPRODeck attribution, and a contact line when `CARD_WEB_CONTACT_EMAIL` is set.

## Deploy

Vercel project `card-web` (region `cpt1`, Node 24.x: pinned in `package.json` `engines`; an open range like `>=22` makes Vercel move to each new major on its own), production branch `main`. Project env: `PUBLIC_CARD_API_ORIGIN`, `CARD_API_SERVICE_TOKEN`, `CARD_WEB_REVALIDATE_SECRET` (optional; enables `/api/revalidate`), `CARD_WEB_CONTACT_EMAIL` (optional; footer contact). No package token is needed (packages are vendored).

The repo is on a personal account because Vercel's Hobby plan can't deploy from org repos. This is a hobby project on free tiers; the `enigmic-co` org is deferred.
