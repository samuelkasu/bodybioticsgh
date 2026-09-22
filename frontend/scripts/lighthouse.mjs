/**
 * Lighthouse against a real production build.
 *
 * Running the DevTools Lighthouse panel on `next dev` measures the wrong
 * thing twice over: the dev bundle ships the Next devtools (~244KB) and skips
 * minification, and the panel drives your everyday browser profile, so ad
 * blockers and React DevTools are scored as if they were part of the site.
 * Both effects are large enough to swamp the app — an extension-heavy profile
 * can add more transfer weight than the whole storefront.
 *
 * So this builds, serves, and audits in headless Chrome with a throwaway
 * profile and no extensions. Numbers from here are comparable run to run; the
 * DevTools panel on :3000 is not.
 *
 *   npm run perf                  # /, /shop, /about
 *   npm run perf -- /product/foo  # specific paths
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3123;
const ORIGIN = `http://127.0.0.1:${PORT}`;

// Canonicals and the sitemap are baked in at build time, and next.config
// refuses a production build without a real HTTPS origin.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bodybioticsgh.com";

const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["/", "/shop", "/about"];

const env = { ...process.env, NEXT_PUBLIC_SITE_URL: SITE_URL, NODE_ENV: "production" };

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true, stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Server did not answer on ${ORIGIN}`);
}

console.log(`Building for ${SITE_URL}…`);
await run("npx", ["next", "build"], { env });

const server = spawn("npx", ["next", "start", "--port", String(PORT)], {
  shell: true,
  env,
  stdio: "ignore",
});

let failed = false;

try {
  await waitForServer();
  console.log(`Serving on ${ORIGIN}\n`);

  const rows = [];

  for (const path of paths) {
    // A fresh profile per run: no extensions, no service worker left over from
    // the previous page, no IndexedDB from a real browsing session.
    const profile = mkdtempSync(join(tmpdir(), "bb-lh-"));
    const report = join(profile, "report.json");

    await run(
      "npx",
      [
        "lighthouse",
        `${ORIGIN}${path}`,
        "--quiet",
        "--output=json",
        `--output-path=${report}`,
        "--form-factor=mobile",
        "--screenEmulation.mobile",
        "--throttling-method=simulate",
        "--only-categories=performance,accessibility,best-practices,seo",
        `--chrome-flags=--headless=new --no-sandbox --disable-extensions --user-data-dir=${profile}`,
      ],
      // chrome-launcher fails to delete its own temp directory on Windows
      // after the report is already written, so a non-zero exit here does not
      // mean the audit failed. The report is read below either way.
      { stdio: "ignore" },
    ).catch(() => {});

    const { default: result } = await import(`file://${report}`, {
      with: { type: "json" },
    });

    const score = (id) => Math.round((result.categories[id]?.score ?? 0) * 100);

    rows.push({
      path,
      perf: score("performance"),
      a11y: score("accessibility"),
      bp: score("best-practices"),
      seo: score("seo"),
      LCP: result.audits["largest-contentful-paint"].displayValue,
      TBT: result.audits["total-blocking-time"].displayValue,
      CLS: result.audits["cumulative-layout-shift"].displayValue,
    });

    rmSync(profile, { recursive: true, force: true });
  }

  console.table(rows);

  // Google's Core Web Vitals thresholds, not Lighthouse's category score.
  const slow = rows.filter((row) => Number.parseFloat(row.LCP) > 2.5);
  if (slow.length > 0) {
    console.log(`\nLCP over 2.5s on: ${slow.map((row) => row.path).join(", ")}`);
    failed = true;
  }
} finally {
  server.kill();
}

process.exit(failed ? 1 : 0);
