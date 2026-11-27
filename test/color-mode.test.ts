import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COLOR_MODE_BOOTSTRAP,
  COLOR_MODE_STORAGE_KEY,
  parseColorModePreference,
  resolveColorMode,
} from "../lib/color-mode.js";

/** Runs the inline bootstrap with a stored value and an OS preference. */
function bootstrap(stored: string | null, systemDark: boolean, storageThrows = false) {
  const attributes: Record<string, string> = {};
  const localStorage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error("blocked");
      return key === COLOR_MODE_STORAGE_KEY ? stored : null;
    },
  };
  const matchMedia = (query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" && systemDark,
  });
  const document = {
    documentElement: {
      setAttribute: (name: string, value: string) => {
        attributes[name] = value;
      },
    },
  };
  new Function("localStorage", "matchMedia", "document", COLOR_MODE_BOOTSTRAP)(
    localStorage,
    matchMedia,
    document,
  );
  return attributes["data-color-mode"];
}

describe("color mode", () => {
  it("parses the stored preference, defaulting to system", () => {
    assert.equal(parseColorModePreference("dark"), "dark");
    assert.equal(parseColorModePreference("light"), "light");
    assert.equal(parseColorModePreference(null), "system");
    assert.equal(parseColorModePreference("purple"), "system");
  });

  it("resolves system from the OS and keeps explicit choices", () => {
    assert.equal(resolveColorMode("system", true), "dark");
    assert.equal(resolveColorMode("system", false), "light");
    assert.equal(resolveColorMode("light", true), "light");
    assert.equal(resolveColorMode("dark", false), "dark");
  });

  it("bootstrap sets data-color-mode before paint", () => {
    assert.equal(bootstrap(null, true), "dark");
    assert.equal(bootstrap(null, false), "light");
    assert.equal(bootstrap("light", true), "light");
    assert.equal(bootstrap("dark", false), "dark");
    assert.equal(bootstrap("junk", true), "dark");
  });

  it("bootstrap follows the OS when storage is blocked", () => {
    assert.equal(bootstrap("light", true, true), "dark");
    assert.equal(bootstrap("dark", false, true), "light");
  });
});
