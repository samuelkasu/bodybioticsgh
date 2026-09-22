import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest. Android (Chrome) reads all of this; iOS
 * Safari only honours name, short_name, icons, display and start_url — the
 * rest is documented in docs/SETUP.md under cross-platform gotchas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Body Biotics GH",
    short_name: "Body Biotics",
    description: "Skincare and body care, delivered across Ghana.",
    // Query param marks installed-app traffic in analytics without changing routing.
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    lang: "en-GH",
    dir: "ltr",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        // Android adaptive icons crop to a circle; a maskable variant with
        // padding stops the logo losing its edges on Pixel/Samsung launchers.
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Shop", url: "/products", description: "Browse the catalogue" },
      { name: "Cart", url: "/cart", description: "Review your cart" },
      { name: "Orders", url: "/orders", description: "Track your orders" },
    ],
  };
}
