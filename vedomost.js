import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  PAYMENT_ENABLED,
  CONSENT_VERSION,
  isValidPaymentUrl
} from './vedomost.config.js?v=vedomost-v2-2026-06';
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
const stages = PAYMENT_ENABLED
  ? ['queued', 'parsing', 'awaiting_payment', 'delivered']
  : ['queued', 'parsing', 'delivered'];
const labels = {
  queued: 'Файл принят, заказ в очереди',
  parsing: 'Извлекаем объёмы из чертежа',
  awaiting_payment: PAYMENT_ENABLED ? 'Ожидается оплата' : 'Результат готов',
  delivered: 'Готовая ведомость отправлена на email',
  failed: 'Ошибка обработки'
};
const RATING_REASON_LABELS = {
  extraction_wrong: 'Данные извлечены неверно или неполно',
  wrong_section: 'Распознан не тот раздел / не те листы',
  format: 'Неудобный формат XLSX',
  late: 'Результат пришёл не вовремя',
  other: 'Другое'
};
const RATING_REASONS = Object.keys(RATING_REASON_LABELS);

const form = document.querySelector('#orderForm');
const fileInput = document.querySelector('#file');
const uploadZone = document.querySelector('.upload-zone');
const fileNameBox = document.querySelector('.upload-zone__file');
const removeFileBtn = document.querySelector('#removeFile');
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

// --- status stages + client-only per-stage processing timer (CSP- and a11y-safe) ---
const TICKING_STAGES = ['queued', 'parsing'];
let timerHandle = null;
let stageStartedAt = 0;
let activeStage = '';
let activeMessage = '';
let activePaymentUrl = null;
let activeElapsedEl = null;
let activeCanRate = false;
let activeOrderToken = '';
let ratingSubmitted = false;
const stageDurations = {}; // completed PROCESSING stage -> ms (ticking stages only)

function formatElapsed(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
}

function stopStatusTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function tickElapsed() {
  if (activeElapsedEl && TICKING_STAGES.includes(activeStage)) {
    activeElapsedEl.textContent = formatElapsed(Date.now() - stageStartedAt);
  }
}

function buildVisible(stage) {
  if (stage === 'failed') return ['queued', 'parsing', 'failed'];
  if (stages.includes(stage)) return stages;
  return [...stages.slice(0, -1), stage]; // defensive: show an unexpected stage as the current one
}

