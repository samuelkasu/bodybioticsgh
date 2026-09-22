/**
 * One-off importer: turns the static WordPress/WooCommerce mirror into seed
 * data this project owns.
 *
 *   npx tsx scripts/import-catalog.ts "C:/Users/siba/Desktop/scripping/bodybiotics-local"
 *
 * Writes:
 *   backend/seed/catalog.json          canonical catalogue, committed
 *   backend/seed/import-report.md      what matched, what did not — review this
 *   frontend/public/catalog/<slug>/*   WebP at three widths
 *
 * Nothing at build or run time reads the mirror; this runs once and its output
 * is the source of truth from then on.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const MIRROR = process.argv[2] ?? "C:/Users/siba/Desktop/scripping/bodybiotics-local";
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SEED_DIR = path.join(REPO_ROOT, "backend", "seed");
const IMAGE_OUT = path.join(REPO_ROOT, "frontend", "public", "catalog");

/** Where photos the scraper could not save are fetched to, once each. */
const REMOTE_CACHE = path.join(os.tmpdir(), "bodybiotics-import-remote");
const remoteFetches: string[] = [];

/** Widths chosen for the grid (2-up on a phone), the detail view, and a zoom source. */
const IMAGE_WIDTHS = [400, 800] as const;
const MAIN_WIDTH = 1200;

/**
 * Brand names the title-matching heuristic cannot reach, keyed by product slug
 * prefix. A name here that the mirror never scraped is still created — several
 * real brands have no archive page in the scrape.
 */
const BRAND_OVERRIDES: Record<string, string> = {
  "advanced-korean": "Advanced Korean Skin",
  "bath-and-bodyworks": "Baths and Body Works",
  "bio-collagen": "Medicube",
  "care-nel": "CareNel",
  "dear-face": "Dear Face",
  "dr-althea": "Dr. Althea",
  "mary-and-may": "Mary & May",
  mixsoon: "Mixsoon",
  palmers: "Palmer's",
  plante: "Plante",
  "retin-a": "Retin A",
  rounshun: "Rounshun",
  "skin-1004": "Skin1004",
  tampax: "Tampax Pearl",
  "womens-best": "Women's Best",
};

/**
 * Brand titles come straight out of `<title>`, so they still carry HTML
 * entities: without this, "Palmer&#039;s" never matches "Palmer's".
 */
export const decodeEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

type LdNode = {
  "@type"?: string;
  name?: string;
  description?: string;
  sku?: string;
  image?: { url?: string } | string;
  offers?: { price?: string; priceCurrency?: string; availability?: string } | unknown[];
  itemListElement?: { position?: number; item?: { name?: string; "@id"?: string } }[];
};

export type CatalogProduct = {
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
  /** Second gallery photo, shown when the card is hovered. */
  hoverImage: string | null;
};

type Catalog = {
  generatedAt: string;
  source: string;
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
  products: CatalogProduct[];
};

export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Money on the wire and in the database is integer minor units. */
export const toMinorUnits = (price: string | number | undefined): number => {
  const value = typeof price === "string" ? Number.parseFloat(price) : (price ?? 0);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
};

const readJsonLd = (html: string): LdNode[] => {
  const blocks = html.matchAll(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  );
  const nodes: LdNode[] = [];

  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw ?? "") as { "@graph"?: LdNode[] } & LdNode;
      nodes.push(...(parsed["@graph"] ?? [parsed]));
    } catch {
      // A malformed block is not worth failing the whole import over.
    }
  }

  return nodes;
};

/** Breadcrumb position 3 is the product's category; 1 is Home and 2 is Shop. */
const categoryFromBreadcrumb = (nodes: LdNode[]): string | null => {
  const list = nodes.find((node) => node["@type"] === "BreadcrumbList");
  const entry = list?.itemListElement?.find((item) => item.position === 3);
  return entry?.item?.name?.trim() ?? null;
};

