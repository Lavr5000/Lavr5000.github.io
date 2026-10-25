import {
  PAYMENT_ENABLED,
  CONSENT_VERSION
} from './vedomost.config.js?v=vedomost-v3-2026-10';
import { initOrderFlow } from './assets/order-flow.js';

// Since 2026-10 (consent vedomost-v3-2026-10) scans and mixed PDFs are accepted: a file the text layer
// cannot cover is read by the cloud recognition service on the server, so the browser no longer rejects scans.
initOrderFlow({
  product: null, // omitted in /api/orders — backend uses its default (material-takeoff)
  consentVersion: CONSENT_VERSION,
  paymentEnabled: PAYMENT_ENABLED,
  stages: PAYMENT_ENABLED
    ? ['queued', 'parsing', 'awaiting_payment', 'delivered']
    : ['queued', 'parsing', 'delivered'],
  failedStages: ['queued', 'parsing', 'failed'],
  labels: {
    queued: 'Файл принят, заказ в очереди',
    parsing: 'Извлекаем объёмы из чертежа',
    awaiting_payment: PAYMENT_ENABLED ? 'Ожидается оплата' : 'Результат готов',
    delivered: 'Готовая ведомость отправлена на email',
    failed: 'Ошибка обработки'
  },
  ratingReasonLabels: {
    extraction_wrong: 'Данные извлечены неверно или неполно',
    wrong_section: 'Распознан не тот раздел / не те листы',
    format: 'Неудобный формат XLSX',
    late: 'Результат пришёл не вовремя',
    other: 'Другое'
  },
  ratingTitle: 'Ведомость подошла?',
  maxPollAttempts: 120,
  payButtonText: 'Оплатить картой или через СБП',
  checkTextLayer: false,
  noTextMessage: '',
  consentError: 'Нужно подтвердить согласие с офертой и политикой.',
  hasOptin: true,
  uploadMessage: () => 'Загружаем PDF...',
  sourceViewLabels: ['РД · АР-6', 'XLSX · ВЕДОМОСТЬ', 'QA · ИСТОЧНИКИ'],
  awaitingFallbackMessage: 'Ожидаем ссылку на оплату. Статус обновляется автоматически.'
});
