import { mkdir } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Regenerates PWA icons from one source logo.
 *   npm run icons -- public/assets/LOGO.png
 *
 * Kept as a script rather than a build step: icons change once a year, and a
 * sharp dependency in the build path is a portability liability in CI images.
 */
const SOURCE = process.argv[2] ?? "public/assets/LOGO.png";
const OUT_DIR = path.join("public", "icons");
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 };

type IconSpec = {
  file: string;
  size: number;
  /** Fraction of the canvas left empty around the logo. */
  padding: number;
};

const ICONS: IconSpec[] = [
  { file: "icon-192.png", size: 192, padding: 0.08 },
  { file: "icon-512.png", size: 512, padding: 0.08 },
  // Android masks adaptive icons to ~80% of the canvas; 20% padding keeps the
  // logo intact whatever shape the launcher applies.
  { file: "maskable-512.png", size: 512, padding: 0.2 },
  // iOS ignores the manifest icons for the home screen and uses this one.
  // It also has no transparency support, hence the flattened white background.
  { file: "apple-touch-icon.png", size: 180, padding: 0.1 },
];

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  for (const icon of ICONS) {
    const inner = Math.round(icon.size * (1 - icon.padding * 2));
    const offset = Math.round((icon.size - inner) / 2);

    const logo = await sharp(SOURCE)
      .resize(inner, inner, { fit: "contain", background: { ...BACKGROUND, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: {
        width: icon.size,
        height: icon.size,
        channels: 4,
        background: BACKGROUND,
      },
    })
      .composite([{ input: logo, top: offset, left: offset }])
      .png()
      .toFile(path.join(OUT_DIR, icon.file));

    console.log(`wrote ${path.join(OUT_DIR, icon.file)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
