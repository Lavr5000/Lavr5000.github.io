/* services.js — single source of truth for the AI setup services (index.html, services/index.html).
 * Separate registry from products.js: the PDF catalog and the setup services are different
 * domains, and products.js is under the validate-products.yml contract.
 *
 * APPEND-ONLY: a new service = one new object at the END of the array.
 * `id` is immutable — it is the identifier a payment link, a receipt line and the manual
 * request register (Ф8 SOP) refer to. The button text may be edited; the id may not.
 *
 * Field contract (all required):
 *   id      unique kebab-case, immutable
 *   title   { ru }  the one name used on the site, in the offer terms and in the receipt
 *   price   { ru }  numeric string, no currency symbol
 *   unit    { ru }  what one paid unit of the service covers
 *
 * `title.ru` is byte-identical to the `data-order` attribute of every order button of this
 * service and to the receipt line name fixed by the PO (В-4, 13.08.2026).
 */
window.AI_SERVICES = [
  {
    id: "setup-claude-code",
    title: { ru: "Настройка Claude Code на одном рабочем месте" },
    price: { ru: "15000" },
    unit:  { ru: "одно рабочее место — одно устройство Клиента" },
  },
  {
    id: "setup-hermes-agent",
    title: { ru: "Настройка Hermes Agent на ноутбуке и телефоне" },
    price: { ru: "15000" },
    unit:  { ru: "одна связка «ноутбук + телефон» одного Клиента" },
  },
];
