// order-api.js — client helpers shared by the module order flows (pdf-tables-order.js, idk-order.js).
// 1) One Idempotency-Key per form content until a final answer: a network error / 5xx / timeout keeps the key,
//    so the user's retry recovers the SAME order; 2xx or a 4xx (except idempotency_in_progress) ends it;
//    another form content gets a new key.
// 2) apiError(): app errors are {error_code, message, retry_after}; nginx ones are {error: {code, message}}
//    + Retry-After. The result is an Error with a Russian text, .status, .errorCode and .data.

const IDEM_STORE = 'aiv-order-idem';

export function newIdemKey() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function idemKeyFor(fingerprint) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(IDEM_STORE) || 'null');
    if (saved && saved.fp === fingerprint && saved.key) return saved.key;
  } catch (_) { /* storage is optional */ }
  const key = newIdemKey();
  try { sessionStorage.setItem(IDEM_STORE, JSON.stringify({ fp: fingerprint, key })); } catch (_) { /* optional */ }
  return key;
}

export function idemSettled(err) {
  // err undefined = success; err.status undefined = network/timeout -> keep the key for the retry
  if (err && (!err.status || err.status >= 500 || err.errorCode === 'idempotency_in_progress')) return;
  try { sessionStorage.removeItem(IDEM_STORE); } catch (_) { /* storage is optional */ }
}

export function apiError(res, data, path = '') {
  const code = data.error_code || (data.error && data.error.code) || '';
  const wait = Number(data.retry_after || res.headers.get('Retry-After')) || 0;
  const message = data.message || (data.error && data.error.message) || '';
  let text = message || 'Ошибка запроса.';
  if (res.status === 409 && code === 'order_duplicate') {
    text = `Заявка уже отправлена. Подождите ${wait || 10} сек. и обновите страницу.`;
  } else if (res.status === 429 && (code === 'rate_limited' || !message)) {
    text = `Слишком много запросов. Повторите через ${wait || 30} сек.`;
  } else if (res.status === 413 && !path.startsWith('/api/upload')) {
    text = 'Слишком большой запрос. Сократите текст в полях формы.';
  } else if (wait) {
    text += ` Повторите через ${wait} сек.`;
  }
  return Object.assign(new Error(text), { status: res.status, errorCode: code, data });
}
