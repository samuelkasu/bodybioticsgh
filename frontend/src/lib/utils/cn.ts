/**
 * Joins class names, dropping falsy values. Deliberately not clsx +
 * tailwind-merge: nothing here relies on later classes overriding earlier ones,
 * and two dependencies for a five-line function is not a trade worth making.
 */
export const cn = (...values: (string | false | null | undefined)[]): string =>
  values.filter(Boolean).join(" ");
