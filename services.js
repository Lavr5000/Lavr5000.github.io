/* services.js — single source of truth for the paid services (index.html, services/index.html).
 * Separate registry from products.js: the self-service PDF catalog and the operator-run services
 * are different domains, and products.js is under the validate-products.yml contract.
 *
 * APPEND-ONLY: a new service = one new object at the END of the array.
 * `id` is immutable — it is the identifier a payment link, a receipt line and the manual
 * request register (Ф8 SOP) refer to. The button text may be edited; the id may not.
 *
 * Field contract (all required):
 *   id           unique kebab-case, immutable
 *   title        { ru }  the one name used on the site, in the offer terms and in the receipt
 *   price        { ru }  numeric string, no currency symbol — the amount for `fixed`,
 *                        the minimum for `from`
 *   pricingModel "fixed" | "from"
 *   priceLabel   { ru }  the exact string rendered on the card, in the order button and in the
 *                        modal: "15 000 ₽" | "от 10 000 ₽". U+0020 separators ONLY — никаких
 *                        NBSP и &nbsp; внутри цены, иначе сравнение с data-price-label врёт
 *   unit         { ru }  what one paid unit of the service covers
 *
 * Optional field:
 *   archived     true  the record is kept only so that its `id` stays immutable (old payment links,
 *                receipts and the request register still refer to it); it is NOT shown on the site,
 *                NOT written to llms.txt / JSON-LD and has no order or pay buttons. A button that
 *                references an archived id is an error in `node scripts/validate_services.mjs`.
 *
 * `title.ru` is byte-identical to the `data-order` attribute of every order button of this
 * service and to the receipt line name fixed by the PO (В-4, 13.08.2026); `priceLabel.ru` is
 * byte-identical to that button's `data-price-label`. Both are enforced by
 * `node scripts/validate_services.mjs`.
 */
window.AI_SERVICES = [
  {
    id: "setup-claude-code",
    archived: true,
    title: { ru: "Настройка Claude Code на одном рабочем месте" },
    price: { ru: "15000" },
    pricingModel: "fixed",
    priceLabel: { ru: "15 000 ₽" },
    unit:  { ru: "одно рабочее место — одно устройство Клиента" },
  },
  {
    id: "setup-hermes-agent",
    archived: true,
    title: { ru: "Настройка Hermes Agent на ноутбуке и телефоне" },
    price: { ru: "15000" },
    pricingModel: "fixed",
    priceLabel: { ru: "15 000 ₽" },
    unit:  { ru: "одна связка «ноутбук + телефон» одного Клиента" },
  },
  {
    id: "extract-drawings-data",
    title: { ru: "Извлечение данных из рабочих чертежей" },
    price: { ru: "10000" },
    pricingModel: "from",
    priceLabel: { ru: "от 10 000 ₽" },
    unit:  { ru: "один альбом марки КЖ / монолитные конструкции одного корпуса, до 50 листов формата А1" },
  },
  {
    id: "as-built-package",
    title: { ru: "Формирование комплекта исполнительной документации" },
    price: { ru: "3500" },
    pricingModel: "fixed",
    priceLabel: { ru: "3 500 ₽" },
    unit:  { ru: "один комплект по одному объекту: до 20 актов освидетельствования скрытых работ и один реестр ИД" },
  },
  {
    id: "setup-claude-code-start",
    archived: true,
    title: { ru: "Настройка Claude Code «Старт» на одном рабочем месте" },
    price: { ru: "7500" },
    pricingModel: "fixed",
    priceLabel: { ru: "7 500 ₽" },
    unit:  { ru: "одно рабочее место — одно устройство Клиента; доступ к модели на первый месяц включён" },
  },
  {
    id: "setup-start",
    title: { ru: "Настройка помощника «Старт» на одном рабочем месте" },
    price: { ru: "7500" },
    pricingModel: "fixed",
    priceLabel: { ru: "7 500 ₽" },
    unit:  { ru: "одно рабочее место — компьютер и телефон одного Клиента" },
  },
  {
    id: "setup-vip",
    title: { ru: "Настройка рабочего помощника VIP на компьютере и телефоне" },
    price: { ru: "45000" },
    pricingModel: "fixed",
    priceLabel: { ru: "45 000 ₽" },
    unit:  { ru: "компьютер и телефон одного Клиента" },
  },
  {
    id: "support-monthly",
    title: { ru: "Поддержка помощника, один месяц" },
    price: { ru: "5000" },
    pricingModel: "fixed",
    priceLabel: { ru: "5 000 ₽" },
    unit:  { ru: "один календарный месяц поддержки одного Клиента" },
  },
];
