import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * E2E runs against a production build, not `next dev`: the service worker only
 * exists in a production build, so an offline test against dev proves nothing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Mobile first, literally: these two are the default gate.
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] },
    },
    {
      // WebKit stands in for iOS Safari. It is not identical to a real iPhone
      // (no home-screen install, different storage eviction), so treat it as a
      // regression net and still smoke-test on a real device before release.
      name: "ios-safari",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
