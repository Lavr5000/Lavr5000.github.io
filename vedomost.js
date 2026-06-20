import {
  PAYMENT_ENABLED,
  CONSENT_VERSION
} from './vedomost.config.js?v=vedomost-v2-2026-06';
import { initOrderFlow } from './assets/order-flow.js';

const NO_TEXT_MESSAGE = `Файл не принят: нет машиночитаемого текстового слоя

Похоже, это скан. Сервис работает только с PDF, выгруженными из проектной программы
с текстовым слоем.

Что делать: запросите у заказчика или проектировщика исходную РД с текстовым слоем.
Пример формулировки:

«Прошу выгрузить рабочую документацию (раздел КЖ/АР) в формате PDF с текстовым
(машиночитаемым) слоем — печатью в PDF напрямую из AutoCAD/Revit/nanoCAD,
без сканирования бумажных листов».`;

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
  checkTextLayer: true,
  noTextMessage: NO_TEXT_MESSAGE,
  consentError: 'Нужно подтвердить согласие с офертой и политикой.',
  hasOptin: true,
  uploadMessage: () => 'Загружаем PDF...',
  sourceViewLabels: ['РД · АР-6', 'XLSX · ВЕДОМОСТЬ', 'QA · ИСТОЧНИКИ'],
  awaitingFallbackMessage: 'Ожидаем ссылку на оплату. Статус обновляется автоматически.'
});
