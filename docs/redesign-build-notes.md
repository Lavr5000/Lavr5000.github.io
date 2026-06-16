# Redesign Build Notes

Baseline checked on 2026-06-16 from repo root:
`C:\Users\user\.claude\0 ProEKTi\blogger\my-website`.

## Build Baseline

- There is no `package.json` in the repo, therefore no npm build script is available.
- `index.html` and `products.html` contain no `type="text/babel"` or `type="text/jsx"` scripts.
- No JSX source files are present for the React pages.
- The runtime uses self-hosted React bundles:
  - `assets/react.production.min.js`
  - `assets/react-dom.production.min.js`
- All `*.app.js` files are committed browser artifacts and are edited directly:
  - `assets/index.app.js`
  - `products.app.js`
- Do not invent or run a Babel/recompile recipe for this repo. Historical comments inside app artifacts are not an active build pipeline.

## Editable Artifact Map

### `index.html`

Runtime mount:

- `<div id="root"></div>`
- `assets/react.production.min.js`
- `assets/react-dom.production.min.js`
- `assets/index.app.js?v=42c30516c8`

Editable data blocks in `index.html`:

- `TWEAK_DEFAULTS` inline script.
- `window.STROYOPS_SCENARIOS` inline script.
- `CONTENT` inline script, exported as `window.CONTENT`.

Editable app artifact:

- `assets/index.app.js` is precompiled `React.createElement` style code and is edited directly.

### `products.html`

Runtime mount:

- `<div id="root"></div>`
- `assets/react.production.min.js`
- `assets/react-dom.production.min.js`
- `products.js`, loaded before the app so `window.AI_PRODUCTS` exists.
- `products.app.js`, loaded after the data registry and mounted into `#root`.

Editable data artifact:

- `products.js` is the current product registry / catalog source of truth.

Editable app artifact:

- `products.app.js` is precompiled `React.createElement` style code and is edited directly.
- Later redesign phases will refactor the catalog data path toward `assets/catalog.js`; do not do that in this baseline phase.

## Cache Busting

- Browser-loaded static assets referenced from HTML should carry an explicit `?v=` query when changed.
- When a referenced app artifact changes, update the corresponding HTML `?v=` value in the same change.
- Do not add a build-time cache-busting tool; this is a manual repo convention.

## Hard Invariants For Later Phases

- Keep the site self-hosted and zero-CDN site-wide; use the extended external-reference audit to catch regressions.
- Do not break `vedomost` CSP, form flow, upload behavior, or configured API origin handling.
- Keep the Draco decoder setup before `model-viewer` on the about/index page; `ModelViewerElement.dracoDecoderLocation` must be set before loading `assets/model-viewer.min.js`.
- Treat the product registry as append-only and keep strict CI validation for registry shape/order.
