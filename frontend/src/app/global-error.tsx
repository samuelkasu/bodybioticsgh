"use client";

import { useEffect } from "react";

/**
 * Only reached when the root layout itself fails, so it replaces the entire
 * document — the fonts, the header and the Tailwind layer are all gone by
 * definition. Hence the inline styles: this file cannot assume a stylesheet
 * loaded, and a plain readable page beats a branded one that renders as
 * unstyled text.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error", error);
  }, [error]);

  return (
    <html lang="en-GH">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "32px",
          textAlign: "center",
          backgroundColor: "#ffffff",
          color: "#1c1917",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 600 }}>
          Body Biotics is temporarily unavailable
        </h1>
        <p style={{ margin: 0, maxWidth: "32rem", color: "#57534e" }}>
          Something failed while loading the app. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "12px",
            minHeight: "44px",
            padding: "0 24px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "#002526",
            color: "#ffffff",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
        {error.digest && (
          <p style={{ marginTop: "24px", fontSize: "12px", color: "#78716c" }}>
            Reference: {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
