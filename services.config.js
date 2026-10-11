/* services.config.js — switches of the service payment flow (read by assets/pay.js).
 *
 * enabled        false: every [data-pay] button reads «Заказать …» and opens the request dialog
 *                (message channels, no API call). true: the button opens the payment dialog and
 *                the order goes to the order API. Turned on only after the PO has approved the
 *                offer terms and the consent text, and after the server-side switch is on.
 * consentVersion must match the version accepted by the backend for the setup services.
 * allowedPayHosts the only hosts pay.js will navigate to.
 */
window.AI_PAY = {
  enabled: false,
  api: "https://api.ai-vibes.ru",
  consentVersion: "setup-v1-2026-10",
  allowedPayHosts: ["securepay.tinkoff.ru", "pay.tbank-online.com"],
  timeoutMs: 15000
};
