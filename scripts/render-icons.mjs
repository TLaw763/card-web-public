#!/usr/bin/env node
// Renders app/icon.svg to the PNG app icons (Apple touch icon, manifest).
// Run after changing the mark: node scripts/render-icons.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("app/icon.svg", "utf8");
const targets = [
  // iOS rounds the corners itself and fills transparency with black: full square.
  { path: "app/apple-icon.png", size: 180, square: true },
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
];

const browser = await chromium.launch();
try {
  for (const { path, size, square } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    let sized = svg.replace(/width="32" height="32"/, `width="${size}" height="${size}"`);
    if (square) sized = sized.replace('rx="7"', 'rx="0"');
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    await page.locator("svg").screenshot({ path, omitBackground: true });
    await page.close();
    console.log(`${path} (${size}×${size})`);
  }
} finally {
  await browser.close();
}
