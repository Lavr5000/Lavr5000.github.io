# Site Map

Public-safe navigation map for the GitHub Pages site. Links use repository filenames only.

## Pages

- [index.html](index.html) - main landing page for public visitors; introduces the site entry points and routes users to products, services, and legal information.
- [about.html](about.html) - public "about" page for visitors who want context about the project, author, or service positioning.
- [products.html](products.html) - public catalog page for visitors choosing available products or service cards.
- [vedomost.html](vedomost.html) - public order form for users who want to submit a PDF ведомость for processing.
- [rate.html](rate.html) - public feedback page for users who received a result and want to rate whether it worked for them.
- [oferta.html](oferta.html) - public offer terms page for users reviewing service terms before or after submitting an order.
- [privacy.html](privacy.html) - public privacy page for users reviewing personal data processing, consent, retention, and revocation terms.
- [apartment-auditor/](apartment-auditor/) - public section for visitors interested in the apartment audit product or tool.

## Client Flows

### Ведомость Order Flow

Files: [vedomost.html](vedomost.html), [vedomost.js](vedomost.js), [vedomost.config.js](vedomost.config.js), [assets/vedomost.css](assets/vedomost.css)

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

Public form fields and ids:

- `email` - email address where the user expects to receive the processing result or status.
- `consent` - required consent checkbox confirming that the user agrees to the linked terms and personal data processing conditions.
- `optin` - optional checkbox for the user-visible extended storage or follow-up option, when enabled by the page.
- `website` - hidden honeypot field intended to remain empty for real users.

Configuration:

- `CONSENT_VERSION` lives in [vedomost.config.js](vedomost.config.js) and identifies the consent text/version submitted with the order.
- `PAYMENT_ENABLED` lives in [vedomost.config.js](vedomost.config.js) and controls whether the order UI exposes the paid path or free-mode behavior.

### Rating And Feedback Flow

Files: [rate.html](rate.html), [rate.js](rate.js), inline rating widget in [vedomost.js](vedomost.js)

User-visible flow:

1. The user opens the feedback UI from [rate.html](rate.html) or from the inline widget shown by the ведомость flow.
2. The user selects the main outcome: "подошла" when the result worked, or "есть замечания" when there were issues.
3. If there are remarks, the user can select one or more visible reasons.
4. The user may add an optional free-text comment.
5. The client posts the feedback to the public rate endpoint.

The rating flow is for product feedback only. It should not expose private processing details to the user.

### Products Catalog

Files: [products.html](products.html), [products.js](products.js), [products.app.js](products.app.js)

The products page is a public append-only catalog. Product data is maintained as a registry, and each registered product renders as a tile on [products.html](products.html).

Typical tile rendering includes:

- product name or title;
- short public description;
- visible status, price, or mode if the registry provides it;
- link or action target for the product;
- any public badges or labels defined by the registry.

New products should be added by appending to the existing registry structure rather than rewriting previous entries, so old public links and catalog behavior stay stable.

### Legal Pages

Files: [oferta.html](oferta.html), [privacy.html](privacy.html)

- [oferta.html](oferta.html) covers public offer terms: what service is provided, how the user accepts the terms, user and service responsibilities, and payment or free-mode terms when applicable.
- [privacy.html](privacy.html) covers personal data processing under 152-ФЗ, including email handling, file/order processing context, retention periods, the optional 90-day storage opt-in, and the user's right to revoke consent.

## Build And Asset Notes

- [sync_csp.mjs](sync_csp.mjs) keeps the public Content Security Policy metadata synchronized with the client asset layout.
- [assets/](assets/) contains shared public styles and front-end assets, including ведомость-specific styling in [assets/vedomost.css](assets/vedomost.css).
- [tests/](tests/) contains repository tests for public client behavior and regression checks.
