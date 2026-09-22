import { ImageResponse } from "next/og";

import { site } from "@/lib/site";

/**
 * The picture that shows when a link to the shop is pasted into WhatsApp,
 * Instagram DMs or X. Generated rather than a file in /public so it cannot
 * drift from the store's name and tagline, and so there is no 800KB photo to
 * keep in the repository.
 *
 * Deliberately typographic. The hero artwork is a tall crop that loses the
 * models' faces at 1200×630, and a wordmark on the brand's own green reads at
 * thumbnail size — which is the size this is actually seen at.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${site.name} — ${site.tagline}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        backgroundColor: "#002526",
        color: "#ffffff",
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {site.name}
      </div>
      <div style={{ marginTop: 24, fontSize: 40, color: "#d9e2e2", maxWidth: 900 }}>
        {site.tagline}
      </div>
      <div style={{ marginTop: 48, fontSize: 28, color: "#9fb3b3" }}>
        bodybioticsgh.com
      </div>
    </div>,
    size,
  );
}
