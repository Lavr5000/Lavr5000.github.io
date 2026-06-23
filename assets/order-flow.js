// assets/order-flow.js — shared order+payment engine for vedomost.html and nakladnaya.html.
// Usage: import { initOrderFlow } from './assets/order-flow.js'; initOrderFlow(config);
// All DOM queries and state variables live INSIDE initOrderFlow() for module isolation.
//
// Static imports: API_ORIGIN, PAYMENT_ALLOWED_HOSTS, isValidPaymentUrl from vedomost.config.js
// (shared infra constants — NOT the PAYMENT_ENABLED flag, which comes from config.paymentEnabled).
// Note: the config file is named vedomost.config.js for historical reasons; it is shared infra.
// Dynamic import: textlayer-check.js is loaded ONLY when config.checkTextLayer === true,
// so nakladnaya (checkTextLayer:false) never pulls in that dependency.

import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  isValidPaymentUrl
} from '../vedomost.config.js?v=vedomost-v2-2026-06';

const MAX_SIZE = 200 * 1024 * 1024;  // matches backend WEBINTAKE_MAX_FILE_SIZE_BYTES=209715200 (1G preflight large-PDF intake)

// config contract (all fields required unless noted):
//   product            string | null     — null => product field is NOT sent in /api/orders
//   consentVersion     string
//   paymentEnabled     boolean           — gates: pay-link, free-quota indicator, awaiting_payment poll-stop
//   stages             string[]
//   failedStages       string[]          — stages shown when stage === 'failed'
//   labels             { [stage]: string }
//   ratingReasonLabels { [reason]: string }
//   ratingTitle        string
//   maxPollAttempts    number
//   payButtonText      string
//   checkTextLayer     boolean
//   noTextMessage      string            — used only when checkTextLayer === true (else '')
//   consentError       string
//   hasOptin           boolean
//   uploadMessage      (paymentRequired: boolean) => string
//   sourceViewLabels   string[]
//   awaitingFallbackMessage string       — shown at awaiting_payment when no valid URL yet

