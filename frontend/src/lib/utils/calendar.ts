/**
 * Calendar maths for the date picker, all in local time.
 *
 * `new Date("2026-09-20")` parses as midnight UTC, which is the previous day
 * anywhere west of Greenwich — so an ISO string is never handed to the Date
 * constructor here. Values are the `yyyy-mm-dd` an <input type="date"> would
 * have posted, which is what the API already accepts.
 */

/** Monday first: the shop's week starts on a working day, not on Sunday. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Null for anything that is not a real calendar day, "2026-02-31" included. */
export function fromIso(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;

  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  // Rolls over on an impossible day, which is how an invalid one is caught.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Clamps the day when the target month is shorter, so stepping from 31 January
 * lands on 28 February rather than skipping to March.
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(date.getDate(), lastDay),
  );
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/**
 * The six rows a month grid needs, padded with the neighbouring months' days.
 * Always six so the panel does not change height as months are stepped
 * through — a grid that resizes moves the buttons out from under the pointer.
 */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // getDay() is Sunday-first; shift it so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const start = addDays(first, -lead);

  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function isBefore(date: Date, other: Date): boolean {
  return startOfDay(date).getTime() < startOfDay(other).getTime();
}

export function isAfter(date: Date, other: Date): boolean {
  return startOfDay(date).getTime() > startOfDay(other).getTime();
}

export function isOutOfRange(date: Date, min: Date | null, max: Date | null): boolean {
  return (min !== null && isBefore(date, min)) || (max !== null && isAfter(date, max));
}

const LONG = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

/** "20 Sep 2026" — what the closed picker shows. */
export const formatShort = (date: Date) => SHORT.format(date);

/** "Sunday, 20 September 2026" — what a screen reader reads on a day cell. */
export const formatLong = (date: Date) => LONG.format(date);

export const formatMonthYear = (date: Date) => MONTH_YEAR.format(date);
