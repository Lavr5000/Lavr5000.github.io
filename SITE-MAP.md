# Site Map

Public-safe navigation map for the GitHub Pages site. Links use repository filenames only.

## Pages

- [index.html](index.html) - main landing page for public visitors: the two AI setup services (Claude Code on one workstation, Hermes Agent on laptop + phone), when they fit, how the setup goes, who runs it, and the construction tools as a secondary direction. The services section is a teaser — names, one sentence, "от 15 000 ₽" and a link to `/services/`; the full cards and the order dialog live on `/services/` only, and the hero cards link to `/services/#service-1` and `#service-2`. The `#services` anchor is kept because published posts point at `/#services`. Styles in [assets/site2.css](assets/site2.css), behaviour in [assets/index2.app.js](assets/index2.app.js), hero terminal frames in [assets/hero-demo.js](assets/hero-demo.js).
- [services/index.html](services/index.html) - services page at the stable public URL `/services/`, the address publications link to. The only place carrying the full service cards, the price and the order dialog; self-canonical, no payment form.
- [about.html](about.html) - public "about" page for visitors who want context about the project, author, or service positioning. Static page on [assets/site2.css](assets/site2.css); the AI-setup price lives on `/services/` only, and the page is Russian-only.
- [products.html](products.html) - public catalog page for the PDF products. Cards are rendered from [products.js](products.js) by [products.render.js](products.render.js); price and CTA are shown only for records with `status: available`. Self-canonical (`/products.html`).
- [vedomost.html](vedomost.html) - public order form for users who want to submit a PDF ведомость for processing.
- [nakladnaya.html](nakladnaya.html) - public order form for printed M-15 delivery-note scans: one PDF upload, email, product-scoped consent, payment, OCR, and Excel delivery.
- [rate.html](rate.html) - public feedback page for users who received a result and want to rate whether it worked for them.
- [oferta.html](oferta.html) - public offer terms page for users reviewing service terms before or after submitting an order.
- [privacy.html](privacy.html) - public privacy page for users reviewing personal data processing, consent, retention, and revocation terms.
- [apartment-auditor/](apartment-auditor/) - public section for visitors interested in the apartment audit product or tool.

## Client Flows

### Ведомость Order Flow

Files: [vedomost.html](vedomost.html), [vedomost.js](vedomost.js), [vedomost.config.js](vedomost.config.js), [assets/forms2.css](assets/forms2.css)

User-visible flow:

1. The user opens [vedomost.html](vedomost.html).
2. The user chooses a PDF file to process.
3. The user enters an email address for delivery.
4. The user reviews and accepts the required consent checkbox.
5. The user may opt in to additional storage or follow-up if the optional checkbox is shown.
6. The user submits the form.
7. The client calls the public order API.
8. The page shows order progress using user-facing stages such as queued, parsing, and delivered.
9. In free-mode, payment is disabled and the visible path stays focused on file upload, consent, submission, and delivery.
10. If a large file is still processing when the client poll cap is reached, the page shows a calm "processing continues, result will arrive by email" notice (not a "contact manager" error). The scary notice is kept only for an `awaiting_payment` stall. (Shared `assets/order-flow.js`, applies to both ведомость and nakladnaya.)
11. When the order is waiting behind others, the queued view shows how many documents are ahead ("Перед вами в очереди: N …") and an estimated wait time, plus a reminder that the result arrives by email so the tab can be closed. Position and the estimate are shown only while queued; the estimate is hidden when it cannot be computed. (Shared `assets/order-flow.js`.)

Public form fields and ids:

- `email` - email address where the user expects to receive the processing result or status.
- `consent` - required consent checkbox confirming that the user agrees to the linked terms and personal data processing conditions.
- `optin` - optional checkbox for the user-visible extended storage or follow-up option, when enabled by the page.
- `website` - hidden honeypot field intended to remain empty for real users.

Configuration:

