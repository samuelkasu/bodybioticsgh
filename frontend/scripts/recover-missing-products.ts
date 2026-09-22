/**
 * Pulls products that exist on the old WooCommerce site but never made it into
 * backend/seed/catalog.json, and folds them in.
 *
 * Why this exists: diffing the live sitemap against the new one turned up 28
 * product URLs and 15 brand URLs that Google has indexed but the new catalogue
 * has never heard of. Ten of those brands were already in catalog.json with no
 * products attached, so the gap is one and the same — these products are the
 * only ones those brands had.
 *
 * Images are downloaded and re-encoded locally, deliberately. Pointing at
 * wp-content would work right up until WordPress is switched off, and then
 * every one of these products would lose its photos.
 *
 * Source of truth is the WooCommerce Store API, which is public and returns
 * name, prices, stock, categories, brands and the full gallery:
 *   /wp-json/wc/store/v1/products?slug=<slug>
 *
 * ONE-SHOT. Once WordPress is down this cannot be re-run — the data is gone.
 *
 *   npx tsx scripts/recover-missing-products.ts           # report only
 *   npx tsx scripts/recover-missing-products.ts --write   # apply
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const OLD_SITE = "https://bodybioticsgh.com";
const CATALOG = path.join(process.cwd(), "..", "backend", "seed", "catalog.json");
const PUBLIC_CATALOG = path.join(process.cwd(), "public", "catalog");

// Same ladder the original import produced, so recovered products are
// indistinguishable from the rest.
const MAIN_WIDTH = 1200;
const IMAGE_WIDTHS = [400, 800] as const;

type CatalogTerm = { slug: string; name: string };

type CatalogProduct = {
  slug: string;
  name: string;
  sku: string | null;
  description: string;
  priceMinor: number;
  currency: string;
  stock: number;
  active: boolean;
  categorySlug: string | null;
  brandSlug: string | null;
  images: string[];
  hoverImage: string | null;
};

type Catalog = {
  generatedAt: string;
  source: string;
  categories: CatalogTerm[];
  brands: CatalogTerm[];
  products: CatalogProduct[];
};

type StoreProduct = {
  name: string;
  sku: string;
  short_description: string;
  description: string;
  prices: { price: string; currency_code: string; currency_minor_unit: number };
  is_in_stock: boolean;
  low_stock_remaining: number | null;
  stock_availability: { text: string };
  categories: CatalogTerm[];
  brands?: CatalogTerm[];
  images: { src: string }[];
};

/**
 * Folder name for a product's images.
 *
 * Normally the slug, which is what every existing entry uses. A handful of the
 * old site's slugs run past 180 characters, though, and `public/catalog/<slug>/
 * main.webp` then breaks Windows' 260-character path limit — sharp fails with
 * a bare ENOENT. Those few get a truncated name plus a hash of the full slug,
 * which stays stable across runs and cannot collide.
 */
function imageDirectory(slug: string): string {
  if (slug.length <= 80) return slug;

  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

  return `${slug.slice(0, 60).replace(/-+$/, "")}-${hash.toString(36)}`;
}

/** Strips WooCommerce's HTML down to the plain sentence the card shows. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * WooCommerce reports stock as prose ("2 in stock") unless the shop is
 * configured to track it numerically. Read the number when it is there and
 * fall back to a single unit, which keeps the product buyable without
 * inventing a quantity the shop does not have.
 */
function stockFrom(product: StoreProduct): number {
  if (!product.is_in_stock) return 0;
  if (typeof product.low_stock_remaining === "number") return product.low_stock_remaining;

  const counted = /(\d+)\s+in stock/i.exec(product.stock_availability?.text ?? "");
  return counted ? Number(counted[1]) : 1;
}

async function fetchProduct(slug: string): Promise<StoreProduct | null> {
  const response = await fetch(
    `${OLD_SITE}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`,
  );

  if (!response.ok) return null;

  const [product] = (await response.json()) as StoreProduct[];
  return product ?? null;
}

/**
 * Downloads the gallery and writes the same WebP set the rest of the catalogue
 * has: a 1200px main, 400 and 800 for the grid, and one hover frame taken from
 * the second photo where the product has one.
 */
