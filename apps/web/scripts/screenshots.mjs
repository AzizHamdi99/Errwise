// Turns the PNG captures of screenshots-src/ into WebP files in public/screenshots/ and records
// their size and blur placeholder. Run: yarn workspace @errwise/web screenshots
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Keep in sync with ScreenshotName in features/marketing/screenshots.ts
const NAMES = [
  "issues-list",
  "issue-detail",
  "ai-analysis",
  "suggested-fix",
  "github-integration",
  "regression",
  "project-overview",
  "api-keys",
  "alert-email",
];
const FILE = new RegExp(`^(${NAMES.join("|")})(-dark|-light)?\\.png$`);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "screenshots-src");
const target = path.join(root, "public", "screenshots");
const manifest = path.join(
  root,
  "features/marketing/screenshots.generated.json",
);

await mkdir(source, { recursive: true });
await mkdir(target, { recursive: true });

const entries = {};
for (const file of (await readdir(source)).sort()) {
  if (!file.endsWith(".png")) continue;
  if (!FILE.test(file)) {
    console.warn(`skipped ${file}: not a known screenshot name`);
    continue;
  }
  const key = file.replace(/\.png$/, "");
  const input = path.join(source, file);

  const { width, height } = await sharp(input)
    .resize({ width: 2880, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(target, `${key}.webp`));
  const blur = await sharp(input)
    .resize({ width: 16 })
    .webp({ quality: 40 })
    .toBuffer();

  entries[key] = {
    src: `/screenshots/${key}.webp`,
    width,
    height,
    blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
  };
  console.log(`${key}: ${width}x${height}`);
}

await writeFile(manifest, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`${Object.keys(entries).length} screenshot(s) ready`);
