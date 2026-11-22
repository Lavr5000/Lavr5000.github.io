// idk-order.js — order flow of «Комплект исполнительной документации» (product id-komplekt), page id-komplekt.html.
//
// Client flow (backend contract: SITE-MAP.md of the orders repo, section id-komplekt):
//   1. the user adds up to 20 files (xlsx xls pdf docx jpg png zip, 200 MB in total), enters an email, an optional
//      contact and accepts the consent idk-v1-2026-11; checks run in the browser first (Russian messages);
//   2. POST /api/orders {product, consent_version, email, contact?} -> order_token, upload_token (no payment yet);
//   3. POST /api/upload once per file (Bearer upload_token), POST /api/idk/submit (Bearer order_token);
//   4. GET /api/status polls the stage: queued (free analysis) -> awaiting_payment (composition + amount from the
//      server, pay button) -> idk_paid (building) -> delivered (link to the download page), or failed /
//      service_refunded. The page never computes a price: it shows only what the server returns.
// The order token is kept in localStorage so the status survives a closed tab or the bank round-trip.

import {
  API_ORIGIN,
  PAYMENT_ALLOWED_HOSTS,
  CONSENT_VERSION,
  PRODUCT,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  ALLOWED_EXTENSIONS,
  isValidPaymentUrl,
  isValidDownloadUrl
} from './idk.config.js?v=20261122-idk';
import { apiError, idemKeyFor, idemSettled } from './assets/order-api.js?v=20261122-idk';

const STORE_KEY = 'av-idk:order';
const KEEP_MS = 30 * 24 * 3600 * 1000;      // the files live 30 days; an older stored order is dropped
const FAST_POLL_MS = 5000;
const SLOW_POLL_MS = 15000;
const FAST_POLL_COUNT = 24;                  // 2 minutes at 5 s, then 15 s
const MAX_POLL_ATTEMPTS = 480;               // about 2 hours; past it a calm notice shows

const STEPS = ['Файлы загружены', 'Бесплатный разбор', 'Оплата', 'Сборка комплекта', 'Комплект готов'];
const BETA_NOTICE = 'Услуга в бета-тестировании. В ходе тестирования возможны ошибки. Оплата не возвращается, но услуга будет оказана до конца: при сбое к заказу подключится менеджер или система будет доработана и ваши файлы обработают повторно.';
const CREDIT_NOTICE = 'Оплата не нужна: за вами закреплён бесплатный заказ.';

const STAGE_STEP = { awaiting_upload: 0, queued: 1, awaiting_payment: 2, idk_paid: 3, delivered: 4 };
const TIER_TEXT = {
  ks2: 'Исходные документы: только КС-2 или смета',
  project: 'Исходные документы: КС-2 или смета и проектная (рабочая) документация',
  full: 'Исходные документы: полный набор — с приказами, паспортами и протоколами'
};
const EXT_LIST = 'xlsx, xls, pdf, docx, jpg, png и zip';
const OFFLINE_TEXT = 'Нет связи с сервером. Проверьте интернет и нажмите кнопку ещё раз — уже загруженные файлы повторно не отправятся.';

// ---------- pure helpers (exported for the checks) ----------
export function extensionOf(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

export function formatBytes(n) {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`;
}

export function formatRubles(value) {
  return `${String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
}

export function fileKey(file) {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

// Checks one batch of picked files against the files already in the list.
// Returns {accepted: File[], problems: string[]}; a rejected file never enters the list.
export function checkNewFiles(picked, existing, limits = {}) {
  const maxFiles = limits.maxFiles ?? MAX_FILES;
  const maxTotal = limits.maxTotalBytes ?? MAX_TOTAL_BYTES;
  const allowed = limits.allowed ?? ALLOWED_EXTENSIONS;
  const accepted = [];
  const problems = [];
  const seen = new Set(existing.map(fileKey));
  let count = existing.length;
  let total = existing.reduce((sum, f) => sum + f.size, 0);
  for (const file of picked) {
    if (seen.has(fileKey(file))) { problems.push(`Файл «${file.name}» уже добавлен.`); continue; }
    if (!allowed.includes(extensionOf(file.name))) {
      problems.push(`Файл «${file.name}» не подходит: допустимы ${EXT_LIST}.`);
      continue;
    }
    if (file.size === 0) { problems.push(`Файл «${file.name}» пустой.`); continue; }
    if (count + 1 > maxFiles) {
      problems.push(`Можно загрузить не больше ${maxFiles} файлов — «${file.name}» не добавлен.`);
      continue;
    }
    if (total + file.size > maxTotal) {
      problems.push(`Общий размер файлов — не больше ${Math.round(maxTotal / (1024 * 1024))} МБ: «${file.name}» не добавлен.`);
      continue;
    }
    seen.add(fileKey(file));
    accepted.push(file);
    count += 1;
    total += file.size;
  }
  return { accepted, problems };
}

const CONTACT_RE = /^[A-Za-zА-Яа-яЁё0-9 +\-()@._]{3,80}$/;
export function contactProblem(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  return CONTACT_RE.test(v) ? '' : 'В контакте допустимы буквы, цифры, пробел и знаки + - ( ) @ . _ (от 3 до 80 знаков).';
}

function readStored() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && saved.token && Date.now() - (saved.at || 0) < KEEP_MS) return saved;
  } catch (_) { /* storage is optional */ }
  return null;
}