export function initOrderFlow(config) {
  // --- Init-validation: fail-closed if required DOM is missing ---
  const REQUIRED_IDS = ['orderForm', 'file', 'email', 'consent', 'submitBtn', 'message', 'status', 'removeFile'];
  for (const id of REQUIRED_IDS) {
    if (!document.querySelector(`#${id}`)) {
      console.error(`[order-flow] Required element #${id} not found — aborting init.`);
      return;
    }
  }
  if (!document.querySelector('.upload-zone')) {
    console.error('[order-flow] Required element .upload-zone not found — aborting init.');
    return;
  }
  if (!document.querySelector('.upload-zone__file')) {
    console.error('[order-flow] Required element .upload-zone__file not found — aborting init.');
    return;
  }
  if (config.hasOptin && !document.querySelector('#optin')) {
    console.error('[order-flow] config.hasOptin is true but #optin not found — aborting init.');
    return;
  }

  // --- DOM refs ---
  const form = document.querySelector('#orderForm');
  const fileInput = document.querySelector('#file');
  const uploadZone = document.querySelector('.upload-zone');
  const fileNameBox = document.querySelector('.upload-zone__file');
  const removeFileBtn = document.querySelector('#removeFile');
  const emailInput = document.querySelector('#email');
  const websiteInput = document.querySelector('#website');
  const consentInput = document.querySelector('#consent');
  const optinInput = config.hasOptin ? document.querySelector('#optin') : null;
  const submitBtn = document.querySelector('#submitBtn');
  const message = document.querySelector('#message');
  const statusBox = document.querySelector('#status');

  function setMessage(text, kind = '') {
    message.textContent = text;
    message.className = `notice ${kind}`.trim();
  }

  // --- Status stages + client-only per-stage processing timer (CSP- and a11y-safe) ---
  const TICKING_STAGES = ['queued', 'parsing'];
  let timerHandle = null;
  let stageStartedAt = 0;
  let activeStage = '';
  let activeMessage = '';
  let activePaymentUrl = null;
  let activeElapsedEl = null;
  let activeCanRate = false;
  let activeOrderToken = '';
  let activeFreeRemaining = null;
  let ratingSubmitted = false;
  const stageDurations = {}; // completed ticking stage -> ms

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
    if (stage === 'failed') return config.failedStages;
    if (config.stages.includes(stage)) return config.stages;
    return [...config.stages.slice(0, -1), stage]; // defensive: unknown stage shown as current
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
      label.textContent = config.labels[item] || 'Статус обновляется';
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
    if (config.paymentEnabled && typeof activeFreeRemaining === 'number') {
      const quota = document.createElement('p');
      quota.className = 'free-quota';
      quota.textContent = `Бесплатных генераций осталось: ${activeFreeRemaining}`;
      statusBox.append(quota);
    }
    if (apiMessage) setMessage(apiMessage, stage === 'failed' ? 'bad' : 'ok');
    if (stage === 'awaiting_payment' && config.paymentEnabled) {
      // Protect against null/non-string before passing to validator (round-2 #1)
      const hasValidPayUrl = typeof paymentUrl === 'string' && isValidPaymentUrl(paymentUrl, PAYMENT_ALLOWED_HOSTS);
      if (hasValidPayUrl) {
        // Provider host is intentionally not in CSP connect-src: this is a user redirect, not fetch/iframe/SDK.
        const pay = document.createElement('a');
        pay.className = 'pay';
        pay.href = paymentUrl;
        pay.rel = 'noopener noreferrer';
        // Redirect in same tab (no target attribute), per spec §3
        pay.textContent = config.payButtonText;
        statusBox.append(pay);
      } else if (paymentUrl) {
        // URL present but invalid host — show error message
        setMessage('Ссылка на оплату недоступна, свяжитесь с менеджером.', 'bad');
      } else {
        // No URL yet — show fallback message, polling continues
        setMessage(config.awaitingFallbackMessage, 'ok');
      }
    }
  }

  function setStage(stage, apiMessage = '', paymentUrl = null, canRate = false, orderToken = '') {
    activeCanRate = canRate === true;
    if (orderToken) activeOrderToken = orderToken;
    // Monotonic guard: ignore a known stage that moves backwards (failed always wins)
    if (stage !== 'failed' && config.stages.includes(stage) && config.stages.includes(activeStage)
        && config.stages.indexOf(stage) < config.stages.indexOf(activeStage)) {
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
      stageDurations[activeStage] = Date.now() - stageStartedAt; // record duration for ticking stages only
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

  function startProcessing(msg) {
    stopStatusTimer();
    activeStage = '';
    activeMessage = '';
    activePaymentUrl = null;
    activeElapsedEl = null;
    activeCanRate = false;
    activeOrderToken = '';
    activeFreeRemaining = null;
    ratingSubmitted = false;
    for (const k of Object.keys(stageDurations)) delete stageDurations[k];
    stageStartedAt = Date.now();
    setStage('queued', msg); // set the initial stage before any tick → no blank render
  }

  async function readMagic(file) {
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...bytes);
  }

  async function validateFile(file) {
    if (!file) throw new Error('Выберите один PDF-файл.');
    if (file.size > MAX_SIZE) throw new Error('Файл не принят: размер больше ' + Math.round(MAX_SIZE / (1024 * 1024)) + ' МБ.');
    if (await readMagic(file) !== '%PDF-') throw new Error('Файл не принят: это не PDF.');
    if (config.checkTextLayer) {
      // Dynamic import: only loaded for pages that need text-layer validation (e.g. vedomost).
      // nakladnaya (checkTextLayer:false) never loads this module.
      setMessage('Проверяем текстовый слой PDF...');
      const { checkTextLayer } = await import('./textlayer-check.js');
      const textLayer = await checkTextLayer(file, { maxPages: 5, minChars: 40 });
      if (!textLayer.ok) {
        const err = new Error(config.noTextMessage);
        err.verbatim = true;
        throw err;
      }
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

  function updateInlineRatingSubmit(submitEl, score, reason) {
    submitEl.disabled = !(score === 1 || (score === -1 && reason));
  }

  function renderInlineRatingForm(box) {
    const ratingReasonLabels = config.ratingReasonLabels;
    const ratingReasons = Object.keys(ratingReasonLabels);
    let selectedScore = null;
    let selectedReason = '';
    box.innerHTML = '';
    const ratingForm = document.createElement('form');
    ratingForm.className = 'inline-rating__form';
    const titleEl = document.createElement('p');
    titleEl.className = 'inline-rating__title';
    titleEl.textContent = config.ratingTitle;
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
    ratingReasons.forEach(reason => {
      const reasonLabel = document.createElement('label');
      reasonLabel.className = 'inline-rating__reason';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'inline-rating-reason';
      input.value = reason;
      const text = document.createElement('span');
      text.textContent = ratingReasonLabels[reason];
      input.addEventListener('change', () => {
        selectedReason = reason;
        updateInlineRatingSubmit(submitBtn2, selectedScore, selectedReason);
      });
      reasonLabel.append(input, text);
      reasons.append(reasonLabel);
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

    const submitBtn2 = document.createElement('button');
    submitBtn2.type = 'submit';
    submitBtn2.className = 'btn btn-primary inline-rating__submit';
    submitBtn2.textContent = 'Отправить оценку';
    const error = document.createElement('p');
    error.className = 'inline-rating__error';

    function applyScore(score) {
      selectedScore = score;
      up.setAttribute('aria-pressed', score === 1 ? 'true' : 'false');
      down.setAttribute('aria-pressed', score === -1 ? 'true' : 'false');
      reasons.hidden = score !== -1;
      commentLabel.hidden = score !== -1;
      updateInlineRatingSubmit(submitBtn2, selectedScore, selectedReason);
    }

    up.addEventListener('click', () => applyScore(1));
    down.addEventListener('click', () => applyScore(-1));
    updateInlineRatingSubmit(submitBtn2, selectedScore, selectedReason);
    ratingForm.addEventListener('submit', async event => {
      event.preventDefault();
      updateInlineRatingSubmit(submitBtn2, selectedScore, selectedReason);
      if (submitBtn2.disabled) return;
      submitBtn2.disabled = true;
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
        updateInlineRatingSubmit(submitBtn2, selectedScore, selectedReason);
      }
    });

    ratingForm.append(titleEl, scoreRow, reasons, commentLabel, submitBtn2, error);
    box.append(ratingForm);
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

  async function pollStatus(orderToken) {
    let done = false;
    let attempts = 0;
    while (!done) {
      const data = await api('/api/status', { headers: { Authorization: `Bearer ${orderToken}` } });
      // Read free_quota_remaining BEFORE setStage so renderStatusStructure sees the updated value
      activeFreeRemaining = typeof data.free_quota_remaining === 'number' ? data.free_quota_remaining : null;
      setStage(data.stage, data.message, data.payment_url, data.can_rate === true, orderToken);
      attempts += 1;
      // awaiting_payment is a user-action state (redirect to the bank): stop polling ONLY once
      // we reach it WITH a valid payment URL — if the URL isn't ready yet, keep polling until
      // it arrives or the cap is hit (per spec §3 round-1/#1/#10).
      const hasValidPayUrl = typeof data.payment_url === 'string' && isValidPaymentUrl(data.payment_url, PAYMENT_ALLOWED_HOSTS);
      done = TERMINAL_STAGES.includes(data.stage)
        || (config.paymentEnabled && data.stage === 'awaiting_payment' && hasValidPayUrl);
      if (!done && attempts >= config.maxPollAttempts) {
        // A large file can legitimately process past the client poll cap; the backend
        // still delivers the result by email, so avoid a scary "contact us" dead-end.
        // The awaiting-payment stall is a real stuck state and keeps the old notice.
        if (data.stage === 'awaiting_payment') {
          setMessage('Превышено время ожидания обработки. Свяжитесь с менеджером.', 'bad');
        } else {
          setMessage('Файл большой — обработка продолжается на сервере. Готовая ведомость придёт на указанную почту, это окно можно закрыть.', 'ok');
        }
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
    // Disable submit for the entire submit+poll cycle — re-enabled in finally after pollStatus completes.
    // This prevents a second concurrent order while polling is active (no generation-counter needed).
    submitBtn.disabled = true;
    statusBox.innerHTML = '';
    try {
      if (!consentInput.checked) throw new Error(config.consentError);
      if (!emailInput.validity.valid) throw new Error('Укажите корректный email.');
      const file = fileInput.files?.[0];
      if (fileInput.files?.length !== 1) throw new Error('Нужен ровно один файл.');
      await validateFile(file);
      setMessage('Создаём заказ...');
      const orderBody = {
        consent_version: config.consentVersion,
        optin_extended_retention: optinInput ? optinInput.checked : false,
        email: emailInput.value.trim(),
        website: websiteInput ? websiteInput.value || '' : ''
      };
      // product field is omitted entirely when null (backend uses its own default)
      if (config.product !== null) orderBody.product = config.product;
      const order = await api('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderBody)
      });
      if (!order.order_id || !order.order_token || !order.upload_token) {
        setMessage('Заявка принята.', 'ok');
        return;
      }
      const fd = new FormData();
      fd.append('file', file, file.name);
      setMessage(config.uploadMessage(order.payment_required === true));
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
      // Re-enable submit ONLY after pollStatus completes — button stays disabled for the entire poll cycle
      submitBtn.disabled = false;
    }
  });

  const sourceTabs = [...document.querySelectorAll('.source-tab')];
  const previewLabel = document.querySelector('.result-preview__head .mono');

  function activateSourceTab(activeIndex) {
    sourceTabs.forEach((tab, i) => {
      const isActive = i === activeIndex;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (previewLabel && config.sourceViewLabels[activeIndex]) {
      previewLabel.textContent = config.sourceViewLabels[activeIndex];
    }
  }

  sourceTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateSourceTab(index));
  });
}
