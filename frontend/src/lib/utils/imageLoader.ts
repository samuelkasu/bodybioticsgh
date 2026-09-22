/**
 * The URL `next/image` would emit for a given source, for the few places that
 * need the optimized file from CSS rather than from an `<img>`.
 *
 * Why CSS at all: a card's hover photo is the second-largest download on the
 * shop grid (~300KB of a 1.26MB page), and a phone can never show it. An
 * `<img>` is fetched whether or not it is visible, so the only way to keep
 * those bytes off a touch device is a background-image inside
 * `@media (hover: hover)`, which the browser does not resolve when the query
 * does not match. This keeps that background on the optimizer instead of
 * pointing it at the full-size original.
 *
 * `/_next/image` and its `url`/`w`/`q` parameters are Next's public contract
 * for the optimizer endpoint, and `w` must be one of `images.deviceSizes` or
 * `images.imageSizes` in next.config.ts or the endpoint answers 400.
 */
export function optimizedImageUrl(src: string, width: number, quality = 75): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