// Structural render — runs ONLY on stage change (or a payment-url change at the same stage),
// so #status[aria-live] is not rebuilt every tick and the paid payment link stays stable.
function renderStatusStructure(stage, apiMessage = '', paymentUrl = null) {
  statusBox.innerHTML = '';
  activeElapsedEl = null;
  const visible = buildVisible(stage);
  const activeIndex = visible.indexOf(stage);
  visible.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `line ${index <= activeIndex ? 'on' : ''}`.trim();
    const dot = document.createElement('span');
    dot.className = 'dot';
    const label = document.createElement('span');
    label.className = 'line-label';
    label.textContent = labels[item] || 'Статус обновляется';
    row.append(dot, label);
    const elapsed = document.createElement('span');
    elapsed.className = 'elapsed';
    elapsed.setAttribute('aria-hidden', 'true'); // keep the ticking time out of the live region
    if (index < activeIndex && stageDurations[item] != null) {
      elapsed.textContent = formatElapsed(stageDurations[item]);
    } else if (index === activeIndex && TICKING_STAGES.includes(item)) {
      elapsed.textContent = formatElapsed(Date.now() - stageStartedAt);
      activeElapsedEl = elapsed;
    }
    row.append(elapsed);
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

function setStage(stage, apiMessage = '', paymentUrl = null, canRate = false, orderToken = '') {
  activeCanRate = canRate === true;
  if (orderToken) activeOrderToken = orderToken;
  // monotonic guard: ignore a known stage that moves backwards (failed always wins)
  if (stage !== 'failed' && stages.includes(stage) && stages.includes(activeStage)
      && stages.indexOf(stage) < stages.indexOf(activeStage)) {
    return;
  }
  if (stage === activeStage) { // repeat poll: no structural rebuild, but apply message/payment changes
    if (paymentUrl !== activePaymentUrl) {
      activePaymentUrl = paymentUrl;
      activeMessage = apiMessage;
      renderStatusStructure(stage, apiMessage, paymentUrl);
    } else if (apiMessage && apiMessage !== activeMessage) {
      activeMessage = apiMessage;
      setMessage(apiMessage, stage === 'failed' ? 'bad' : 'ok');
    }
    tickElapsed();
    renderInlineRatingWidget();
    return;
  }
  if (TICKING_STAGES.includes(activeStage)) {
    stageDurations[activeStage] = Date.now() - stageStartedAt; // record duration for processing stages only
  }
  activeStage = stage;
  activeMessage = apiMessage;
  activePaymentUrl = paymentUrl;
  stageStartedAt = Date.now();
  renderStatusStructure(stage, apiMessage, paymentUrl);
  renderInlineRatingWidget();
  if (TICKING_STAGES.includes(stage)) {
    if (!timerHandle) timerHandle = setInterval(tickElapsed, 1000);
  } else {
    stopStatusTimer(); // pause on awaiting_payment / delivered / failed
  }
}

function startProcessing(message) {
  stopStatusTimer();
  activeStage = '';
  activeMessage = '';
  activePaymentUrl = null;
  activeElapsedEl = null;
  activeCanRate = false;
  activeOrderToken = '';
  ratingSubmitted = false;
  for (const k of Object.keys(stageDurations)) delete stageDurations[k];
  stageStartedAt = Date.now();
  setStage('queued', message); // set the initial stage before any tick → no blank render
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

function updateInlineRatingSubmit(submitBtn, score, reason) {
  submitBtn.disabled = !(score === 1 || (score === -1 && reason));
}

function renderInlineRatingForm(box) {
  let selectedScore = null;
  let selectedReason = '';
  box.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'inline-rating__form';
  const title = document.createElement('p');
  title.className = 'inline-rating__title';
  title.textContent = 'Ведомость подошла?';
  const scoreRow = document.createElement('div');
  scoreRow.className = 'inline-rating__scores';
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'inline-rating__score';
  up.textContent = 'Да, всё верно';
  up.setAttribute('aria-pressed', 'false');
  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'inline-rating__score';
  down.textContent = 'Есть замечания';
  down.setAttribute('aria-pressed', 'false');
  scoreRow.append(up, down);

  const reasons = document.createElement('div');
  reasons.className = 'inline-rating__reasons';
  reasons.hidden = true;
  const reasonTitle = document.createElement('p');
  reasonTitle.className = 'inline-rating__label';
  reasonTitle.textContent = 'Что именно не подошло?';
  reasons.append(reasonTitle);
  RATING_REASONS.forEach(reason => {
    const label = document.createElement('label');
    label.className = 'inline-rating__reason';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'inline-rating-reason';
    input.value = reason;
    const text = document.createElement('span');
    text.textContent = RATING_REASON_LABELS[reason];
    input.addEventListener('change', () => {
      selectedReason = reason;
      updateInlineRatingSubmit(submit, selectedScore, selectedReason);
    });
    label.append(input, text);
    reasons.append(label);
  });

  const commentLabel = document.createElement('label');
  commentLabel.className = 'inline-rating__comment';
  commentLabel.hidden = true;
  const commentText = document.createElement('span');
  commentText.className = 'inline-rating__label';
  commentText.textContent = 'Комментарий';
  const comment = document.createElement('textarea');
  comment.rows = 3;
  comment.maxLength = 2000;
  comment.placeholder = 'Коротко опишите, что проверить';
  commentLabel.append(commentText, comment);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'btn btn-primary inline-rating__submit';
  submit.textContent = 'Отправить оценку';
  const error = document.createElement('p');
  error.className = 'inline-rating__error';

  function applyScore(score) {
    selectedScore = score;
    up.setAttribute('aria-pressed', score === 1 ? 'true' : 'false');
    down.setAttribute('aria-pressed', score === -1 ? 'true' : 'false');
    reasons.hidden = score !== -1;
    commentLabel.hidden = score !== -1;
    updateInlineRatingSubmit(submit, selectedScore, selectedReason);
  }

  up.addEventListener('click', () => applyScore(1));
  down.addEventListener('click', () => applyScore(-1));
  updateInlineRatingSubmit(submit, selectedScore, selectedReason);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    updateInlineRatingSubmit(submit, selectedScore, selectedReason);
    if (submit.disabled) return;
    submit.disabled = true;
    error.textContent = '';
    try {
      const result = await api('/api/rate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeOrderToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          score: selectedScore,
          reason: selectedScore === -1 ? selectedReason : null,
          comment: comment.value
        })
      });
      activeCanRate = false;
      ratingSubmitted = true;
      box.innerHTML = '';
      const thanks = document.createElement('p');
      thanks.className = 'inline-rating__thanks';
      thanks.textContent = result.already_rated ? 'Спасибо, оценка уже учтена.' : 'Спасибо, оценка учтена.';
      box.append(thanks);
    } catch (err) {
      error.textContent = err.message || 'Не удалось отправить оценку.';
      updateInlineRatingSubmit(submit, selectedScore, selectedReason);
    }
  });

  form.append(title, scoreRow, reasons, commentLabel, submit, error);
  box.append(form);
}

