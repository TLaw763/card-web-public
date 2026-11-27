import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Card images load from the image host (D-021); same default as lib/card-image.ts.
const cardImageOrigin = (
  process.env.NEXT_PUBLIC_CARD_IMAGE_ORIGIN || "https://images.enigmic.co.za"
).replace(/\/$/, "");

// Next.js dev tooling (React Fast Refresh) uses eval(); keep production CSP strict.
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const connectSrc = isDev
  ? "connect-src 'self' ws://localhost:3000 ws://127.0.0.1:3000 http://localhost:3000 http://127.0.0.1:3000"
  : "connect-src 'self'";

const contentSecurityPolicy = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  // No other https: origin: card-api never hands out source image URLs.
  `img-src 'self' data: ${cardImageOrigin}`,
  connectSrc,
  "font-src 'self'",
  // No plugins (<object>/<embed>) anywhere on the site.
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@enigmic-co/card-react",
    "@enigmic-co/card-sdk",
    "@enigmic-co/card-search-core",
    "@enigmic-co/card-api-contracts",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
