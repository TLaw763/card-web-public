#!/usr/bin/env bash
# Lab Core Web Vitals: Lighthouse CI (mobile, simulated slow 4G) on the home,
# browse, sets and a card page, served by `next start` against the e2e
# card-api stub. Limits are in lighthouserc.json. Build first:
#
#   pnpm build && pnpm lighthouse
#
# Needs Chromium: `pnpm exec playwright install chromium` (or set CHROME_PATH).
set -euo pipefail

web_port=3200
stub_port=3901
web="http://127.0.0.1:$web_port"

E2E_CARD_API_PORT=$stub_port node e2e/card-api-stub.mjs &
stub_pid=$!
PUBLIC_CARD_API_ORIGIN="http://127.0.0.1:$stub_port" \
  CARD_API_SERVICE_TOKEN="" \
  CARD_WEB_BFF_RATE_LIMIT_ENABLED=false \
  CARD_WEB_SITE_URL="$web" \
  node_modules/.bin/next start -p $web_port -H 127.0.0.1 &
web_pid=$!
trap 'kill $stub_pid $web_pid 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf "$web/status" >/dev/null && break
  sleep 1
done

# A card the stub has fixtures for: the first one on /browse.
card=$(curl -sf "$web/browse" | grep -o '/cards/[0-9a-f-]\{36\}' | head -1)
[ -n "$card" ] || { echo "No card link on /browse" >&2; exit 1; }

export CHROME_PATH="${CHROME_PATH:-$(node -e 'console.log(require("@playwright/test").chromium.executablePath())')}"
# GitHub's Ubuntu 24.04 runners block Chrome's sandbox (no unprivileged user
# namespaces); Playwright passes --no-sandbox there too. Only local pages load.
chrome_flags="--headless=new"
if [ -n "${CI:-}" ]; then chrome_flags="$chrome_flags --no-sandbox"; fi

pnpm dlx @lhci/cli@0.15.1 autorun \
  --collect.settings.chromeFlags="$chrome_flags" \
  --collect.url="$web/" \
  --collect.url="$web/browse" \
  --collect.url="$web/sets" \
  --collect.url="$web$card"
