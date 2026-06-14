import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "assets/pdfjs/VENDOR-HASHES.md");

const manifest = readFileSync(manifestPath, "utf-8");
const rows = [...manifest.matchAll(/\|\s*`([^`]+)`\s*\|\s*`sha384-([^`]+)`\s*\|/g)];

if (!rows.length) {
  console.error(`No sha384 rows found in ${manifestPath}`);
  process.exit(1);
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
