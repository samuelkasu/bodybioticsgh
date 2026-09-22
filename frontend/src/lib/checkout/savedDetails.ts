/**
 * The delivery details a customer last checked out with, kept on their own
 * device so the second order is not the first one retyped.
 *
 * localStorage rather than the account, deliberately: most orders here are
 * placed by guests, an account-side address would help only the minority who
 * sign in, and the shop already stores the address it needs on the order
 * itself. This is a convenience cache, and it is treated like one — anything
 * unreadable is discarded rather than repaired.
 *
 * Not the payment method and not the notes: notes are per-delivery ("leave at
 * the gate, I am out until six") and replaying the last one onto a new order
 * sends the rider somewhere the customer no longer is.
 */

const KEY = "bodybiotics:delivery-details";

export type SavedDetails = {
  email: string;
  fullName: string;
  phone: string;
  addressLine: string;
  city: string;
  deliveryZone: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function loadSavedDetails(): Partial<SavedDetails> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const record = parsed as Record<string, unknown>;
    const details: Partial<SavedDetails> = {};

    // Field by field, so one corrupt key does not throw away a usable address.
    for (const field of [
      "email",
      "fullName",
      "phone",
      "addressLine",
      "city",
      "deliveryZone",
    ] as const) {
      if (isNonEmptyString(record[field])) {
        details[field] = record[field].slice(0, 320);
      }
    }

    return Object.keys(details).length > 0 ? details : null;
  } catch {
    // Private mode, a quota error, or somebody else's JSON under our key.
    return null;
  }
}

export function saveDetails(details: SavedDetails): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(KEY, JSON.stringify(details));
  } catch {
    // Storage being full or blocked must never stop an order going through.
  }
}

export function clearSavedDetails(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; the next write overwrites it anyway.
  }
}
