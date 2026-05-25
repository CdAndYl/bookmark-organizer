// Pack dist/ into a zip file ready for chrome.google.com/webstore upload.
// Uses Node's built-in primitives via a small archiver helper if available;
// otherwise prints instructions.

import { statSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");
const OUT_DIR = resolve(ROOT, "release");

if (!safeStat(DIST)) {
  console.error("dist/ not found. Run `npm run build` first.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

let archiver;
try {
  archiver = (await import("archiver")).default;
} catch {
  printManualInstructions();
  process.exit(0);
}

const version = readJsonField("package.json", "version") ?? "latest";
const outFile = join(OUT_DIR, `bookmark-organizer-${version}.zip`);

const { createWriteStream } = await import("node:fs");
const output = createWriteStream(outFile);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`Packed ${outFile} (${archive.pointer()} bytes).`);
});
archive.on("warning", (err) => console.warn(err));
archive.on("error", (err) => {
  throw err;
});
archive.pipe(output);
archive.directory(DIST, false);
await archive.finalize();

function safeStat(p) {
  try {
    return statSync(p);
  } catch {
    return null;
  }
}

function readJsonField(rel, field) {
  try {
    const raw = readFileSync(resolve(ROOT, rel), "utf8");
    return JSON.parse(raw)[field];
  } catch {
    return null;
  }
}

function printManualInstructions() {
  const files = listDeep(DIST);
  console.log("dist/ files:");
  for (const f of files) console.log(`  ${f}`);
  console.log(
    "\nTo upload to Chrome Web Store, zip the contents of dist/ (NOT the dist/ folder itself).",
  );
  console.log("Example (PowerShell): Compress-Archive dist/* release/bookmark-organizer.zip");
  console.log("Example (bash):       cd dist && zip -r ../release/bookmark-organizer.zip .");
}

function listDeep(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...listDeep(full, base));
    else out.push(full.slice(base.length + 1));
  }
  return out;
}

void writeFile; // reserved for future use
