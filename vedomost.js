import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  PAYMENT_ENABLED,
  CONSENT_VERSION,
  isValidPaymentUrl
} from './vedomost.config.js';
import { checkTextLayer } from './assets/textlayer-check.js';

const MAX_SIZE = 25 * 1024 * 1024;
const NO_TEXT_MESSAGE = `Файл не принят: нет машиночитаемого текстового слоя

Похоже, это скан. Сервис работает только с PDF, выгруженными из проектной программы
с текстовым слоем.

Что делать: запросите у заказчика или проектировщика исходную РД с текстовым слоем.
Пример формулировки:

«Прошу выгрузить рабочую документацию (раздел КЖ/АР) в формате PDF с текстовым
(машиночитаемым) слоем — печатью в PDF напрямую из AutoCAD/Revit/nanoCAD,
без сканирования бумажных листов».`;
const stages = ['queued', 'parsing', 'awaiting_payment', 'delivered'];
const labels = {
  queued: 'Файл принят, заказ в очереди',
  parsing: 'Файл разбирается',
  awaiting_payment: PAYMENT_ENABLED ? 'Ожидается оплата' : 'Результат готов, менеджер выставит счёт',
  delivered: 'Результат отправлен на email',
  failed: 'Ошибка обработки'
};

const form = document.querySelector('#orderForm');
const fileInput = document.querySelector('#file');
const emailInput = document.querySelector('#email');
const websiteInput = document.querySelector('#website');
const consentInput = document.querySelector('#consent');
const optinInput = document.querySelector('#optin');
const submitBtn = document.querySelector('#submitBtn');
const message = document.querySelector('#message');
const statusBox = document.querySelector('#status');

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `notice ${kind}`.trim();
}

function renderStatus(stage, apiMessage = '', paymentUrl = null) {
  statusBox.innerHTML = '';
  const visible = stage === 'failed' ? ['queued', 'parsing', 'failed'] : stages;
  const activeIndex = visible.indexOf(stage);
  visible.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `line ${index <= activeIndex ? 'on' : ''}`.trim();
    row.innerHTML = `<span class="dot"></span><span>${labels[item] || item}</span>`;
    statusBox.append(row);
  });
  if (apiMessage) setMessage(apiMessage, stage === 'failed' ? 'bad' : 'ok');
  if (stage === 'awaiting_payment' && PAYMENT_ENABLED && isValidPaymentUrl(paymentUrl, PAYMENT_ALLOWED_HOSTS)) {
    // Provider host is intentionally not in CSP connect-src: this is a user redirect, not fetch/iframe/SDK.
    const pay = document.createElement('a');
    pay.className = 'pay';
    pay.href = paymentUrl;
    pay.rel = 'noopener';
    pay.textContent = 'Оплатить';
    statusBox.append(pay);
  } else if (stage === 'awaiting_payment' && PAYMENT_ENABLED && paymentUrl) {
    setMessage('Ссылка на оплату недоступна, свяжитесь с менеджером.', 'bad');
  }
}

async function readMagic(file) {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...bytes);
}

async function validateFile(file) {
  if (!file) throw new Error('Выберите один PDF-файл.');
  if (file.size > MAX_SIZE) throw new Error('Файл не принят: размер больше 25 МБ.');
  if (await readMagic(file) !== '%PDF-') throw new Error('Файл не принят: это не PDF.');
  setMessage('Проверяем текстовый слой PDF...');
  const textLayer = await checkTextLayer(file, { maxPages: 5, minChars: 40 });
  if (!textLayer.ok) {
    const err = new Error(NO_TEXT_MESSAGE);
    err.verbatim = true;
    throw err;
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const wait = data.retry_after ? ` Повторите через ${data.retry_after} сек.` : '';
    throw new Error(`${data.message || 'Ошибка запроса.'}${wait}`);
  }
  return data;
}

async function pollStatus(orderToken) {
  let done = false;
  while (!done) {
    const data = await api('/api/status', { headers: { Authorization: `Bearer ${orderToken}` } });
    renderStatus(data.stage, data.message, data.payment_url);
    done = ['delivered', 'failed'].includes(data.stage);
    if (!done) await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  submitBtn.disabled = true;
  statusBox.innerHTML = '';
  try {
    if (!consentInput.checked) throw new Error('Нужно подтвердить согласие с офертой и политикой.');
    if (!emailInput.validity.valid) throw new Error('Укажите корректный email.');
    const file = fileInput.files?.[0];
    if (fileInput.files?.length !== 1) throw new Error('Нужен ровно один файл.');
    await validateFile(file);
    setMessage('Создаём заказ...');
    const order = await api('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_version: CONSENT_VERSION,
        optin_extended_retention: optinInput.checked,
        email: emailInput.value.trim(),
        website: websiteInput.value || ''
      })
    });
    if (!order.order_id || !order.order_token || !order.upload_token) {
      setMessage('Заявка принята.', 'ok');
      return;
    }
    const fd = new FormData();
    fd.append('file', file, file.name);
    setMessage('Загружаем PDF...');
    await api('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${order.upload_token}` },
      body: fd
    });
    renderStatus('queued', 'Файл принят. Проверяем статус заказа.');
    await pollStatus(order.order_token);
  } catch (err) {
    setMessage(err.message || 'Не удалось отправить заказ.', err.verbatim ? 'bad' : 'bad');
  } finally {
    submitBtn.disabled = false;
  }
});