function renderInlineRatingWidget() {
  const existing = document.querySelector('#inline-rating');
  if (activeStage !== 'delivered' || !activeCanRate || ratingSubmitted || !activeOrderToken) {
    if (existing) existing.remove();
    return;
  }
  if (existing) return;
  const box = document.createElement('div');
  box.id = 'inline-rating';
  box.className = 'inline-rating';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-secondary inline-rating__open';
  button.textContent = 'Оценить результат';
  button.addEventListener('click', () => renderInlineRatingForm(box));
  box.append(button);
  statusBox.append(box);
}

const TERMINAL_STAGES = ['delivered', 'failed'];
const MAX_POLL_ATTEMPTS = 120;

async function pollStatus(orderToken) {
  let done = false;
  let attempts = 0;
  while (!done) {
    const data = await api('/api/status', { headers: { Authorization: `Bearer ${orderToken}` } });
    setStage(data.stage, data.message, data.payment_url, data.can_rate === true, orderToken);
    attempts += 1;
    done = TERMINAL_STAGES.includes(data.stage);
    if (!PAYMENT_ENABLED && !done && attempts >= MAX_POLL_ATTEMPTS) {
      setMessage('Превышено время ожидания обработки. Свяжитесь с менеджером.', 'bad');
      done = true;
    }
    if (!done) await new Promise(resolve => setTimeout(resolve, 5000));
  }
  stopStatusTimer();
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
  fileInput.dispatchEvent(new Event('change', { bubbles: true })); // single render path
});
form.addEventListener('reset', () => setTimeout(() => fileInput.dispatchEvent(new Event('change', { bubbles: true })), 0));
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
        optin_extended_retention: optinInput ? optinInput.checked : false,
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
    startProcessing('Файл принят. Проверяем статус заказа.');
    await pollStatus(order.order_token);
  } catch (err) {
    stopStatusTimer();
    setMessage(err.message || 'Не удалось отправить заказ.', err.verbatim ? 'bad' : 'bad');
  } finally {
    submitBtn.disabled = false;
  }
});
const sourceTabs = [...document.querySelectorAll('.source-tab')];
const previewLabel = document.querySelector('.result-preview__head .mono');
const SOURCE_VIEW_LABELS = ['РД · АР-6', 'XLSX · ВЕДОМОСТЬ', 'QA · ИСТОЧНИКИ'];

function activateSourceTab(activeIndex) {
  sourceTabs.forEach((tab, i) => {
    const isActive = i === activeIndex;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  if (previewLabel && SOURCE_VIEW_LABELS[activeIndex]) previewLabel.textContent = SOURCE_VIEW_LABELS[activeIndex];
}

sourceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateSourceTab(index));
});
