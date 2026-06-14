/**
 * sync_csp.mjs — synchronise the connect-src CSP origin in vedomost.html with
 * the API_ORIGIN value declared in vedomost.config.js.
 *
 * Usage:
 *   node sync_csp.mjs           # dry-run: print diff, do NOT write
 *   node sync_csp.mjs --check   # verify CSP matches API_ORIGIN
 *   node sync_csp.mjs --write   # update vedomost.html in place
 *
 * Contract (matches README-DEPLOY.md §4):
 *   - Reads API_ORIGIN from vedomost.config.js (first export const API_ORIGIN = '...').
 *   - Locates the <meta http-equiv="Content-Security-Policy" ...> tag in vedomost.html.
 *   - Replaces the existing connect-src origin (anything that is not 'self' in the
 *     connect-src directive) with the new API_ORIGIN.  The 'self' token is kept.
 *   - Operation is idempotent: running twice produces the same result.
 *
 * Node ESM, no external dependencies.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH  = resolve(__dirname, 'vedomost.config.js');
const HTML_PATH    = resolve(__dirname, 'vedomost.html');

// ---------------------------------------------------------------------------
// 1. Read API_ORIGIN from vedomost.config.js using a simple regex — avoids
//    importing an ES module that may have side-effects in other environments.
// ---------------------------------------------------------------------------
function readApiOrigin(configPath) {
  const src = readFileSync(configPath, 'utf8');
  // Match: export const API_ORIGIN = 'value';   (single or double quotes)
  const m = src.match(/export\s+const\s+API_ORIGIN\s*=\s*['"]([^'"]+)['"]/);
  if (!m) {
    throw new Error(`API_ORIGIN not found in ${configPath}`);
  }
  return m[1];
}

// ---------------------------------------------------------------------------
// 2. Replace the non-'self' origin(s) inside connect-src in the CSP meta tag.
//    Strategy: locate the content="..." attribute of the CSP meta, rewrite
//    the connect-src directive in that string, put it back.
// ---------------------------------------------------------------------------
function updateCsp(html, newOrigin) {
  // Match the entire <meta http-equiv="Content-Security-Policy" content="..."> tag.
  // The content value is extracted as group 1; we reconstruct the tag with the
  // updated CSP string.
  const metaRe = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]+)(")/i;
  const m = html.match(metaRe);
  if (!m) {
    throw new Error('CSP <meta> tag not found in vedomost.html');
  }

  const cspOld = m[2];

  // Replace the connect-src directive value, preserving 'self'.
  // Pattern: connect-src 'self' <old-origin>   OR   connect-src 'self'
  // Result:  connect-src 'self' <newOrigin>
  const connectSrcRe = /(connect-src\s+'self')(?:\s+[^\s;]+)?/;
  if (!connectSrcRe.test(cspOld)) {
    throw new Error(`connect-src directive not found in CSP: ${cspOld}`);
  }

  const cspNew = cspOld.replace(connectSrcRe, `$1 ${newOrigin}`);
  const htmlNew = html.replace(metaRe, m[1] + cspNew + m[3]);

  return { cspOld, cspNew, htmlNew, changed: cspOld !== cspNew };
}

// ---------------------------------------------------------------------------
// 3. Main
// ---------------------------------------------------------------------------
const mode = process.argv[2];
if (mode && !['--check', '--write'].includes(mode)) {
  console.error('[sync_csp] Usage: node sync_csp.mjs [--check|--write]');
  process.exit(2);
}

const checkMode = mode === '--check';
const writeMode = mode === '--write';

let apiOrigin;
try {
  apiOrigin = readApiOrigin(CONFIG_PATH);
} catch (err) {
  console.error(`[sync_csp] ERROR reading config: ${err.message}`);
  process.exit(1);
}

const html = readFileSync(HTML_PATH, 'utf8');

let result;
try {
  result = updateCsp(html, apiOrigin);
} catch (err) {
  console.error(`[sync_csp] ERROR: ${err.message}`);
  process.exit(1);
}

if (!result.changed) {
  console.log(`[sync_csp] CSP already matches API_ORIGIN=${apiOrigin} — no changes needed.`);
  process.exit(0);
}

console.log(`[sync_csp] API_ORIGIN: ${apiOrigin}`);
console.log(`[sync_csp] connect-src before: ${result.cspOld}`);
console.log(`[sync_csp] connect-src after:  ${result.cspNew}`);

if (checkMode) {
  console.error('[sync_csp] CSP mismatch — run with --write to apply changes.');
  process.exit(1);
}

if (!writeMode) {
  console.log('[sync_csp] Dry-run mode — run with --write to apply changes.');
  process.exit(0);
}

writeFileSync(HTML_PATH, result.htmlNew, 'utf8');
console.log(`[sync_csp] Written: ${HTML_PATH}`);
