// pdf-tables.js — order flow of the «Таблицы из PDF» product (PLAN-7 Э7).
// Difference from nakladnaya/vedomost (assets/order-flow.js): the payment link exists only
// AFTER the server-side pre-check of the upload says ok. /api/orders returns no payment_url
// (payment_stage "after_check"); the link is requested by an explicit POST /api/orders/pay when
// the user clicks the pay button, then the browser navigates to the bank. /api/status carries
// precheck: pending|ok|failed (+ precheck_message). Deliberately its own module so the shared
// engine of the 990 product and М-15 is not touched.

import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  CONSENT_VERSION,
  isValidPaymentUrl
} from './pdf-tables.config.js?v=pdf-tables-v1-2026-10';

const MAX_SIZE = 200 * 1024 * 1024;      // matches backend WEBINTAKE_MAX_FILE_SIZE_BYTES
const POLL_MS = 5000;
const MAX_POLL_ATTEMPTS = 240;           // 20 min of polling; past the cap the calm email notice shows
const PRICE_TEXT = 'Оплатить 499 ₽';
const STORE_KEY = 'av-pt:order-token';   // survives the round-trip through the bank page

// Ladder steps: index = how far the order is. The pay step is reachable only via precheck ok.
const STEPS = [
  { id: 'check', label: 'Проверяем файл' },
  { id: 'pay', label: 'Оплата' },
  { id: 'work', label: 'Извлекаем таблицы' },
  { id: 'done', label: 'Excel отправлен на email' }
];

// --- DOM refs (same ids and classes as the other product pages) ---
const form = document.querySelector('#orderForm');
const fileInput = document.querySelector('#file');
const uploadZone = document.querySelector('.upload-zone');
const fileNameBox = document.querySelector('.upload-zone__file');
const removeFileBtn = document.querySelector('#removeFile');
const emailInput = document.querySelector('#email');
const websiteInput = document.querySelector('#website');
const consentInput = document.querySelector('#consent');
const submitBtn = document.querySelector('#submitBtn');
const message = document.querySelector('#message');
const statusBox = document.querySelector('#status');

function setMessage(text, kind = '') {
  message.textContent = text;
  message.className = `notice ${kind}`.trim();
}

// --- status ladder (structural render only on phase change) ---
let ladderIndex = -1;
let tickerHandle = null;
let stageStartedAt = 0;
let activeElapsedEl = null;

function pluralRu(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function renderLadder(active) {
  statusBox.innerHTML = '';
  activeElapsedEl = null;
  STEPS.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = `line ${index <= active ? 'on' : ''}`.trim();
    const dot = document.createElement('span');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.className = 'line-label';
    label.textContent = step.label;
    row.append(dot, label);
    if (index === active && step.id === 'work') {
      const elapsed = document.createElement('span');
      elapsed.className = 'elapsed';
      elapsed.setAttribute('aria-hidden', 'true');
      elapsed.textContent = formatElapsed(Date.now() - stageStartedAt);
      activeElapsedEl = elapsed;
      row.append(elapsed);
    }
    statusBox.append(row);
  });
  ladderIndex = active;
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

function stopTicker() {
  if (tickerHandle) { clearInterval(tickerHandle); tickerHandle = null; }
}

function startTicker() {
  if (tickerHandle) return;
  tickerHandle = setInterval(() => {
    if (activeElapsedEl && ladderIndex === 2) {
      activeElapsedEl.textContent = formatElapsed(Date.now() - stageStartedAt);
    }
  }, 1000);
}

function setLadder(active) {
  if (active === ladderIndex) return;
  if (active === 2) stageStartedAt = Date.now(); // the work step counts from its first render
  renderLadder(active);
  if (active === 2) startTicker(); else stopTicker();
}

let lastQueueKey = null; // position last rendered, to re-render only on change

function appendQueueInfo(data) {
  const key = String(data.queue_position ?? '');
  if (key !== lastQueueKey) {
    statusBox.querySelectorAll('.queue-info').forEach(el => el.remove());
    if (typeof data.queue_position === 'number' && data.queue_position >= 1) {
      const pos = document.createElement('p');
      pos.className = 'queue-info';
      const word = pluralRu(data.queue_position, 'документ', 'документа', 'документов');
      pos.textContent = `Перед вами в очереди: ${data.queue_position} ${word}`;
      statusBox.append(pos);
    }
    lastQueueKey = key;
  }
  if (!statusBox.querySelector('.queue-note')) {
    const note = document.createElement('p');
    note.className = 'queue-note';
    note.textContent = 'Готовый Excel придёт на email — это окно можно закрыть.';
    statusBox.append(note);
  }
}

