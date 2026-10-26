// pdf-tables-order.js — order flow of «Таблицы из PDF» inside the catalog dialog (PLAN-7 Э7, PO 26.10 Р-3).
// The payment link exists only AFTER the server-side pre-check of the upload says ok: /api/orders returns
// no payment_url (payment_stage "after_check"); the link is asked for by POST /api/orders/pay when the
// user clicks the pay button, then the browser goes to the bank. /api/status carries
// precheck: pending|ok|failed (+ precheck_message).
// There is no "send order" button: the check starts by itself once a PDF, a valid email and the
// consent are all in place. Without a passed check there is no pay button; without payment no work.

import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  CONSENT_VERSION,
  isValidPaymentUrl
} from './pdf-tables.config.js?v=pdf-tables-v1-2026-10';

const MAX_SIZE = 200 * 1024 * 1024;      // backend WEBINTAKE_MAX_FILE_SIZE_BYTES; the real limit is 25 sheets
const POLL_MS = 5000;
const MAX_POLL_ATTEMPTS = 240;           // 20 min of polling; past the cap the calm email notice shows
const PRICE_TEXT = 'Оплатить 499 ₽';
const STORE_KEY = 'av-pt:order-token';   // survives the round-trip through the bank page

const STEPS = ['Проверяем файл', 'Оплата', 'Извлекаем таблицы', 'Excel отправлен на почту'];

export function hasStoredOrder() {
  try { return Boolean(sessionStorage.getItem(STORE_KEY)); } catch (_) { return false; }
}

