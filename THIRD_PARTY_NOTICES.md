# Third-Party Notices

Self-hosted third-party assets vendored into this site (no CDN dependencies).
License types taken from the LICENSE files inside the official npm tarballs
(registry.npmjs.org), verified against the packages' published `dist.integrity`.

| Asset | Version | License | Source | Files |
|---|---|---|---|---|
| React | 18.3.1 | MIT (Copyright (c) Facebook, Inc. and its affiliates) | npm `react` | `assets/react.production.min.js` |
| ReactDOM | 18.3.1 | MIT (Copyright (c) Facebook, Inc. and its affiliates) | npm `react-dom` | `assets/react-dom.production.min.js` |
| `<model-viewer>` | 3.5.0 | Apache-2.0 (Google) | npm `@google/model-viewer` | `assets/model-viewer.min.js` |
| Draco decoder | 1.5.6 | Apache-2.0 (Google) | gstatic versioned decoders (same URL the model-viewer bundle references) | `assets/draco/draco_wasm_wrapper.js`, `assets/draco/draco_decoder.wasm` |
| Inter | (Google Fonts build, 2026-06-10) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/Inter-*.woff2`, `assets/fonts.css` |
| JetBrains Mono | (Google Fonts build, 2026-06-10) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/JetBrainsMono-*.woff2`, `assets/fonts.css` |

Notes:

- `model-viewer.min.js` is a self-contained bundle; per its package metadata it
  builds on `lit` (BSD-3-Clause), `@monogrid/gainmap-js` (MIT) and bundles
  three.js (MIT). The bundle retains its embedded license headers.
- Full Apache-2.0 and MIT license texts ship inside the upstream packages;
  integrity hashes of the exact tarballs used are recorded in
  `tasks/PLAN-REVIEW-LOG — окно 2026-06-11.md` (project vault).

Generated 2026-06-11 (window: index.html self-host migration).