// --- payment: the link is asked for only when the user clicks ---
async function payNow(orderToken) {
  statusBox.querySelectorAll('button.pay').forEach(el => el.remove()); // resume must not stack buttons
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pay';
  btn.textContent = PRICE_TEXT;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    setMessage('Открываем оплату…', 'ok');
    try {
      const { ok, data } = await request('/api/orders/pay', {
        method: 'POST',
        headers: { Authorization: `Bearer ${orderToken}` }
      });
      if (!ok) {
        // Honest per-code wording; the backend message already speaks plainly.
        // precheck_pending just needs a "wait and retry" nudge, not the raw code.
        let text = data.message || 'Не удалось открыть оплату. Попробуйте ещё раз.';
        if (data.error_code === 'precheck_pending') {
          text = 'Файл ещё проверяется — подождите минуту и нажмите кнопку ещё раз.';
        } else if (data.error_code === 'already_paid') {
          text = 'Заказ уже оплачен. Обновите страницу — статус обновится сам.';
        }
        setMessage(text, 'bad');
        btn.disabled = false;
        return;
      }
      const url = data.payment_url;
      if (typeof url !== 'string' || !isValidPaymentUrl(url, PAYMENT_ALLOWED_HOSTS)) {
        setMessage('Ссылка на оплату недоступна, свяжитесь с менеджером.', 'bad');
        btn.disabled = false;
        return;
      }
      storeToken(orderToken); // the return from the bank resumes polling from this
      window.location.assign(url);
    } catch (err) {
      setMessage(err.message || 'Не удалось открыть оплату.', 'bad');
      btn.disabled = false;
    }
  });
  statusBox.append(btn);
}

function renderPayReady() {
  setLadder(1);
  setMessage('Файл подошёл — можно оплатить.', 'ok');
}

function renderPrecheckPending() {
  setLadder(0);
}

function renderProcessing(data) {
  setLadder(2);
  appendQueueInfo(data);
}

function renderDelivered(apiMessage) {
  setLadder(3);
  setMessage(apiMessage || 'Готовый Excel отправлен на email.', 'ok');
}

function renderFailed(apiMessage) {
  setMessage(apiMessage || 'Не удалось обработать файл.', 'bad');
}