- `CONSENT_VERSION` lives in [vedomost.config.js](vedomost.config.js) and identifies the consent text/version submitted with the order. Current value `vedomost-v2-2026-06`. The `#optin` checkbox stays optional (extended 90-day storage, opt-in). The `vedomost.js` entry script and its internal config import are version-pinned (`?v=vedomost-v2-2026-06`) so the whole client module graph is cache-busted together.
- `PAYMENT_ENABLED` lives in [vedomost.config.js](vedomost.config.js) and controls whether the order UI exposes the paid path or free-mode behavior.

### Rating And Feedback Flow

Files: [rate.html](rate.html), [rate.js](rate.js), [assets/forms2.css](assets/forms2.css), inline rating widget in [vedomost.js](vedomost.js)

User-visible flow:

1. The user opens the feedback UI from [rate.html](rate.html) or from the inline widget shown by the ведомость flow.
2. The user selects the main outcome: "подошла" when the result worked, or "есть замечания" when there were issues.
3. If there are remarks, the user can select one or more visible reasons.
4. The user may add an optional free-text comment.
5. The client posts the feedback to the public rate endpoint.

The rating flow is for product feedback only. It should not expose private processing details to the user.

### Products Catalog

Files: [products.html](products.html), [products.js](products.js), [products.render.js](products.render.js)

The products page is a public append-only catalog. Product data is maintained as a registry, and each registered product renders as a tile on [products.html](products.html).

Typical tile rendering includes:

- product name or title;
- short public description;
- visible status, price, or mode if the registry provides it;
- link or action target for the product;
- any public badges or labels defined by the registry.

New products should be added by appending to the existing registry structure rather than rewriting previous entries, so old public links and catalog behavior stay stable.

### Printed M-15 Delivery Notes Flow

Files: [nakladnaya.html](nakladnaya.html), [nakladnaya.js](nakladnaya.js), [assets/order-flow.js](assets/order-flow.js)

User-visible flow:

1. The user opens [nakladnaya.html](nakladnaya.html).
2. The user uploads one PDF scan of printed M-15 delivery notes.
3. The user enters an email address and accepts the required product-scoped OCR consent (`m15-v1`).
4. The client creates an order for product `nakladnaya-m15`, uploads the PDF, shows payment when required, polls status, and shows delivered/error states.
5. The backend returns the Excel result by email after OCR processing.

Public form fields and ids:

- `file` - one PDF scan of printed M-15 delivery notes.
- `email` - email address where the result is delivered.
- `consent` - required OCR consent checkbox for external OpenRouter processing.
- `website` - hidden honeypot field intended to remain empty for real users.

### Legal Pages

Files: [oferta.html](oferta.html), [privacy.html](privacy.html)