async function importImages(
  slug: string,
  sources: string[],
): Promise<{ images: string[]; hoverImage: string | null }> {
  const folder = imageDirectory(slug);
  const directory = path.join(PUBLIC_CATALOG, folder);
  await mkdir(directory, { recursive: true });

  const [featured, second] = sources;

  if (!featured) throw new Error(`${slug}: the old site lists no images`);

  const response = await fetch(featured);

  if (!response.ok) throw new Error(`${slug}: featured image ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const images: string[] = [];

  await sharp(buffer)
    .resize(MAIN_WIDTH, MAIN_WIDTH, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(directory, "main.webp"));
  images.push(`/catalog/${folder}/main.webp`);

  for (const width of IMAGE_WIDTHS) {
    await sharp(buffer)
      .resize(width, width, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(directory, `${width}.webp`));
    images.push(`/catalog/${folder}/${width}.webp`);
  }

  let hoverImage: string | null = null;

  if (second) {
    const hover = await fetch(second);

    if (hover.ok) {
      await sharp(Buffer.from(await hover.arrayBuffer()))
        .resize(800, 800, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(path.join(directory, "hover.webp"));
      hoverImage = `/catalog/${folder}/hover.webp`;
    }
  }

  return { images, hoverImage };
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");

  const catalog = JSON.parse(await readFile(CATALOG, "utf8")) as Catalog;
  const known = new Set(catalog.products.map((product) => product.slug)); 

  // The old site's own list of what it considers indexable.
  const index = await (await fetch(`${OLD_SITE}/sitemap_index.xml`)).text();
  const productMaps = [...index.matchAll(/<loc>([^<]*product-sitemap[^<]*)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url): url is string => Boolean(url));

  const slugs = new Set<string>();

  for (const map of productMaps) {
    const xml = await (await fetch(map)).text();

    for (const [, slug] of xml.matchAll(/<loc>[^<]*\/product\/([^/<]+)\/?<\/loc>/g)) {
      if (slug) slugs.add(slug);
    }
  }

  const missing = [...slugs].filter((slug) => !known.has(slug)).sort();

  console.log(`old site: ${slugs.size} products`);
  console.log(`catalog : ${catalog.products.length} products`);
  console.log(`missing : ${missing.length}\n`);

  if (missing.length === 0) return;

  const recovered: CatalogProduct[] = [];
  const skipped: string[] = [];

  for (const slug of missing) {
    const source = await fetchProduct(slug);

    if (!source) {
      skipped.push(`${slug} — not returned by the Store API`);
      continue;
    }

    const priceMinor = Number(source.prices.price);

    if (!Number.isFinite(priceMinor) || priceMinor <= 0) {
      // Imported switched off rather than dropped: the product keeps its URL
      // and its photos, and the shop decides what it costs before it sells.
      skipped.push(`${slug} — no price on the old site, imported inactive`);
    }

    const { images, hoverImage } = write
      ? await importImages(
          slug,
          source.images.map((image) => image.src),
        )
      : { images: [], hoverImage: null };

    recovered.push({
      slug,
      name: source.name,
      sku: source.sku?.trim() ? source.sku.trim() : null,
      description: plainText(source.short_description || source.description),
      priceMinor,
      currency: source.prices.currency_code || "GHS",
      stock: stockFrom(source),
      active: priceMinor > 0,
      categorySlug: source.categories[0]?.slug ?? null,
      brandSlug: source.brands?.[0]?.slug ?? null,
      images,
      hoverImage,
    });

    console.log(
      `  ${priceMinor > 0 ? "✓" : "!"} ${slug}  ${source.brands?.[0]?.slug ?? "—"}  ${(priceMinor / 100).toFixed(2)} GHS`,
    );
  }

  // Brands the recovered products reference but the catalogue has never seen.
  const brandSlugs = new Set(catalog.brands.map((brand) => brand.slug));
  const newBrands: CatalogTerm[] = [];

  for (const slug of missing) {
    const source = await fetchProduct(slug);
    const brand = source?.brands?.[0];

    if (brand && !brandSlugs.has(brand.slug)) {
      brandSlugs.add(brand.slug);
      newBrands.push({ slug: brand.slug, name: brand.name });
    }
  }

  console.log(`\nrecovered : ${recovered.length}`);
  console.log(
    `new brands: ${newBrands.map((brand) => brand.slug).join(", ") || "(none)"}`,
  );

  if (skipped.length > 0) {
    console.log("\nneeds a look:");
    for (const note of skipped) console.log(`  - ${note}`);
  }

  if (!write) {
    console.log("\nReport only. Re-run with --write to apply.");
    return;
  }

  catalog.brands = [...catalog.brands, ...newBrands].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  catalog.products = [...catalog.products, ...recovered].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
  catalog.generatedAt = new Date().toISOString();
  catalog.source = `${catalog.source} + Store API recovery`;

  await writeFile(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  console.log(
    `\nWrote ${catalog.products.length} products and ${catalog.brands.length} brands.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