/**
 * The rendered product photo. Preferred over the JSON-LD image because the
 * source site gets that wrong on some products — every A-Ret gel, for
 * instance, advertises a Biodance logo in its structured data while the page
 * itself shows the correct tube.
 */
const featuredImageFromDom = (html: string): string | null => {
  const post = /<img[^>]*class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"/.exec(html);
  if (post?.[1]) return post[1];

  // Some templates emit the class after src.
  const reversed = /<img[^>]*src="([^"]+)"[^>]*class="[^"]*wp-post-image/.exec(html);
  return reversed?.[1] ?? null;
};

/**
 * Resolves a photo referenced by a page to a file on disk.
 *
 * The scraper left a handful of images as absolute URLs — it could not save
 * the ones whose names carry Thai characters or an en dash — and those
 * products imported with no photo at all, so the storefront fell back to the
 * company logo on a product card. Anything still remote is fetched once from
 * the live site into a temp folder; the mirror is left untouched.
 */
async function resolveSource(reference: string): Promise<string | null> {
  const remote = /^https?:/i.test(reference);
  const name = remote
    ? decodeURIComponent(path.basename(new URL(reference).pathname))
    : path.basename(reference);

  const mirrored = path.join(MIRROR, "images", name);
  if (existsSync(mirrored)) return mirrored;
  if (!remote) return null;

  await mkdir(REMOTE_CACHE, { recursive: true });
  const cached = path.join(REMOTE_CACHE, name);
  if (existsSync(cached)) return cached;

  try {
    const response = await fetch(encodeURI(reference));
    if (!response.ok) return null;
    await writeFile(cached, Buffer.from(await response.arrayBuffer()));
    remoteFetches.push(name);
    return cached;
  } catch {
    return null;
  }
}

/** First of the candidates that exists on disk, in page order. */
async function firstResolvable(references: string[]): Promise<string | null> {
  for (const reference of references) {
    const resolved = await resolveSource(reference);
    if (resolved) return resolved;
  }

  return null;
}

/**
 * File name without its extension or WordPress's "-600x600" size suffix, so
 * two renditions of the same photo compare equal.
 */
export const stem = (file: string): string =>
  path
    .basename(file, path.extname(file))
    .replace(/-\d+x\d+$/, "")
    .toLowerCase();

/**
 * Every photo in the product gallery, in the order the page lists them. The
 * first is the featured shot; the second is what the original swaps to when a
 * card is hovered.
 */
const galleryFromDom = (html: string): string[] =>
  [
    ...html.matchAll(
      /class="woocommerce-product-gallery__image"[^>]*>\s*<a href="([^"]+)"/g,
    ),
  ].map(([, file]) => file as string);

const firstOffer = (offers: LdNode["offers"]) =>
  Array.isArray(offers) ? ((offers[0] ?? {}) as Record<string, string>) : (offers ?? {});

async function collectBrands(files: string[]): Promise<Map<string, string>> {
  const brands = new Map<string, string>();

  for (const file of files.filter((name) => name.startsWith("brand-"))) {
    const html = await readFile(path.join(MIRROR, file), "utf8");
    const title = /<title>(.*?)<\/title>/.exec(html)?.[1] ?? "";
    const name = decodeEntities(title)
      .replace(/\s*-\s*Body Biotic GH\s*$/i, "")
      .trim();
    if (name) brands.set(slugify(name), name);
  }

  // Brands referenced by an override but missing an archive page in the mirror.
  for (const name of Object.values(BRAND_OVERRIDES)) {
    brands.set(slugify(name), name);
  }

  return brands;
}

/**
 * The scraped brand archives are useless — every one of them renders the same
 * default 24-product loop — so brand membership is inferred from the product
 * title instead, longest name first so "Advanced Clinicals" wins over "Alada".
 */