- [oferta.html](oferta.html) covers public offer terms: what service is provided, how the user accepts the terms, user and service responsibilities, and payment or free-mode terms when applicable. **v1.1 (2026-06-20):** seller changed from «Денис Лавров, НПД/самозанятый» to **ИП Лаврова Ю.Н. (УСН, ИНН 644404692540)**; payment section rewritten for online pay via Т-Касса (card/СБП) + 54-ФЗ cashier receipt (general wording), УСН/no-VAT; refund clause made ЗоЗПП-safe; internal risk-note removed. **v1.2 (2026-06-22):** M-15 public clause is live for printed M-15 delivery-note scans, with OpenRouter OCR disclosure and best-effort wording for handwritten notes. **v1.3 (2026-08-14):** the subject splits into two directions — document processing and software setup on the client's device. The setup direction gets its unit of service and price (15 000 RUB per workstation / per laptop+phone pair), the boundary of what is and is not included, acceptance by payment or written confirmation, the client's duties (backup, admin rights, examples, time), the right to involve third parties without passing personal data, prepayment and receipt wording, a 10-working-day term, a stage-based refund table, and consumer jurisdiction. Three new sections were appended rather than inserted, so anchors `#s1`-`#s14` and the links pointing at them stay valid: **15** remote access (RustDesk on the operator's own server, no session recording, the client types their own passwords), **16** third-party licences and subscriptions (the client's own cost), **17** when the service counts as delivered and how it is accepted.
- [privacy.html](privacy.html) covers personal data processing under 152-ФЗ, including email handling, file/order processing context, retention periods, the optional 90-day storage opt-in, and the user's right to revoke consent. v1.1 (2026-06-17) adds a technical-telemetry / service-journal disclosure: pseudonymized metadata only (no file name or content, no AI prompts/responses), ip-hash retained 90 days, journal up to 3 years, under the contract-execution legal basis (п.5 ст.6) — no consent-text change. **v1.2 (2026-06-20):** operator changed to **ИП Лаврова Ю.Н. (УСН)**; adds payment-data category + 4-year fiscal retention; subprocessors expanded with **АО «ТБанк» (Т-Касса/Т-Чеки)** for payment+receipt and **OpenRouter** (M-15 OCR, transborder disclosure ст.12). `CONSENT_VERSION` UNCHANGED (`vedomost-v2-2026-06`) — consent-checkbox text not modified, only the linked legal docs. **v1.4 (2026-08-13):** deadlines aligned with 152-ФЗ — a subject request is answered within 10 working days (extendable by 5, art. 14 p.3 / art. 20 p.1-2); art. 21 response times added (7 / 3 / 10 working days, plus the lawful 30 days on consent withdrawal); an incident is reported to Roskomnadzor within 24 h and 72 h (art. 21 p.3.1). `CONSENT_VERSION` again unchanged. **v1.5 (2026-08-14):** scope extended to the software-setup service — phone number, device/OS details, remote-session id and client-entered accounts added to the data table (passwords are never requested or stored), the on-screen visibility of third-party data addressed, a setup purpose and its retention rows added (correspondence 1 year, session details not kept, no screen recording), RustDesk on the operator's own server disclosed as adding no new recipient and no transborder transfer, АО «ТБанк» disclosed for service receipts too, vendor software after handover clarified as running in the client's own accounts, the corporate-device role split named, and setup stated to leave no trace in the personal cabinet. `CONSENT_VERSION` unchanged again — the consent checkbox texts are untouched and the file-product order form is not affected.

Both pages were rebuilt on the `site2` system on 2026-08-13 ([assets/legal2.css](assets/legal2.css)); the document text was carried over unchanged, and the section anchors (`#s1…#s14`, `#p1…#p11`) still resolve.

## Machine-Readable Endpoints

### IDmaster NTD channel (`idm/`)

Files: [idm/version.json](idm/version.json), `idm/ntd-snapshot.<sha256>.json`, [idm/last-check.json](idm/last-check.json), [scripts/ntd/](scripts/ntd/), [.github/workflows/idm-ntd-publish.yml](.github/workflows/idm-ntd-publish.yml)

Not a page: three static JSON files read by the desktop IDmaster workbook when its user presses «Обновить нормативы». No human visitor is expected here and nothing links to it.

- `idm/version.json` — the distribution manifest: workbook `version`, the URL of the current NTD snapshot and its sha256. Name is stable.
- `idm/ntd-snapshot.<sha256>.json` — a snapshot of the Rosstandart SP registry (all statuses). The file name carries the sha256 of its own content, so a client holding an older manifest keeps resolving the snapshot that manifest promises, and a mid-publication download can never mismatch.
- `idm/last-check.json` — the run-unique `check_id`, timestamp and counters of the last channel check; it is how the workflow proves the deploy actually reached the live site, and it keeps the weekly schedule from being auto-disabled for inactivity.

`.github/workflows/idm-ntd-publish.yml` rebuilds and republishes weekly. It writes only `idm/`, dispatches the existing Pages deploy explicitly (a `GITHUB_TOKEN` commit does not trigger it by push), and fails the run if the change is not observable on `ai-vibes.ru`. Pull requests touching `scripts/ntd/**` run the same collector in a read-only dry mode.

### Services Page

Files: [services/index.html](services/index.html), [services.js](services.js), [scripts/validate_services.mjs](scripts/validate_services.mjs), [assets/site2.css](assets/site2.css), [assets/index2.app.js](assets/index2.app.js)

