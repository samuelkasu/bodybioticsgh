/**
 * The cookie choice a visitor made, kept on their own device.
 *
 * localStorage rather than a cookie, deliberately: the record is only ever read
 * by this app in the browser, so sending it up with every request would cost
 * bytes on a 3G connection and buy nothing. It also means the banner cannot be
 * defeated by the very thing it is asking about.
 *
 * Nothing here is authoritative for the strictly necessary cookies — those are
 * the session and the guest cart, and the shop cannot work without them. What
 * is stored is the answer to the optional categories, so the question is asked
 * once rather than on every visit.
 */

const KEY = "bodybiotics:cookie-consent";

/**
 * Bump this when a new category is added or an existing one starts being used
 * for something materially different. An older record then reads as "never
 * asked", and the banner comes back — which is the honest behaviour, because
 * the visitor never agreed to the new thing.
 */
export const CONSENT_VERSION = 1;

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export type ConsentPreferences = Record<ConsentCategory, boolean>;

export type ConsentRecord = {
  version: number;
  /** ISO timestamp, so a support query can be answered with a date. */
  decidedAt: string;
  preferences: ConsentPreferences;
};

/** Always on. Without the session and cart cookies there is no shop. */
export const NECESSARY_ONLY: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
};

export const ALL_ACCEPTED: ConsentPreferences = {
  necessary: true,
  analytics: true,
  marketing: true,
};

const readBoolean = (value: unknown): boolean => value === true;

export function loadConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    // A record from an older set of categories is not a decision about the
    // current ones, so it is discarded rather than upgraded.
    if (record.version !== CONSENT_VERSION) return null;

    const stored = (
      typeof record.preferences === "object" && record.preferences !== null
        ? record.preferences
        : {}
    ) as Record<string, unknown>;

    return {
      version: CONSENT_VERSION,
      decidedAt:
        typeof record.decidedAt === "string"
          ? record.decidedAt
          : new Date().toISOString(),
      preferences: {
        necessary: true,
        analytics: readBoolean(stored.analytics),
        marketing: readBoolean(stored.marketing),
      },
    };
  } catch {
    // Private mode, a quota error, or somebody else's JSON under our key.
    return null;
  }
}

export function saveConsent(preferences: ConsentPreferences): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    // Never trust a caller to have kept this true; the shop needs it either way.
    preferences: { ...preferences, necessary: true },
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(record));
    } catch {
      // Storage blocked. The choice still applies for this page view; the
      // banner simply asks again next time, which is the safe direction.
    }
  }

  return record;
}

export function clearConsent(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; the next write overwrites it anyway.
  }
}
