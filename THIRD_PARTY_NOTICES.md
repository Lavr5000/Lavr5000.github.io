# Third-Party Notices

Self-hosted third-party assets vendored into this site (no CDN dependencies).
License types taken from the LICENSE files inside the official npm tarballs
(registry.npmjs.org), verified against the packages' published `dist.integrity`.

| Asset | Version | License | Source | Files |
|---|---|---|---|---|
| Inter | (Google Fonts build, 2026-06-10) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/Inter-*.woff2`, `assets/fonts.css` |
| JetBrains Mono | (Google Fonts build, 2026-06-10) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/JetBrainsMono-*.woff2`, `assets/fonts.css` |
| Prata | (Google Fonts build, 2026-08-13) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/Prata-*.woff2`, `assets/fonts.css` |
| Golos Text | (Google Fonts build, 2026-08-13) | SIL OFL 1.1 | Google Fonts woff2 | `assets/fonts/GolosText-*.woff2`, `assets/fonts.css` |

Notes:

- React, ReactDOM, `<model-viewer>` and the Draco decoder were removed on
  2026-08-13 together with the last pages that used them (`products.html`,
  `about.html`); no vendored copy is left in the repository.
- Full Apache-2.0 and MIT license texts ship inside the upstream packages;
  integrity hashes of the exact tarballs used are recorded in
  `tasks/PLAN-REVIEW-LOG — окно 2026-06-11.md` (project vault).

Generated 2026-06-11 (window: index.html self-host migration).