function writeStored(value) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...value, at: Date.now() })); } catch (_) { /* optional */ }
}

function clearStored() {
  try { localStorage.removeItem(STORE_KEY); } catch (_) { /* optional */ }
}

export function hasStoredOrder() {
  return Boolean(readStored());
}

// ---------- the flow ----------
export function mountIdkOrder(root) {
  const $ = name => root.querySelector(`[data-idk="${name}"]`);
  const form = $('form');
  const fileInput = $('file');
  const zone = $('zone');
  const fileList = $('files');
  const fileSummary = $('files-summary');
  const emailInput = $('email');
  const contactInput = $('contact');
  const websiteInput = $('website');
  const consentInput = $('consent');
  const submitBtn = $('submit');
  const message = $('message');
  const statusBox = $('status');

  let files = [];            // File objects chosen by the user
  const done = new Set();    // fileKey of the files already stored by the server
  const failed = new Map();  // fileKey -> text of the last upload error
  let order = null;          // {order_id, order_number, order_token, upload_token} once created
  let busy = false;
  let pollGen = 0;           // bumped to cancel a running poll
  let shownSig = '';

  function setMessage(text, kind = '') {
    message.textContent = text;
    message.dataset.state = kind || 'idle';
  }

  function setBusy(on) {
    busy = on;
    submitBtn.disabled = on;
    emailInput.disabled = on || Boolean(order);
    contactInput.disabled = on || Boolean(order);
    consentInput.disabled = on || Boolean(order);
    fileInput.disabled = on;
    zone.classList.toggle('is-disabled', on);
    renderFiles();
  }

  // ---------- file list ----------
  function renderFiles() {
    fileList.textContent = '';
    files.forEach(file => {
      const key = fileKey(file);
      const li = document.createElement('li');
      li.className = 'idk-file';
      const name = document.createElement('span');
      name.className = 'idk-file-name';
      name.textContent = file.name;
      const size = document.createElement('span');
      size.className = 'idk-file-size';
      size.textContent = formatBytes(file.size);
      li.append(name, size);
      if (done.has(key)) {
        li.dataset.state = 'done';
        const mark = document.createElement('span');
        mark.className = 'idk-file-mark';
        mark.textContent = 'загружен';
        li.append(mark);
      } else {
        if (failed.has(key)) {
          li.dataset.state = 'bad';
          const bad = document.createElement('span');
          bad.className = 'idk-file-mark idk-file-mark--bad';
          bad.textContent = failed.get(key);
          li.append(bad);
        }
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'idk-file-remove';
        rm.textContent = 'Убрать';
        rm.setAttribute('aria-label', `Убрать файл ${file.name}`);
        rm.disabled = busy;
        rm.addEventListener('click', () => {
          files = files.filter(f => fileKey(f) !== key);
          failed.delete(key);
          renderFiles();
        });
        li.append(rm);
      }
      fileList.append(li);
    });
    const total = files.reduce((sum, f) => sum + f.size, 0);
    fileSummary.textContent = files.length
      ? `Файлов: ${files.length} из ${MAX_FILES} · ${formatBytes(total)} из ${Math.round(MAX_TOTAL_BYTES / (1024 * 1024))} МБ`
      : '';
    zone.classList.toggle('has-file', files.length > 0);
  }

  function addPicked(list) {
    const { accepted, problems } = checkNewFiles(Array.from(list), files);
    files = files.concat(accepted);
    renderFiles();
    if (problems.length) setMessage(problems.join(' '), 'bad');
    else setMessage(accepted.length ? `Добавлено файлов: ${accepted.length}.` : '', accepted.length ? 'ok' : '');
  }

  // ---------- API ----------
  async function request(path, options = {}) {
    let res;
    try {
      res = await fetch(`${API_ORIGIN}${path}`, options);
    } catch (_) {
      throw new Error(OFFLINE_TEXT);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw apiError(res, data, path);
    return data;
  }

  // ---------- status view ----------
  function ladder(active) {
    const list = document.createElement('ol');
    list.className = 'idk-ladder';
    STEPS.forEach((label, index) => {
      const li = document.createElement('li');
      if (index <= active) li.className = 'on';
      if (index === active) li.setAttribute('aria-current', 'step');
      li.textContent = label;
      list.append(li);
    });
    return list;
  }

  function note(text, cls = 'idk-note') {
    const p = document.createElement('p');
    p.className = cls;
    p.textContent = text;
    return p;
  }

  function again() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-line idk-again';
    btn.textContent = 'Начать новый заказ';
    btn.addEventListener('click', reset);
    return btn;
  }

  function reset() {
    pollGen += 1;
    clearStored();
    order = null;
    files = [];
    done.clear();
    failed.clear();
    statusBox.textContent = '';
    shownSig = '';
    statusBox.hidden = true;
    form.hidden = false;
    form.reset();
    setBusy(false);
    renderFiles();
    setMessage('');
  }

  function contactLinks() {
    const p = document.createElement('p');
    p.className = 'idk-note';
    p.append('Напишите нам: ');
    const tg = document.createElement('a');
    tg.href = 'https://t.me/lavr5000';
    tg.target = '_blank';
    tg.rel = 'noopener';
    tg.textContent = 'Telegram';
    const mail = document.createElement('a');
    mail.href = 'mailto:lavr5000xxx@gmail.com';
    mail.textContent = 'lavr5000xxx@gmail.com';
    p.append(tg, ' или ', mail, '.');
    return p;
  }

  function quoteBlock(quote) {
    const box = document.createElement('div');
    box.className = 'idk-quote';
    const title = document.createElement('h3');
    title.textContent = 'Состав комплекта';
    box.append(title);
    if (quote.tier && TIER_TEXT[quote.tier]) box.append(note(TIER_TEXT[quote.tier]));
    if (Number.isFinite(Number(quote.acts_count))) {
      box.append(note(`Актов в комплекте: ${Number(quote.acts_count)}`, 'idk-note idk-note--strong'));
    }
    const comp = Array.isArray(quote.composition) ? quote.composition : [];
    if (comp.length) {
      const list = document.createElement('ul');
      list.className = 'idk-comp';
      comp.forEach(item => {
        const li = document.createElement('li');
        const t = document.createElement('span');
        t.textContent = String((item && item.title) || '');
        const c = document.createElement('span');
        c.className = 'idk-comp-count';
        c.textContent = item && item.count != null ? `× ${item.count}` : '';
        li.append(t, c);
        list.append(li);
      });
      box.append(list);
    }
    const missing = Array.isArray(quote.missing) ? quote.missing : [];
    if (missing.length) {
      const h = document.createElement('h3');
      h.textContent = 'Чего не хватает для полного комплекта';
      const list = document.createElement('ul');
      list.className = 'idk-missing';
      missing.forEach(m => {
        const li = document.createElement('li');
        li.textContent = String(m);
        list.append(li);
      });
      box.append(h, list);
    }
    return box;
  }

  function render(data) {
    const sig = JSON.stringify([data.stage, data.message, data.payment_url, data.download_url, data.quote]);
    if (sig === shownSig) return;
    shownSig = sig;
    statusBox.hidden = false;
    statusBox.textContent = '';
    const stage = data.stage;
    const saved = readStored();
    const num = (order && order.order_number) || (saved && saved.number) || '';
    if (num) statusBox.append(note(`Заказ ${num}`, 'idk-order-no'));

    if (stage in STAGE_STEP) statusBox.append(ladder(STAGE_STEP[stage]));

    if (stage === 'awaiting_upload' && order && !order.upload_token) {
      // a restored order that never reached «submit»: the chosen files are gone with the closed tab
      setMessage('Этот заказ не был отправлен на разбор: файлы нужно выбрать заново.', 'bad');
      statusBox.append(again());
    } else if (stage === 'queued' || stage === 'awaiting_upload') {
      setMessage(data.message || 'Файлы получены. Идёт бесплатный разбор: смотрим, какой комплект можно собрать. Оплата — только после того, как вы увидите состав комплекта.', 'ok');
    } else if (stage === 'awaiting_payment') {
      if (data.quote) statusBox.append(quoteBlock(data.quote));
      const amount = data.quote && data.quote.amount;
      const url = data.payment_url;
      const isCredit = Boolean(data.credit || (data.quote && data.quote.credit));
      if (isCredit && !(Number(amount) > 0) && !url) {
        // a free order by credit: nothing to pay, no bank; the button only refreshes the status
        const free = document.createElement('p');
        free.className = 'idk-amount idk-amount--free';
        free.textContent = CREDIT_NOTICE;
        const go = document.createElement('button');
        go.type = 'button';
        go.className = 'btn-pay idk-continue';
        go.textContent = 'Продолжить';
        go.addEventListener('click', () => {
          go.disabled = true;
          setMessage('Запускаем сборку комплекта…', 'ok');
          shownSig = '';
          poll();
        });
        statusBox.append(free, go);
        setMessage(data.message || 'Разбор готов. Проверьте состав комплекта и нажмите «Продолжить» — комплект уйдёт в сборку.', 'ok');
      } else if (typeof url === 'string' && isValidPaymentUrl(url, PAYMENT_ALLOWED_HOSTS) && Number.isFinite(Number(amount))) {
        const price = document.createElement('p');
        price.className = 'idk-amount';
        price.textContent = formatRubles(amount);
        const pay = document.createElement('button');
        pay.type = 'button';
        pay.className = 'btn-pay idk-pay';
        pay.textContent = `Оплатить ${formatRubles(amount)}`;
        pay.addEventListener('click', () => {
          pay.disabled = true;
          setMessage('Открываем оплату…', 'ok');
          window.location.assign(url);
        });
        statusBox.append(price, note(BETA_NOTICE, 'idk-beta'), pay);
        setMessage(data.message || 'Разбор готов. Проверьте состав комплекта и оплатите — после оплаты комплект сразу уйдёт в сборку.', 'ok');
      } else {
        setMessage('Разбор готов, ссылка на оплату готовится. Статус обновится сам.', 'ok');
      }
    } else if (stage === 'idk_paid') {
      if (data.quote) statusBox.append(quoteBlock(data.quote));
      setMessage(data.message || 'Оплата получена, собираем комплект. Статус обновится сам.', 'ok');
    } else if (stage === 'delivered') {
      const url = data.download_url;
      if (typeof url === 'string' && isValidDownloadUrl(url)) {
        const link = document.createElement('a');
        link.className = 'btn-pay idk-download';
        link.href = url;
        link.rel = 'noopener';
        link.textContent = 'Открыть страницу загрузки';
        statusBox.append(link);
        statusBox.append(note('Ссылка действует 72 часа, архив выдаётся после подтверждения на странице. Не передавайте ссылку третьим лицам.'));
        setMessage(data.message || 'Комплект готов.', 'ok');
      } else {
        setMessage('Комплект готов, но срок ссылки на архив истёк. Новая ссылка выдаётся по запросу в пределах срока хранения.', 'ok');
        statusBox.append(contactLinks());
      }
      statusBox.append(note('Документы и комплект хранятся 30 дней, затем удаляются автоматически.'));
      statusBox.append(again());
    } else if (stage === 'failed') {
      setMessage(data.message || 'Не удалось собрать комплект по этим файлам.', 'bad');
      statusBox.append(again());
    } else if (stage === 'service_refunded') {
      setMessage(data.message || 'Оплата возвращена.', 'ok');
      statusBox.append(again());
    } else {
      setMessage(data.message || 'Статус заказа обновляется…', 'ok');
    }
  }

  const TERMINAL = new Set(['delivered', 'failed', 'service_refunded']);

  async function poll() {
    if (!order) return;
    const gen = ++pollGen;
    const token = order.order_token;
    let attempts = 0;
    let errors = 0;
    while (gen === pollGen) {
      try {
        const data = await request('/api/status', { headers: { Authorization: `Bearer ${token}` } });
        if (gen !== pollGen) return;
        errors = 0;
        attempts += 1;
        render(data);
        if (data.stage === 'failed' || data.stage === 'service_refunded') clearStored();
        if (TERMINAL.has(data.stage)) return;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          setMessage('Разбор занимает дольше обычного. Откройте эту страницу позже в этом же браузере — статус заказа сохранится.', 'ok');
          return;
        }
      } catch (err) {
        if (gen !== pollGen) return;
        if (err.errorCode === 'invalid_token' || err.status === 403) {
          clearStored();
          setMessage('Заказ не найден или срок доступа к нему истёк.', 'bad');
          statusBox.hidden = false;
          statusBox.textContent = '';
          statusBox.append(again());
          return;
        }
        errors += 1;
        setMessage(err.message || 'Не удалось получить статус заказа. Пробуем ещё раз…', 'bad');
        if (errors >= 8) return;
      }
      await new Promise(resolve => setTimeout(resolve, attempts < FAST_POLL_COUNT ? FAST_POLL_MS : SLOW_POLL_MS));
    }
  }

  // ---------- submit ----------
  function formProblem() {
    if (!files.length) return 'Добавьте хотя бы один файл: КС-2 или смету.';
    const email = emailInput.value.trim();
    if (!email || !emailInput.validity.valid) return 'Укажите почту — на неё придут чек и ссылка на архив.';
    const bad = contactProblem(contactInput.value);
    if (bad) return bad;
    if (!consentInput.checked) return 'Нужно принять оферту и дать согласие на обработку данных.';
    return '';
  }

  async function submit() {
    if (busy) return;
    const problem = formProblem();
    if (problem) { setMessage(problem, 'bad'); return; }
    setBusy(true);
    try {
      if (!order) {
        setMessage('Создаём заказ…', 'ok');
        const email = emailInput.value.trim();
        const contact = contactInput.value.trim();
        const idemKey = idemKeyFor(JSON.stringify([PRODUCT, email, contact, files.map(fileKey)]));
        let created;
        try {
          created = await request('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
            body: JSON.stringify({
              product: PRODUCT,
              consent_version: CONSENT_VERSION,
              email,
              ...(contact ? { contact } : {}),
              website: websiteInput ? websiteInput.value || '' : ''
            })
          });
          idemSettled();
        } catch (err) {
          idemSettled(err);
          throw err;
        }
        if (!created.order_id || !created.order_token || !created.upload_token) {
          throw new Error('Не удалось создать заказ. Попробуйте ещё раз.');
        }
        order = {
          order_id: created.order_id,
          order_number: created.order_number || '',
          order_token: created.order_token,
          upload_token: created.upload_token
        };
        writeStored({ token: order.order_token, number: order.order_number });
      }
      const todo = files.filter(f => !done.has(fileKey(f)));
      for (const file of todo) {
        const key = fileKey(file);
        setMessage(`Загружаем файл ${done.size + 1} из ${files.length}: ${file.name}`, 'ok');
        const fd = new FormData();
        fd.append('file', file, file.name);
        try {
          await request('/api/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${order.upload_token}` },
            body: fd
          });
        } catch (err) {
          if (err.status && err.status < 500 && err.errorCode !== 'rate_limited') {
            // the server refused this very file: mark it so the user can remove it and press the button again
            failed.set(key, err.message);
            renderFiles();
          }
          throw err;
        }
        failed.delete(key);
        done.add(key);
        renderFiles();
      }
      setMessage('Отправляем файлы на разбор…', 'ok');
      await request('/api/idk/submit', { method: 'POST', headers: { Authorization: `Bearer ${order.order_token}` } });
      form.hidden = true;
      busy = false;
      await poll();
    } catch (err) {
      busy = false;
      setBusy(false);
      const text = err.errorCode === 'invalid_product' || err.errorCode === 'service_payments_disabled'
        ? 'Сервис пока доступен по приглашению.'
        : (err.message || 'Не удалось отправить файлы.');
      setMessage(text, 'bad');
    }
  }

  // ---------- events ----------
  form.addEventListener('submit', event => { event.preventDefault(); submit(); });
  fileInput.addEventListener('change', () => {
    addPicked(fileInput.files || []);
    try { fileInput.value = ''; } catch (_) { /* some browsers refuse; the list is the source of truth */ }
  });
  ['dragenter', 'dragover'].forEach(type =>
    zone.addEventListener(type, event => { event.preventDefault(); if (!fileInput.disabled) zone.classList.add('dragover'); })
  );
  ['dragleave', 'dragend'].forEach(type =>
    zone.addEventListener(type, () => zone.classList.remove('dragover'))
  );
  zone.addEventListener('drop', event => {
    event.preventDefault();
    zone.classList.remove('dragover');
    if (fileInput.disabled) return;
    const dropped = event.dataTransfer && event.dataTransfer.files;
    if (dropped && dropped.length) addPicked(dropped);
  });

  // ---------- resume: the stored token brings the order back (closed tab, return from the bank) ----------
  function resume() {
    if (busy || order) return false;
    const saved = readStored();
    if (!saved) return false;
    order = { order_id: '', order_number: saved.number || '', order_token: saved.token, upload_token: '' };
    form.hidden = true;
    statusBox.hidden = false;
    setMessage('Восстанавливаем статус заказа…', 'ok');
    poll();
    return true;
  }

  renderFiles();
  return { resume };
}