function matchBrand(
  productSlug: string,
  productName: string,
  brands: Map<string, string>,
): string | null {
  for (const [prefix, brandName] of Object.entries(BRAND_OVERRIDES)) {
    if (productSlug.startsWith(prefix)) return slugify(brandName);
  }

  const haystack = productName.toLowerCase();
  const ranked = [...brands.entries()].sort(([, a], [, b]) => b.length - a.length);

  for (const [slug, name] of ranked) {
    if (haystack.includes(name.toLowerCase())) return slug;
  }

  return null;
}

async function convertImage(sourceFile: string, productSlug: string): Promise<string[]> {
  const outDir = path.join(IMAGE_OUT, productSlug);
  await mkdir(outDir, { recursive: true });

  const written: string[] = [];

  for (const width of IMAGE_WIDTHS) {
    const target = path.join(outDir, `${width}.webp`);
    await sharp(sourceFile)
      .resize(width, width, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(target);
    written.push(`/catalog/${productSlug}/${width}.webp`);
  }

  const main = path.join(outDir, "main.webp");
  await sharp(sourceFile)
    .resize(MAIN_WIDTH, MAIN_WIDTH, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(main);

  // Primary first: the API marks images[0] as the card image.
  return [`/catalog/${productSlug}/main.webp`, ...written];
}

/** One width only: the hover swap is never shown larger than a card. */
async function convertHoverImage(
  sourceFile: string,
  productSlug: string,
): Promise<string> {
  const outDir = path.join(IMAGE_OUT, productSlug);
  await mkdir(outDir, { recursive: true });

  await sharp(sourceFile)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(outDir, "hover.webp"));

  return `/catalog/${productSlug}/hover.webp`;
}

async function main(): Promise<void> {
  const files = await readdir(MIRROR);
  const productFiles = files.filter(
    (name) =>
      name.startsWith("product-") &&
      name.endsWith(".html") &&
      // product-category-*.html and product-tag-*.html are archive pages, not
      // products. They carry a Product JSON-LD node for the first item they
      // list, so without this they import as 42 phantom duplicates.
      !name.startsWith("product-category-") &&
      !name.startsWith("product-tag-"),
  );

  const brands = await collectBrands(files);
  const categories = new Map<string, string>();
  const products: CatalogProduct[] = [];

  const skipped: string[] = [];
  const noBrand: string[] = [];
  const noImage: string[] = [];
  const zeroPrice: string[] = [];

  for (const file of productFiles) {
    const slug = file.replace(/^product-/, "").replace(/\.html$/, "");
    const html = await readFile(path.join(MIRROR, file), "utf8");
    const nodes = readJsonLd(html);
    const product = nodes.find((node) => node["@type"] === "Product");

    if (!product?.name) {
      // Tag archives (product-tag-*.html) look like product pages but are not.
      skipped.push(file);
      continue;
    }

    const offer = firstOffer(product.offers) as Record<string, string>;
    const priceMinor = toMinorUnits(offer["price"]);
    const inStock = (offer["availability"] ?? "").endsWith("InStock");

    if (priceMinor === 0) zeroPrice.push(slug);

    const categoryName = categoryFromBreadcrumb(nodes);
    let categorySlug: string | null = null;
    if (categoryName) {
      categorySlug = slugify(categoryName);
      categories.set(categorySlug, categoryName);
    }

    const brandSlug = matchBrand(slug, product.name, brands);
    if (!brandSlug) noBrand.push(`${slug} — ${product.name}`);

    const jsonLdImage =
      typeof product.image === "string" ? product.image : product.image?.url;
    const gallery = galleryFromDom(html);
    // DOM first, structured data only as a fallback. The gallery backs the
    // featured shot up: on a few products that photo never made it into the
    // mirror, and a card showing the shop logo is worse than a second angle.
    const candidates = [
      featuredImageFromDom(html),
      ...gallery,
      jsonLdImage ?? null,
    ].filter((value): value is string => Boolean(value));

    const source = await firstResolvable(candidates);
    let images: string[] = [];

    if (source) {
      try {
        images = await convertImage(source, slug);
      } catch {
        noImage.push(slug);
      }
    } else {
      noImage.push(slug);
    }

    // The featured photo appears in the gallery too, at a different width, so
    // the swap is the first gallery entry whose base name differs from it.
    const featuredStem = source ? stem(source) : null;
    const hoverFile = gallery.find((file) => stem(file) !== featuredStem);
    let hoverImage: string | null = null;

    if (hoverFile && images.length > 0) {
      const hoverSource = await resolveSource(hoverFile);
      try {
        if (hoverSource) hoverImage = await convertHoverImage(hoverSource, slug);
      } catch {
        // A missing second photo is not worth failing the import over; the
        // card simply keeps showing the featured shot on hover.
      }
    }

    products.push({
      slug,
      name: decodeEntities(product.name).trim(),
      // Some SKUs come through as numbers in the source JSON-LD.
      sku: product.sku == null ? null : String(product.sku).trim(),
      description: decodeEntities(product.description ?? "").trim(),
      priceMinor,
      currency: offer["priceCurrency"] ?? "GHS",
      // The mirror only exposes in/out of stock, not counts. Seed a working
      // level for stocked items so checkout has something to decrement.
      stock: inStock ? 25 : 0,
      // A product with no price cannot be sold; hide it rather than list it at zero.
      active: priceMinor > 0,
      categorySlug,
      brandSlug,
      images,
      hoverImage,
    });
  }

  products.sort((a, b) => a.slug.localeCompare(b.slug));

  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    source: "bodybioticsgh.com static mirror",
    categories: [...categories]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    brands: [...brands]
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    products,
  };

  await mkdir(SEED_DIR, { recursive: true });
  await writeFile(
    path.join(SEED_DIR, "catalog.json"),
    `${JSON.stringify(catalog, null, 2)}\n`,
    "utf8",
  );

  const report = [
    "# Catalogue import report",
    "",
    `Generated ${catalog.generatedAt} from \`${MIRROR}\`.`,
    "",
    "| metric | count |",
    "| --- | --- |",
    `| product pages scanned | ${productFiles.length} |`,
    `| products imported | ${products.length} |`,
    `| skipped (no Product JSON-LD) | ${skipped.length} |`,
    `| categories | ${catalog.categories.length} |`,
    `| brands | ${catalog.brands.length} |`,
    `| products with a brand | ${products.filter((p) => p.brandSlug).length} |`,
    `| products in stock | ${products.filter((p) => p.stock > 0).length} |`,
    `| products hidden (no price) | ${products.filter((p) => !p.active).length} |`,
    `| products without an image | ${noImage.length} |`,
    `| products with a hover photo | ${products.filter((p) => p.hoverImage).length} |`,
    `| photos fetched from the live site | ${remoteFetches.length} |`,
    "",
    "## Skipped files",
    "",
    skipped.length ? skipped.map((f) => `- ${f}`).join("\n") : "_none_",
    "",
    "## Zero-price products (hidden)",
    "",
    zeroPrice.length ? zeroPrice.map((s) => `- ${s}`).join("\n") : "_none_",
    "",
    "## Products without an image",
    "",
    noImage.length ? noImage.map((s) => `- ${s}`).join("\n") : "_none_",
    "",
    "## Products with no brand match",
    "",
    "Left without a brand rather than guessed wrong. Add a prefix to",
    "`BRAND_OVERRIDES` in `frontend/scripts/import-catalog.ts` and re-run to fix.",
    "",
    noBrand.length ? noBrand.map((s) => `- ${s}`).join("\n") : "_none_",
    "",
  ].join("\n");

  await writeFile(path.join(SEED_DIR, "import-report.md"), report, "utf8");

  console.log(
    `imported ${products.length} products, ${catalog.categories.length} categories, ` +
      `${catalog.brands.length} brands (${noBrand.length} unmatched, ${noImage.length} without images)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
