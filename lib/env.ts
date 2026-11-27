/**
 * The server-only variables card-web reads. Kept here rather than in the
 * monorepo's backend env schema so card-web can build on its own.
 */
export interface CardWebEnv {
  /** card-api origin the BFF proxies to. */
  cardApiOrigin: string;
  /** Sent as the card-api key; null in local dev without keys. */
  serviceToken: string | null;
  bffRateLimitEnabled: boolean;
  bffRateLimitPerMinute: number;
  /** Shown in the site footer; null hides the contact line. */
  contactEmail: string | null;
}

const DEFAULT_CARD_API_PORT = 3001;
const DEFAULT_BFF_RATE_LIMIT_PER_MINUTE = 120;

type EnvSource = Record<string, string | undefined>;

export function loadCardWebEnv(source: EnvSource = process.env): CardWebEnv {
  return {
    cardApiOrigin: readCardApiOrigin(source),
    serviceToken: readServiceToken(source.CARD_API_SERVICE_TOKEN),
    bffRateLimitEnabled: readFlag(
      "CARD_WEB_BFF_RATE_LIMIT_ENABLED",
      source.CARD_WEB_BFF_RATE_LIMIT_ENABLED,
      true,
    ),
    bffRateLimitPerMinute: readPositiveInt(
      "CARD_WEB_BFF_RATE_LIMIT_PER_MINUTE",
      source.CARD_WEB_BFF_RATE_LIMIT_PER_MINUTE,
      DEFAULT_BFF_RATE_LIMIT_PER_MINUTE,
    ),
    contactEmail: readEmail("CARD_WEB_CONTACT_EMAIL", source.CARD_WEB_CONTACT_EMAIL),
  };
}

function readEmail(name: string, value: string | undefined): string | null {
  const email = blankToUndefined(value);
  if (email === undefined) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`${name} must be an email address.`);
  }
  return email;
}

function readCardApiOrigin(source: EnvSource): string {
  const origin = blankToUndefined(source.PUBLIC_CARD_API_ORIGIN);
  if (origin === undefined) {
    const port = readPositiveInt(
      "CARD_API_PORT",
      source.CARD_API_PORT,
      DEFAULT_CARD_API_PORT,
    );
    return `http://localhost:${port}`;
  }
  try {
    new URL(origin);
  } catch {
    throw new Error("PUBLIC_CARD_API_ORIGIN must be a URL.");
  }
  return origin;
}

function readServiceToken(value: string | undefined): string | null {
  const token = blankToUndefined(value);
  if (token === undefined) {
    return null;
  }
  if (token.length < 8) {
    throw new Error("CARD_API_SERVICE_TOKEN must be at least 8 characters.");
  }
  return token;
}

function readFlag(
  name: string,
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  const flag = blankToUndefined(value)?.toLowerCase();
  if (flag === undefined) {
    return defaultValue;
  }
  if (flag === "true" || flag === "1") {
    return true;
  }
  if (flag === "false" || flag === "0") {
    return false;
  }
  throw new Error(`${name} must be true, false, 1 or 0.`);
}

function readPositiveInt(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  const raw = blankToUndefined(value);
  if (raw === undefined) {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}
