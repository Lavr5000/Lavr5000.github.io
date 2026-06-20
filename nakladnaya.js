import { initOrderFlow } from './assets/order-flow.js';

// Intentional behaviour changes vs the old nakladnaya.js (Б7 unification):
// - payButtonText: 'Оплатить картой или через СБП' (was 'Оплатить'); m15 also accepts card+SBP.
// - free-quota indicator added (m15 is a freemium product; backend returns free_quota_remaining).
// - polling stops at awaiting_payment only when a valid payment URL is present (Б6 poll-fix).
// nakladnaya is under the release/m15-hold moratorium and is not deployed yet.

initOrderFlow({
  product: 'nakladnaya-m15',
  consentVersion: 'm15-v1',
  paymentEnabled: true, // m15 always uses payment; independent of PAYMENT_ENABLED in vedomost.config.js
  stages: ['queued', 'awaiting_payment', 'parsing', 'delivered'],
  failedStages: ['queued', 'awaiting_payment', 'failed'],
  labels: {
    queued: 'Файл принят, заказ в очереди',
    awaiting_payment: 'Ожидается оплата',
    parsing: 'Распознаём накладную М-15',
    delivered: 'Готовый Excel отправлен на email',
    failed: 'Ошибка обработки'
  },
  ratingReasonLabels: {
    extraction_wrong: 'Данные извлечены неверно или неполно',
    wrong_section: 'Распознана не та форма / не те страницы',
    format: 'Неудобный формат XLSX',
    late: 'Результат пришёл не вовремя',
    other: 'Другое'
  },
  ratingTitle: 'Накладная подошла?',
  maxPollAttempts: 240,
  payButtonText: 'Оплатить картой или через СБП',
  checkTextLayer: false,
  noTextMessage: '',
  consentError: 'Нужно подтвердить согласие на OCR-распознавание.',
  hasOptin: false,
  uploadMessage: (paymentRequired) => paymentRequired
    ? 'Загружаем PDF. После загрузки появится статус оплаты.'
    : 'Загружаем PDF...',
  sourceViewLabels: ['М-15 · СКАН', 'XLSX · НАКЛАДНАЯ', 'QA · OCR'],
  awaitingFallbackMessage: 'Ожидаем ссылку на оплату. Статус обновляется автоматически.'
});
