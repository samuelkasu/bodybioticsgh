/**
 * Re-points every product in the seed catalogue at the brand the old site
 * actually files it under, and renames brands to the slugs Google has indexed.
 *
 * The original import damaged brands in two ways. Apostrophes were flattened
 * into a separate letter — Palmer's became `palmer-s`, Nature's Way became
 * `nature-s-way` — so the brand page lives at a URL nobody links to while the
 * indexed `/brand/palmers` has nothing behind it. And for a dozen products the
 * brand was dropped altogether, leaving `brandSlug: null` and a brand page with
 * no products on it.
 *
 * Both show up the same way: /brand/<slug> URLs that Google has indexed and the
 * new site would answer with a 404 or an empty page.
 *
 * The WooCommerce Store API is the authority here, because its slug is the one
 * in the indexed URL.
 *
 * ONE-SHOT, like the product recovery: this cannot run once WordPress is off.
 *
 *   npx tsx scripts/reconcile-brands.ts           # report only
 *   npx tsx scripts/reconcile-brands.ts --write   # apply
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const OLD_SITE = "https://bodybioticsgh.com";
const CATALOG = path.join(process.cwd(), "..", "backend", "seed", "catalog.json");

type Term = { slug: string; name: string };

type Product = {
  slug: string;
  name: string;
  brandSlug: string | null;
  [key: string]: unknown;
};

type Catalog = {
  generatedAt: string;
  source: string;
  categories: Term[];
  brands: Term[];
  products: Product[];
};

async function brandsFor(slug: string): Promise<Term[] | null> {
  const response = await fetch(
    `${OLD_SITE}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`,
  );

  if (!response.ok) return null;

  const [product] = (await response.json()) as { brands?: Term[] }[];

  return product ? (product.brands ?? []) : null;
}

/**
 * Which of the old site's brand terms is really the brand.
 *
 * WooCommerce lets a product carry several, and this shop used that for product
 * lines as much as for makers — a SKIN1004 cleanser is tagged "SKIN1004",
 * "Centella" and "Madagascar Centella". Taking the first would move the product
 * off its maker onto a range name and leave /brand/skin1004 empty, which is the
 * very problem this script exists to fix.
 *
 * So: what the catalogue already says wins whenever the old site agrees it is
 * one of the product's brands. Only a brand the old site does not recognise at
 * all — or a missing one — gets replaced, and then the term whose slug the
 * product slug actually starts with is preferred over whatever came first.
 */
function chooseBrand(current: string | null, candidates: Term[], productSlug: string) {
  // Destructured rather than a `length === 0` guard: under
  // noUncheckedIndexedAccess a length check does not narrow `candidates[0]`,
  // so the fallback below would type as `Term | undefined` and every caller
  // would have to re-check a brand this function has already guaranteed.
  const [first] = candidates;
  if (!first) return null;

  const agreed = candidates.find((brand) => brand.slug === current);
  if (agreed) return { brand: agreed, ambiguous: false };

  const compact = productSlug.replace(/-/g, "");
  const named = candidates.find((brand) =>
    compact.startsWith(brand.slug.replace(/-/g, "")),
  );

  return {
    brand: named ?? first,
    // Nothing in the name points at one, so a person should look at it.
    ambiguous: !named && candidates.length > 1,
  };
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");
  const catalog = JSON.parse(await readFile(CATALOG, "utf8")) as Catalog;

  const changes: string[] = [];
  const referenced = new Map<string, Term>();
  let unchanged = 0;
  let unknown = 0;

  const ambiguous: string[] = [];

  for (const product of catalog.products) {
    const candidates = await brandsFor(product.slug);

    if (candidates === null) {
      // Left exactly as it is. A product the old site no longer answers for is
      // not evidence that its brand is wrong.
      unknown++;
      if (product.brandSlug) {
        const existing = catalog.brands.find((brand) => brand.slug === product.brandSlug);
        if (existing) referenced.set(existing.slug, existing);
      }
      continue;
    }

    const chosen = chooseBrand(product.brandSlug, candidates, product.slug);

    if (!chosen) {
      // The old site knows the product but files it under no brand at all.
      // Keep whatever the catalogue already had — dropping it here would leave
      // the product pointing at a brand the rebuilt list no longer contains.
      unknown++;
      if (product.brandSlug) {
        const existing = catalog.brands.find((brand) => brand.slug === product.brandSlug);
        if (existing) referenced.set(existing.slug, existing);
      }
      continue;
    }

    referenced.set(chosen.brand.slug, chosen.brand);

    if (product.brandSlug === chosen.brand.slug) {
      unchanged++;
      continue;
    }

    changes.push(
      `${product.slug}\n    ${product.brandSlug ?? "(none)"} -> ${chosen.brand.slug}`,
    );

    if (chosen.ambiguous) {
      ambiguous.push(
        `${product.slug} — old site offers ${candidates.map((b) => b.slug).join(", ")}`,
      );
    }

    if (write) product.brandSlug = chosen.brand.slug;
  }

  // Rebuild the brand list from what products actually reference, keeping the
  // old site's names. A brand nothing points at is dropped: its page would
  // render empty, and an empty page is worse in the index than no page.
  const rebuilt = [...referenced.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const dropped = catalog.brands
    .filter((brand) => !referenced.has(brand.slug))
    .map((brand) => brand.slug);

  console.log(`products checked : ${catalog.products.length}`);
  console.log(`already correct  : ${unchanged}`);
  console.log(`not on old site  : ${unknown} (left alone)`);
  console.log(`re-pointed       : ${changes.length}\n`);

  for (const change of changes) console.log(`  ${change}`);

  console.log(`\nbrands: ${catalog.brands.length} -> ${rebuilt.length}`);
  console.log(`dropped (no products): ${dropped.join(", ") || "(none)"}`);

  if (ambiguous.length > 0) {
    console.log("\nworth a human look — several brand terms, none matching the name:");
    for (const note of ambiguous) console.log(`  - ${note}`);
  }

  if (!write) {
    console.log("\nReport only. Re-run with --write to apply.");
    return;
  }

  catalog.brands = rebuilt;
  catalog.generatedAt = new Date().toISOString();

  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log("\nWritten.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
