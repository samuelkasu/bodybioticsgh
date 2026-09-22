import { expect, test } from "@playwright/test";

test.describe("PWA install requirements", () => {
  test("serves a manifest with the fields Android needs to prompt install", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      icons?: { sizes?: string; purpose?: string }[];
    };

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");

    // Chrome refuses to offer installation without both a 192px and a 512px
    // icon; a maskable one keeps the Android launcher icon from being cropped.
    const sizes = (manifest.icons ?? []).map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect((manifest.icons ?? []).some((icon) => icon.purpose === "maskable")).toBe(true);
  });

  test("links the iOS-specific tags that the manifest cannot cover", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveCount(
      1,
    );

    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).toContain("width=device-width");
    // Required for safe-area insets to resolve when installed on a notched iPhone.
    expect(viewport).toContain("viewport-fit=cover");
  });

  test("ships a service worker that is not cacheable by a CDN", async ({ request }) => {
    const response = await request.get("/sw.js");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-cache");
  });

  test("sends the hardening headers on a page response", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    const csp = headers["content-security-policy"];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // upgrade-insecure-requests breaks service worker precaching over http:
    // the fetches are rewritten to https and fail, so the worker never installs.
    expect(csp).not.toContain("upgrade-insecure-requests");

    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("offline behaviour", () => {
  test("renders the offline fallback instead of a browser error page", async ({
    page,
    context,
    browserName,
  }) => {
    // Service workers are only reliably controllable in Chromium under Playwright.
    test.skip(browserName !== "chromium", "service worker control is Chromium-only here");

    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
      timeout: 20_000,
    });

    await context.setOffline(true);
    await page.goto("/a-page-that-was-never-visited");

    await expect(page.getByRole("heading", { name: /you are offline/i })).toBeVisible();
    await context.setOffline(false);
  });
});