- Two service cards. A card is closed down to its name, audience and price; hover or keyboard focus opens the composition of work and one publicly safe artefact of the result.
- Ordering is by message only: the CTA opens a dialog with a Telegram link and a prefilled mailto. No payment form, no API call, no consent checkbox — the page collects nothing.
- This page is the single place with the full cards. The main page carries a teaser and a link, so a wording or price change is made once.
- [services.js](services.js) is the registry behind the cards: an immutable kebab-case `id` per service plus the one `title` used on the site, in the offer terms, in the payment link and on the receipt. Every order button carries `data-service-id` next to the `data-order` display text the dialog reads. The file is not loaded by any page — it is the source of truth for the validator, the offer terms and the manual request register.
- `node scripts/validate_services.mjs` gates both halves: the registry schema (unique kebab-case ids, non-empty fields, no duplicate titles, name length within the 64-character receipt cap) and every order button resolving to a known id whose `title` matches `data-order` byte for byte. It is a local gate, not a CI workflow — `validate-products.yml` covers [products.js](products.js) only.

## Build And Asset Notes

- [scripts/build_hero_demo.py](scripts/build_hero_demo.py) generates [assets/hero-demo.js](assets/hero-demo.js) from [docs/hero-demo.sanitized.txt](docs/hero-demo.sanitized.txt). The sanitized file is the committed source: it passes an allowlist of publicly safe lines and carries the sha256 of the raw log, which is kept outside the repository. `--check` verifies the fixture regenerates byte for byte.
- [sync_csp.mjs](sync_csp.mjs) keeps the public Content Security Policy metadata synchronized with the client asset layout; its scope is `vedomost.html` only. `index.html` and `services/index.html` carry their own `default-src 'self'` meta.
- [scripts/build_og_card.py](scripts/build_og_card.py) generates both link-preview images (`og:image`): [assets/og-setup-1200x630.jpg](assets/og-setup-1200x630.jpg) for [index.html](index.html), [about.html](about.html) and [services/index.html](services/index.html), and [assets/og-docs-1200x630.jpg](assets/og-docs-1200x630.jpg) for the document pages — [vedomost.html](vedomost.html), [nakladnaya.html](nakladnaya.html), [products.html](products.html), [rate.html](rate.html), [oferta.html](oferta.html), [privacy.html](privacy.html). Both cards live inside the script and are rendered from the site's own tokens and self-hosted fonts through a local static server, so the preview and the page it opens look like one thing; `--check` verifies each committed asset is a 1200×630 JPEG. The docs card deliberately carries no price, so the preview does not go stale with the price list. Until 14.08.2026 the document pages pointed at `assets/og.svg` — an SVG most crawlers do not render at all; the file is kept, redrawn in the current identity, because links published earlier reference that URL. The older `assets/ai-vibes-site-og-1200x630.jpg` stays in place too: it carries the previous positioning and is still the preview of links published before 13.08.2026.
- Site icons — `favicon.ico` (16 + 32 + 48), `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` — and the mark sources [assets/brand/glyph.svg](assets/brand/glyph.svg) / [assets/brand/favicon-glyph.svg](assets/brand/favicon-glyph.svg) carry the current identity since 14.08.2026: the brass mark of the page header on the dark base, square corners. The 16-48 px frames use a denser drawing (solid sheet, the check knocked out) because the outlined mark is unreadable at tab size; 180 px and the master keep the outlined mark. The rasters are generated deterministically outside this repository and copied in — a hand-edited PNG is overwritten by the next render.
- [assets/](assets/) contains shared public styles and front-end assets: the design system in [assets/site2.css](assets/site2.css), form components in [assets/forms2.css](assets/forms2.css) and the legal-document shell in [assets/legal2.css](assets/legal2.css). The React bundles, `model-viewer`, the Draco decoder, `robot.glb` and the pre-site2 stylesheets (`site.css`, `legal.css`, `vedomost.css`, `rate.css`, `about.css`) were removed on 2026-08-13 once the last page stopped referencing them.
- [tests/](tests/) contains repository tests for public client behavior and regression checks. The folder stays in the repository but is stripped from the published site by [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).
- [scripts/audit_external_refs.mjs](scripts/audit_external_refs.mjs) proves that no page or asset reaches an origin other than the site itself and the order API; its file list is the list of pages and assets that are actually live.