export function mountPdfTablesOrder(root) {
  const $ = name => root.querySelector(`[data-pt="${name}"]`);
  const fileInput = $('file');
  const zone = $('zone');
  const fileName = $('file-name');
  const removeBtn = $('remove');
  const emailInput = $('email');
  const websiteInput = $('website');
  const consentInput = $('consent');
  const message = $('message');
  const statusBox = $('status');

  let busy = false;          // an order is being created / uploaded / polled
  let startedKey = null;     // the file the current order was made for
  let ladderIndex = -1;
  let tickerHandle = null;
  let stageStartedAt = 0;
  let elapsedEl = null;

  function setMessage(text, kind = '') {
    message.textContent = text;
    message.dataset.state = kind || 'idle';
  }

  // The dialog may not be closed by a stray click while the browser goes to the bank.
  function setLocked(on) {
    if (on) root.dataset.locked = '1'; else delete root.dataset.locked;
  }

  function setFormEnabled(on) {
    emailInput.disabled = !on;
    consentInput.disabled = !on;
    fileInput.disabled = !on;
    zone.classList.toggle('is-disabled', !on);
  }

  // --- status ladder ---
  function formatElapsed(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m > 0 ? `${m} мин ${s} сек` : `${s} сек`;
  }

  function stopTicker() {
    if (tickerHandle) { clearInterval(tickerHandle); tickerHandle = null; }
  }

  function setLadder(active) {
    if (active === ladderIndex) return;
    if (active === 2) stageStartedAt = Date.now();
    statusBox.querySelectorAll('.pt-ladder').forEach(el => el.remove());
    const list = document.createElement('ol');
    list.className = 'pt-ladder';
    elapsedEl = null;
    STEPS.forEach((label, index) => {
      const li = document.createElement('li');
      if (index <= active) li.className = 'on';
      li.textContent = label;
      if (index === active && index === 2) {
        elapsedEl = document.createElement('span');
        elapsedEl.className = 'pt-elapsed';
        elapsedEl.setAttribute('aria-hidden', 'true');
        elapsedEl.textContent = formatElapsed(0);
        li.append(' ', elapsedEl);
      }
      list.append(li);
    });
    statusBox.prepend(list);
    ladderIndex = active;
    stopTicker();
    if (active === 2) {
      tickerHandle = setInterval(() => {
        if (elapsedEl) elapsedEl.textContent = formatElapsed(Date.now() - stageStartedAt);
      }, 1000);
    }
  }

  function clearStatus() {
    stopTicker();
    statusBox.innerHTML = '';
    ladderIndex = -1;
  }

  // --- API ---
  async function request(path, options = {}) {
    const res = await fetch(`${API_ORIGIN}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const wait = data.retry_after ? ` Повторите через ${data.retry_after} сек.` : '';
      throw Object.assign(new Error(`${data.message || 'Ошибка запроса.'}${wait}`), { errorCode: data.error_code, data });
    }
    return data;
  }

  function storeToken(token) {
    try { sessionStorage.setItem(STORE_KEY, token); } catch (_) { /* storage is optional */ }
  }

  function clearToken() {
    try { sessionStorage.removeItem(STORE_KEY); } catch (_) { /* storage is optional */ }
  }

  // --- "another file" after a failed check: back to the empty form, a new file makes a new order ---
  function offerAnotherFile() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-line pt-again';
    btn.textContent = 'Выбрать другой файл';
    btn.addEventListener('click', () => {
      clearStatus();
      clearFile();
      startedKey = null;
      setFormEnabled(true);
      setMessage('Выберите другой PDF — проверка начнётся сама.');
      zone.focus();
    });
    statusBox.append(btn);
  }

  // --- payment: the link is asked for only when the user clicks ---
  function showPayButton(orderToken) {
    statusBox.querySelectorAll('.pt-pay').forEach(el => el.remove());
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-pay pt-pay';
    btn.textContent = PRICE_TEXT;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      setLocked(true);
      setMessage('Открываем оплату…', 'ok');
      try {
        const data = await request('/api/orders/pay', {
          method: 'POST',
          headers: { Authorization: `Bearer ${orderToken}` }
        });
        const url = data.payment_url;
        if (typeof url !== 'string' || !isValidPaymentUrl(url, PAYMENT_ALLOWED_HOSTS)) {
          throw new Error('Ссылка на оплату недоступна. Напишите нам — разберёмся.');
        }
        storeToken(orderToken); // the return from the bank resumes the status from this
        window.location.assign(url);
      } catch (err) {
        let text = err.message || 'Не удалось открыть оплату. Попробуйте ещё раз.';
        if (err.errorCode === 'precheck_pending') {
          text = 'Файл ещё проверяется — подождите минуту и нажмите кнопку ещё раз.';
        } else if (err.errorCode === 'already_paid') {
          text = 'Заказ уже оплачен. Статус обновится сам.';
        }
        setMessage(text, 'bad');
        btn.disabled = false;
        setLocked(false);
      }
    });
    statusBox.append(btn);
  }

  // --- polling ---
  async function pollStatus(orderToken) {
    busy = true;
    let attempts = 0;
    try {
      while (true) {
        const data = await request('/api/status', { headers: { Authorization: `Bearer ${orderToken}` } });
        attempts += 1;
        if (data.precheck === 'failed') {
          setLadder(0);
          setMessage(data.precheck_message || 'Файл не подошёл. Выберите другой PDF.', 'bad');
          clearToken();
          offerAnotherFile();
          break;
        }
        if (data.stage === 'delivered') {
          setLadder(3);
          setMessage(data.message || 'Готовый Excel отправлен на почту.', 'ok');
          clearToken();
          break;
        }
        if (data.stage === 'failed') {
          // a refund lands here too: the message says the reason and "Деньги возвращены на карту"
          setMessage(data.message || 'Не удалось обработать файл.', 'bad');
          clearToken();
          break;
        }
        if (data.stage === 'queued' || data.stage === 'parsing') {
          setLadder(2);
          setMessage(data.message || 'Оплата получена, извлекаем таблицы. Excel придёт на почту — окно можно закрыть.', 'ok');
          if (attempts >= MAX_POLL_ATTEMPTS) break;
        } else if (data.precheck === 'ok') {
          setLadder(1);
          setMessage('Файл подошёл. Оплатите — и заказ сразу уйдёт в работу.', 'ok');
          showPayButton(orderToken);
          break;
        } else {
          setLadder(0);
          setMessage(data.precheck_message || 'Проверяем файл — обычно до минуты…', 'ok');
          if (attempts >= MAX_POLL_ATTEMPTS) {
            setMessage('Проверка затянулась. Откройте окно позже — статус заказа сохранится.', 'ok');
            break;
          }
        }
        await new Promise(resolve => setTimeout(resolve, POLL_MS));
      }
    } catch (err) {
      setMessage(err.message || 'Не удалось получить статус заказа.', 'bad');
    } finally {
      stopTicker();
      busy = false;
    }
  }

  // --- file selection ---
  function fileKey(file) {
    return file ? `${file.name}|${file.size}|${file.lastModified}` : null;
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} Б`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
    return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  }

  function clearFile() {
    try { fileInput.value = ''; fileInput.files = new DataTransfer().files; }
    catch (_) { fileInput.value = ''; }
    renderFile();
  }

  function renderFile() {
    const file = fileInput.files?.[0];
    fileName.textContent = file ? `${file.name} · ${formatBytes(file.size)}` : '';
    zone.classList.toggle('has-file', Boolean(file));
    removeBtn.hidden = !file || busy || startedKey !== null;
  }

  async function readMagic(file) {
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...bytes);
  }

  // --- the check starts by itself once the three conditions hold ---
  async function maybeStart() {
    if (busy) return;
    const file = fileInput.files?.[0];
    if (!file) {
      setMessage('Выберите PDF — проверка начнётся сама.');
      return;
    }
    if (startedKey === fileKey(file)) return; // this file already has an order
    if (!emailInput.value.trim() || !emailInput.validity.valid || !consentInput.checked) {
      setMessage('Укажите почту и отметьте согласие — проверка начнётся сама.');
      return;
    }
    busy = true;
    startedKey = fileKey(file);
    setFormEnabled(false);
    renderFile();
    clearStatus();
    try {
      if (fileInput.files.length !== 1) throw new Error('Нужен ровно один файл.');
      if (file.size > MAX_SIZE) throw new Error('Файл слишком большой. Нужен PDF до 25 листов.');
      if (await readMagic(file) !== '%PDF-') throw new Error('Это не PDF. Выберите файл PDF.');
      setMessage('Создаём заказ…', 'ok');
      const order = await request('/api/orders', {
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
        throw new Error('Не удалось создать заказ. Попробуйте ещё раз.');
      }
      storeToken(order.order_token);
      setMessage('Загружаем PDF…', 'ok');
      const fd = new FormData();
      fd.append('file', file, file.name);
      await request('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${order.upload_token}` },
        body: fd
      });
      setLadder(0);
      setMessage('Проверяем файл — обычно до минуты…', 'ok');
      busy = false;
      await pollStatus(order.order_token);
    } catch (err) {
      busy = false;
      startedKey = null;
      setFormEnabled(true);
      renderFile();
      const text = err.errorCode === 'invalid_product'
        ? 'Сервис пока доступен по приглашению.'
        : (err.message || 'Не удалось отправить файл.');
      setMessage(text, 'bad');
    }
  }

  fileInput.addEventListener('change', () => {
    if (startedKey !== null && !busy) {
      // a new file after a finished check is a new order
      clearStatus();
      startedKey = null;
    }
    renderFile();
    maybeStart();
  });
  emailInput.addEventListener('change', maybeStart);
  emailInput.addEventListener('input', () => { if (emailInput.validity.valid) maybeStart(); });
  consentInput.addEventListener('change', maybeStart);
  removeBtn.addEventListener('click', event => {
    event.preventDefault();
    clearFile();
    setMessage('Выберите PDF — проверка начнётся сама.');
  });
  ['dragenter', 'dragover'].forEach(type =>
    zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragover'); })
  );
  ['dragleave', 'dragend'].forEach(type =>
    zone.addEventListener(type, () => zone.classList.remove('dragover'))
  );
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('dragover');
    if (fileInput.disabled) return;
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

  // --- resume after the bank: the saved token brings the order back ---
  function resume() {
    if (busy) return false;
    let token = null;
    try { token = sessionStorage.getItem(STORE_KEY); } catch (_) { return false; }
    if (!token) return false;
    startedKey = 'resumed';
    setFormEnabled(false);
    setMessage('Восстанавливаем статус заказа…', 'ok');
    pollStatus(token);
    return true;
  }

  setMessage('Выберите PDF — проверка начнётся сама.');
  return { resume };
}
