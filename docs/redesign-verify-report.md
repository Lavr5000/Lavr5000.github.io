# UPRD P10 Redesign Verify Report

Date: 2026-06-16
Mode: static read-only verification. No smoke-test server started.

## Summary

Status: done

All 8 static gates passed.

## Gate Results

1. PASS - `node scripts/audit_external_refs.mjs`
   - Exit: 0
   - Evidence: `External reference audit OK: self + https://api.ai-vibes.ru`

2. PASS - `node scripts/validate_products.mjs` and product count
   - Exit: 0
   - Evidence: `products.js OK: 5 records (snapshot 5), 4 visible`
   - `.github/products-count.txt`: `5`
   - `products.js` record ids found on lines 32, 46, 60, 74, 88: 5 records.

3. PASS - no inline `<style>` blocks in required pages
   - Checked: `index.html`, `about.html`, `products.html`, `vedomost.html`, `oferta.html`, `privacy.html`
   - Evidence: each file returned 0 `<style` matches.

4. PASS - `about.html` Draco/model-viewer order and CSP checks
   - `about.html`: `dracoDecoderLocation` on lines 26 and 29.
   - `about.html`: `model-viewer.min.js` on line 32.
   - Result: Draco configuration appears before the model-viewer module script.
   - `about.html`: no `Content-Security-Policy` match.
   - `index.html`: no `dracoDecoderLocation` match.

5. PASS - `vedomost.html` CSP/form/honeypot/integrity checks
   - `connect-src 'self' https://api.ai-vibes.ru`: exactly 1 occurrence on line 6.
   - `orderForm`: line 97.
   - Honeypot field: `.hp` wrapper on line 112 and hidden `website` input on line 114.
   - `integrity=`: line 17.

6. PASS - Node syntax checks
   - `node --check assets/index.app.js`: exit 0
   - `node --check assets/about.app.js`: exit 0
   - `node --check assets/catalog.js`: exit 0
   - `node --check products.app.js`: exit 0

7. PASS - metadata URLs
   - No `lavr5000.github.io` matches in HTML metadata scan.
   - Canonical and `og:url` entries are absolute `https://ai-vibes.ru` URLs:
     - `index.html`: lines 8, 13
     - `about.html`: lines 12, 13
     - `products.html`: lines 8, 13
     - `vedomost.html`: lines 9, 14
     - `oferta.html`: lines 8, 13
     - `privacy.html`: lines 8, 13

8. PASS - about portrait/duotone, selector heading, catalog badge
   - `assets/denis-portrait.png`: referenced from `assets/about.app.js` line 1227.
   - Duotone styling: `mix-blend-mode` in `assets/about.css` line 806; `grayscale` in `assets/about.css` line 817.
   - Index catalog selector heading: `Выберите систему под вашу задачу` in `index.html` line 158.
   - Catalog badge: `Рабочий сервис` in `assets/catalog.js` line 253.

## Notes

No Playwright preview checks were run here; those are reserved for the orchestrator.
