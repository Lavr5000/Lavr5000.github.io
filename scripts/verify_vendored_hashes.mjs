import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Every vendored library has its own manifest in the same table format.
const manifestPaths = [
  join(root, "assets/pdfjs/VENDOR-HASHES.md"),
  join(root, "assets/vendor/VENDOR-HASHES.md")
];

const rows = [];
for (const manifestPath of manifestPaths) {
  const manifest = readFileSync(manifestPath, "utf-8");
  const found = [...manifest.matchAll(/\|\s*`([^`]+)`\s*\|\s*`sha384-([^`]+)`\s*\|/g)];
  if (!found.length) {
    console.error(`No sha384 rows found in ${manifestPath}`);
    process.exit(1);
  }
  rows.push(...found);
}

const failures = [];

for (const [, file, expected] of rows) {
  const buf = readFileSync(join(root, file));
  const actual = createHash("sha384").update(buf).digest("base64");
  if (actual !== expected) {
    failures.push(`${file}: expected sha384-${expected}, got sha384-${actual}`);
  }
}

if (failures.length) {
  console.error(`Vendored hash verification FAILED (${failures.length}):`);
  failures.forEach(item => console.error(`  - ${item}`));
  process.exit(1);
}

console.log(`Vendored hash verification OK: ${rows.length} file(s) matched`);
