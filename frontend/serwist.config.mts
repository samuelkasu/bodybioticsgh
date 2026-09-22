import { serwist } from "@serwist/next/config";

/**
 * Serwist runs as a post-build step rather than a webpack plugin: Next 16
 * builds with Turbopack by default, and the plugin path forces the legacy
 * webpack builder. `serwist build` reads the finished .next output and emits
 * public/sw.js with the precache manifest injected.
 *
 * `.mts` (not `.ts`) because the Serwist CLI imports this file directly as an
 * ES module; a plain `.ts` is loaded as CommonJS and its top-level await fails.
 */
export default await serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Precache the app shell only. The default pattern sweeps in all of
  // public/, which here means ~17MB of product photography and video —
  // downloading that on first visit over mobile data is indefensible.
  globPatterns: [
    ".next/static/**/*.{js,css,woff,woff2}",
    "public/icons/*.png",
    "public/manifest.webmanifest",
  ],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
});