// --- API ---
async function request(path, options = {}) {
  const res = await fetch(`${API_ORIGIN}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const wait = data.retry_after ? ` Повторите через ${data.retry_after} сек.` : '';
    throw Object.assign(new Error(`${data.message || 'Ошибка запроса.'}${wait}`), { errorCode: data.error_code, data });
  }
  return { ok: true, data };
}

// --- polling ---
let polling = false;

function storeToken(token) {
  try { sessionStorage.setItem(STORE_KEY, token); } catch (_) { /* storage is optional */ }
}

function clearToken() {
  try { sessionStorage.removeItem(STORE_KEY); } catch (_) { /* storage is optional */ }
}

async function pollStatus(orderToken) {
  polling = true;
  let attempts = 0;
  try {
    while (true) {
      const { data } = await request('/api/status', { headers: { Authorization: `Bearer ${orderToken}` } });
      attempts += 1;
      const precheck = data.precheck;
      if (precheck === 'failed') {
        setLadder(0);
        setMessage(data.precheck_message || 'Файл не подошёл для обработки. Загрузите другой файл.', 'bad');
        clearToken();
        break;
      }
      const stage = data.stage;
      if (stage === 'delivered') {
        renderDelivered(data.message);
        clearToken();
        break;
      }
      if (stage === 'failed') {
        // a refund also lands here: the message says the reason and "Деньги возвращены на карту"
        renderFailed(data.message);
        clearToken();
        break;
      }
      if (stage === 'queued' || stage === 'parsing') {
        renderProcessing(data);
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setMessage('Обработка продолжается на сервере. Готовый Excel придёт на указанную почту — это окно можно закрыть.', 'ok');
          break;
        }
      } else if (precheck === 'ok') {
        // unpaid, the file is ok: the user must click the pay button, polling stops
        renderPayReady();
        payNow(orderToken);
        break;
      } else {
        // precheck still pending (or the upload is still settling)
        renderPrecheckPending();
        setMessage(data.precheck_message || 'Проверяем файл…', 'ok');
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setMessage('Проверка файла затянулась. Обновите страницу позже — статус заказа сохранится.', 'ok');
          break;
        }
      }
      await new Promise(resolve => setTimeout(resolve, POLL_MS));
    }
  } catch (err) {
    setMessage(err.message || 'Не удалось получить статус заказа.', 'bad');
  } finally {
    stopTicker();
    polling = false;
  }
}

// --- file selection (same behaviour as the other product pages) ---
async function readMagic(file) {
  const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...bytes);
}

function formatBytes(n) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function renderFileSelection() {
  const file = fileInput.files?.[0];
  if (file) {
    fileNameBox.textContent = `${file.name} · ${formatBytes(file.size)}`;
    uploadZone.classList.add('has-file');
    removeFileBtn.classList.add('is-visible');
  } else {
    fileNameBox.textContent = '';
    uploadZone.classList.remove('has-file');
    removeFileBtn.classList.remove('is-visible');
  }
}

fileInput.addEventListener('change', renderFileSelection);
removeFileBtn.addEventListener('click', event => {
  event.preventDefault();
  try { fileInput.value = ''; fileInput.files = new DataTransfer().files; }
  catch (_) { fileInput.value = ''; }
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
});
['dragenter', 'dragover'].forEach(type =>
  uploadZone.addEventListener(type, event => { event.preventDefault(); uploadZone.classList.add('dragover'); })
);
['dragleave', 'dragend'].forEach(type =>
  uploadZone.addEventListener(type, () => uploadZone.classList.remove('dragover'))
);
uploadZone.addEventListener('drop', event => {
  event.preventDefault();
  uploadZone.classList.remove('dragover');
  const dropped = event.dataTransfer?.files;
  if (!dropped || !dropped.length) return;
  try {
    const dt = new DataTransfer();
    for (const f of dropped) dt.items.add(f);
    fileInput.files = dt.files;
  } catch (_) {
    try { fileInput.files = dropped; } catch (_) { /* browser refused programmatic set */ }
  }
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
});

// --- submit: consent + email + PDF, then order → upload → poll ---
form.addEventListener('submit', async event => {
  event.preventDefault();
  submitBtn.disabled = true;
  statusBox.innerHTML = '';
  ladderIndex = -1;
  try {
    if (!consentInput.checked) throw new Error('Нужно подтвердить согласие с офертой и политикой.');
    if (!emailInput.validity.valid) throw new Error('Укажите корректный email.');
    const file = fileInput.files?.[0];
    if (fileInput.files?.length !== 1) throw new Error('Нужен ровно один файл.');
    if (file.size > MAX_SIZE) throw new Error('Файл не принят: размер больше ' + Math.round(MAX_SIZE / (1024 * 1024)) + ' МБ.');
    if (await readMagic(file) !== '%PDF-') throw new Error('Файл не принят: это не PDF.');
    setMessage('Создаём заказ...');
    const { data: order } = await request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: 'pdf-tables',
        consent_version: CONSENT_VERSION,
        email: emailInput.value.trim(),
        website: websiteInput ? websiteInput.value || '' : ''
      })
    });
    if (!order.order_id || !order.order_token || !order.upload_token) {
      setMessage('Заявка принята.', 'ok');
      return;
    }
    storeToken(order.order_token);
    setMessage('Загружаем PDF. После загрузки проверим файл.');
    const fd = new FormData();
    fd.append('file', file, file.name);
    await request('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${order.upload_token}` },
      body: fd
    });
    renderPrecheckPending();
    setMessage('Файл принят. Проверяем файл…', 'ok');
    await pollStatus(order.order_token);
  } catch (err) {
    const text = err.errorCode === 'invalid_product'
      ? 'Сервис пока доступен по приглашению.'
      : (err.message || 'Не удалось отправить заказ.');
    setMessage(text, 'bad');
  } finally {
    submitBtn.disabled = false;
  }
});

// --- resume after the bank: the token saved before the redirect brings the order back ---
function resume() {
  if (polling) return;
  let token = null;
  try { token = sessionStorage.getItem(STORE_KEY); } catch (_) { return; }
  if (!token) return;
  setMessage('Восстанавливаем статус заказа…', 'ok');
  pollStatus(token);
}

resume();
window.addEventListener('pageshow', event => {
  if (event.persisted) resume(); // back from the bank via bfcache
});
