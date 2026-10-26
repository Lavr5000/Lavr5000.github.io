/* services.config.js — switches of the service payment flow (read by assets/pay.js).
 *
 * enabled        false: every [data-pay] button reads «Заказать …» and opens the request dialog
 *                (message channels, no API call). true: the button opens the payment dialog and
 *                the order goes to the order API. Turned on only after the PO has approved the
 *                offer terms and the consent text, and after the server-side switch is on.
 * consentVersion must match the version accepted by the backend for the setup services.
 * consentVersions per-service override {serviceId: version}; the matching text lives in the shared payment
 *                dialog as [data-consent-for="<serviceId>"] (scripts/build_chrome.py) and its sha256 is checked by
 *                the backend. setup-start: DRAFT, approve before release (texts/soglasie-setup-v2.txt, offer 1.6): two
 *                checkboxes - the offer and, separately, personal data (152-FZ); the hash is taken over both texts.
 * heldServices  ids that keep the request dialog even when `enabled` is true (their button reads «Заказать …»).
 *                Branch start/autosale: every paid service is held, INCLUDING setup-start (the front is rolled out
 *                first). Branch start/autosale-release removes only "setup-start" — the last step of the rollout
 *                (PLAN E11 step 8). "setup-vip" is also forbidden in assets/pay.js (NEVER_PAY): no payment, ever,
 *                from this version of the site.
 *               "setup-rieltor" is held until the backend switch RIELTOR_ENABLED is on (DEPLOY-RIELTOR.md).
 * allowedPayHosts the only hosts pay.js will navigate to.
 */
window.AI_PAY = {
  enabled: true,
  api: "https://api.ai-vibes.ru",
  consentVersion: "setup-v1-2026-10",
  consentVersions: { "setup-start": "setup-v2-2026-10" }, // draft, approve before release
  heldServices: ["setup-vip", "setup-rieltor"], // release: setup-start is open for payment
  allowedPayHosts: ["securepay.tinkoff.ru", "pay.tbank-online.com"],
  timeoutMs: 15000
};
