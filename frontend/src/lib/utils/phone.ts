/**
 * Ghanaian mobile numbers, as customers actually type them.
 *
 * The same number arrives as 0241234567, 233241234567, +233 24 123 4567 or
 * "024-123 4567" depending on where it was copied from. All four have to be
 * accepted — rejecting a number somebody can be reached on is a lost order —
 * but "+++ (((" has to be refused, because the shop rings this number to
 * confirm every delivery and an unreachable one means the order dies quietly.
 */

/** 9 significant digits after the country code or the leading 0. */
const NATIONAL_DIGITS = 9;

export const digitsOf = (value: string): string => value.replace(/\D/g, "");

/**
 * Reduces any accepted spelling to the nine national digits, or null when the
 * input is not a number anybody could be called on.
 */
export function toNationalDigits(value: string): string | null {
  let digits = digitsOf(value);

  // Country code, with or without the + that got lost in a copy-paste.
  if (digits.startsWith("233")) {
    digits = digits.slice(3);
  }

  // Trunk prefix: 024… is the same subscriber as 24….
  if (digits.length === NATIONAL_DIGITS + 1 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits.length === NATIONAL_DIGITS ? digits : null;
}

export const isValidGhanaPhone = (value: string): boolean =>
  toNationalDigits(value) !== null;

/**
 * The form that goes to the server and onto the order: 0XX XXX XXXX. One shape
 * in the database means staff reading a delivery run see one shape, and a
 * number is never dialled wrong because it was stored as +233 on one row and
 * 024 on the next.
 */
export function formatGhanaPhone(value: string): string {
  const national = toNationalDigits(value);
  if (!national) return value.trim();

  return `0${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
}
