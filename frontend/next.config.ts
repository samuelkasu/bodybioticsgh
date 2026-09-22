import type { NextConfig } from "next";

// The browser never talks to the API directly. Everything under /api is
// proxied from this origin, so `bb_session` stays a first-party cookie —
// Safari blocks third-party cookies outright in an installed PWA, and CORS
// preflights would add a round-trip to every mutation on mobile data.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:5080";

// Everything the storefront loads comes from this origin, so the policy is
// mostly `'self'`. Two compromises worth knowing about:
//
// - `'unsafe-inline'` on scripts. Next's hydration bootstrap is an inline
//   script; the alternative is a per-request nonce from proxy.ts, which makes
//   every page dynamic and costs the static shell this PWA is built around.
//   With no dangerouslySetInnerHTML anywhere and React escaping by default,
//   the injection surface is small — but this directive is the weak link, so
//   do not add third-party script origins to it casually.
// - `'unsafe-inline'` on styles is required by next/font and Tailwind.
//
// `frame-ancestors`, `base-uri`, `form-action` and `object-src` cost nothing
// and are the directives that actually stop clickjacking and form hijacking.
// A payment provider will need its own script-src, connect-src and frame-src
// entries added here.
//
// React's dev build needs `'unsafe-eval'` (it reconstructs callstacks from the
// server environment with eval); without it the dev overlay errors on every
// page load. It is added only when running `next dev`, never in a build.
const isDev = process.env.NODE_ENV === "development";

// NEXT_PUBLIC_SITE_URL is inlined at build time and feeds every canonical tag,
// every Open Graph URL, the sitemap and the Sitemap: line in robots.txt. A
// production image built without it tells Google the entire catalogue lives on
// localhost, and the only way to correct that is to rebuild — so fail here,
// where the message is read, rather than after the domain is pointed at it.
//
// Checked at config load, which runs for `next build` and `next start` but also
// for `serwist build`, so the service worker cannot be generated against the
// wrong origin either.
if (process.env.NODE_ENV === "production") {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL is not set. A production build needs the real " +
        "origin (https://bodybioticsgh.com) — it is baked into canonicals, " +
        "the sitemap and robots.txt and cannot be changed at runtime.",
    );
  }

  const { protocol, hostname } = new URL(siteUrl);

  if (protocol !== "https:") {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL is "${siteUrl}". Canonical and Open Graph URLs must be HTTPS.`,
    );
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL is "${siteUrl}". Set it to the real domain before ` +
        "building for production, or every indexable URL will be published as localhost.",
    );
  }
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // No `upgrade-insecure-requests`. It rewrites the service worker's precache
  // fetches to https on a plain-http origin, they fail with a TLS error, the
  // worker never installs and the app silently loses offline support — which is
  // exactly what happened when it was added. Strict-Transport-Security below
  // forces HTTPS at the origin, which is the stronger guarantee anyway, and
  // every source here is 'self' so there is no mixed content to upgrade.
].join("; ");

const nextConfig: NextConfig = {
  // Ships a self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  images: {
    // WebP only. AVIF is smaller, but sharp's AVIF encoder hangs on this
    // toolchain — any image a browser that accepts AVIF asks for never comes
    // back, so the page renders with holes where photos should be. WebP is
    // supported by every browser this store targets.
    formats: ["image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    // Next 16 only serves qualities named here. 75 is the default every
    // product photo uses; 62 is for the full-bleed archive banner, which sits
    // under a black wash behind the title.
    qualities: [62, 75],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
      // Review photos are written to the API's disk and served from there.
      {
        source: "/uploads/:path*",
        destination: `${API_ORIGIN}/uploads/:path*`,
      },
    ];
  },
  /**
   * The old WooCommerce URLs, kept alive.
   *
   * This storefront replaces a site that already ranks, and the mirror it was
   * imported from shows exactly which shapes existed: /product/<slug>/,
   * /product-category/<slug>/, /product-tag/<slug>/ and /brand/<slug>/.
   * Three of those four are unchanged here — only the category archive moved,
   * and Next normalises the trailing slash itself.
   *
   * 308s, not 307s: a permanent redirect is what passes the old page's ranking
   * to the new one. A temporary redirect asks Google to keep the old URL.
   */
  async redirects() {
    return [
      {
        source: "/product-category/:slug",
        destination: "/category/:slug",
        permanent: true,
      },
      // WooCommerce paged archives. The page number is dropped deliberately:
      // the new archive paginates by query string, and page 7 of a category
      // that has since shrunk is a 404 waiting to happen.
      {
        source: "/product-category/:slug/page/:page",
        destination: "/category/:slug",
        permanent: true,
      },
      { source: "/shop/page/:page", destination: "/shop", permanent: true },
      {
        source: "/product-tag/:slug/page/:page",
        destination: "/product-tag/:slug",
        permanent: true,
      },
      // WooCommerce's account area, whatever sub-page was linked.
      { source: "/my-account/:path*", destination: "/account", permanent: true },

      // The old site's own page slugs, taken from its sitemap while it was
      // still up. WordPress named several of these with a "-2" suffix because
      // the original slug was already taken by a WooCommerce system page, and
      // those are the URLs that ended up indexed. Without these, /about-us and
      // /contact-us — both of which rank — 404 the moment WordPress is
      // switched off.
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/home-page", destination: "/", permanent: true },
      { source: "/cart-2", destination: "/cart", permanent: true },
      { source: "/checkout-2", destination: "/checkout", permanent: true },
      { source: "/my-account-2", destination: "/account", permanent: true },
      { source: "/manage-profile", destination: "/account", permanent: true },
      { source: "/manage-profile-2", destination: "/account", permanent: true },
      { source: "/lets-keep-in-touch", destination: "/contact", permanent: true },
      // WordPress search.
      { source: "/index.php", destination: "/", permanent: true },
      // RSS links are scattered through any WordPress theme and there is no
      // feed here to serve.
      { source: "/feed", destination: "/", permanent: true },
      { source: "/comments/feed", destination: "/", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          // Never let a CDN pin an old worker: the browser checks this file for
          // updates and a cached copy freezes the app on an old build.
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          // Ignored by browsers over plain HTTP, so this is inert in dev and
          // takes effect the moment the site is served over TLS. No `preload`:
          // that is a one-way submission to a browser-vendor list, and it
          // commits every subdomain to HTTPS before they exist.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
