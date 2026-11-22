import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 8787);
const MAX_SIZE = 25 * 1024 * 1024;
const ACCEPTED = new Set(['dev-0']);
const ALLOW = new Set([
  'http://localhost:8787', 'http://127.0.0.1:8787',
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:8080', 'http://127.0.0.1:8080',
  'https://lavr5000.github.io'
]);
const orders = new Map();
const uploads = new Map();
const ipOrders = new Map();
const ipTokenHits = new Map();

function isValidPaymentUrl(url, allowedHosts) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

function runPaymentValidatorSelfCheck() {
  const allowed = ['securepay.tinkoff.ru'];
  const valid = isValidPaymentUrl('https://securepay.tinkoff.ru/new/abc', allowed);
  const invalid = isValidPaymentUrl('http://securepay.tinkoff.ru/new/abc', allowed);
  const wrongHost = isValidPaymentUrl('https://example.test/pay', allowed);
  if (!valid || invalid || wrongHost) throw new Error('payment_url validator self-check failed');
  console.log('payment validator self-check ok: valid renders button; http/wrong-host render no button');
}

const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function originAllowed(origin) {
  return Boolean(origin) && (ALLOW.has(origin) || LOOPBACK.test(origin));
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (originAllowed(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(req, res, code, data) {
  cors(req, res);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function text(req, res, code, value) {
  cors(req, res);
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(value);
}

function err(req, res, code, error_code, message, retry_after = null) {
  send(req, res, code, { error_code, message, retry_after });
}

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_SIZE + 4096) req.destroy();
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function token(prefix) {
  return `${prefix}_${crypto.randomBytes(24).toString('base64url')}`;
}

function bearer(req) {
  const value = req.headers.authorization || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function clientIp(req) {
  return req.socket.remoteAddress || 'local';
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  const referer = req.headers.referer ? new URL(req.headers.referer).origin : '';
  return originAllowed(origin) || originAllowed(referer);
}

function parseMultipart(buf, type) {
  const boundary = /boundary=([^;]+)/i.exec(type || '')?.[1];
  if (!boundary) return [];
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let pos = buf.indexOf(marker);
  while (pos !== -1) {
    const next = buf.indexOf(marker, pos + marker.length);
    if (next === -1) break;
    const part = buf.subarray(pos + marker.length + 2, next - 2);
    const split = part.indexOf(Buffer.from('\r\n\r\n'));
    if (split > -1) {
      const head = part.subarray(0, split).toString('utf8');
      const data = part.subarray(split + 4);
      if (/filename="/i.test(head)) parts.push({ head, data });
    }
    pos = next;
  }
  return parts;
}

// ---- id-komplekt (Комплект исполнительной документации) -------------------------------------------------
// Offline preview of the client flow: queued -> awaiting_payment (quote + pay URL) -> idk_paid -> delivered.
// Stages are time-driven after /api/idk/submit and can be forced: POST /__mock/idk/advance {order_token, stage};
// POST /__mock/idk/pay {order_token} simulates the return from the bank (awaiting_payment -> idk_paid).
const IDK_CONSENT = 'idk-v1-2026-11';
const IDK_EXT = new Set(['xlsx', 'xls', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'zip']);
const IDK_MAX_FILES = 20;
const IDK_MAX_TOTAL = 200 * 1024 * 1024;
const IDK_CONTACT = /^[A-Za-zА-Яа-яЁё0-9 +\-()@._]{3,80}$/;
const idkOrders = new Map();
const idemKeys = new Map();

function idkCreate(req, res, data, idemKey) {
  if (data.website) return send(req, res, 202, { order_id: 'accepted' });
  if (data.consent_version !== IDK_CONSENT) return err(req, res, 403, 'bad_consent_version', 'Версия согласия не принята.', null);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email || ''))) return err(req, res, 422, 'bad_email', 'Укажите корректный адрес почты.', null);
  if (data.contact && !IDK_CONTACT.test(String(data.contact))) return err(req, res, 422, 'bad_contact', 'Контакт содержит недопустимые знаки.', null);
  if (idemKey && idemKeys.has(idemKey)) return send(req, res, 200, idemKeys.get(idemKey));
  const order_id = token('ord');
  const order = {
    order_id, order_number: `IDK-${String(idkOrders.size + 1).padStart(4, '0')}`,
    order_token: token('order'), upload_token: token('upload'),
    email: String(data.email || ''), files: [], total: 0, submitted_at: 0, forced: null, paid_at: 0, idk: true
  };
  idkOrders.set(order.order_token, order);
  uploads.set(order.upload_token, order);
  const reply = {
    order_id, order_number: order.order_number, order_token: order.order_token, upload_token: order.upload_token,
    max_files: IDK_MAX_FILES, max_total_bytes: IDK_MAX_TOTAL
  };
  if (idemKey) idemKeys.set(idemKey, reply);
  send(req, res, 200, reply);
}

async function idkUpload(req, res, order) {
  if (order.submitted_at) return err(req, res, 409, 'order_submitted', 'Заказ уже отправлен на разбор.', null);
  const buf = await body(req);
  const files = parseMultipart(buf, req.headers['content-type']);
  if (files.length !== 1) return err(req, res, 400, 'one_file_required', 'Нужен ровно один файл.', null);
  const name = /filename="([^"]*)"/i.exec(files[0].head)?.[1] || '';
  const ext = name.split('.').pop().toLowerCase();
  if (!IDK_EXT.has(ext)) return err(req, res, 415, 'bad_file_type', 'Этот тип файла не принимается.', null);
  if (order.files.length + 1 > IDK_MAX_FILES) return err(req, res, 409, 'too_many_files', 'Слишком много файлов.', null);
  if (order.total + files[0].data.length > IDK_MAX_TOTAL) return err(req, res, 413, 'total_too_large', 'Общий размер файлов слишком велик.', null);
  order.files.push(name);
  order.total += files[0].data.length;
  send(req, res, 200, { ok: true, size: files[0].data.length, files_count: order.files.length });
}

function idkStage(order) {
  if (order.forced) return order.forced;
  if (!order.submitted_at) return 'awaiting_upload';
  if (order.paid_at) return Date.now() - order.paid_at < 3000 ? 'idk_paid' : 'delivered';
  return Date.now() - order.submitted_at < 4000 ? 'queued' : 'awaiting_payment';
}

function idkStatus(req, res, order) {
  const stage = idkStage(order);
  const out = { stage, idk: true, submitted: Boolean(order.submitted_at), files_count: order.files.length, message: null, payment_url: null };
  const messages = {
    queued: 'Файлы получены, идёт бесплатный разбор.',
    awaiting_payment: 'Разбор готов: проверьте состав комплекта и оплатите.',
    idk_paid: 'Оплата получена, собираем комплект.',
    delivered: 'Комплект готов.',
    failed: 'По этим файлам комплект собрать не удалось: не найден акт КС-2 или смета.',
    service_refunded: 'Оплата возвращена.'
  };
  out.message = messages[stage] || null;
  if (['awaiting_payment', 'idk_paid', 'delivered'].includes(stage)) {
    out.quote = {
      tier: 'project', acts_count: 34, amount: order.credit ? 0 : 1000, ...(order.credit ? { credit: true } : {}),
      composition: [
        { title: 'Акты освидетельствования скрытых работ (АОСР)', count: 34 },
        { title: 'Реестр исполнительной документации', count: 1 },
        { title: 'Общий журнал работ', count: 1 },
        { title: 'Журнал входного контроля', count: 1 },
        { title: 'Ведомость допусков', count: 1 }
      ],
      missing: ['Паспорта и сертификаты на трубы ПНД', 'Протокол испытания бетона (класс B25)', 'Исполнительная схема на участок 3']
    };
  }
  if (order.credit) out.credit = true;
  if (stage === 'awaiting_payment' && !order.credit) out.payment_url = 'https://securepay.tinkoff.ru/new/mock-idk';
  if (stage === 'delivered') {
    out.download_url = 'https://api.ai-vibes.ru/k/' + crypto.createHash('sha256').update(order.order_token).digest('base64url').slice(0, 32);
    out.download_expires_at = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  }
  send(req, res, 200, out);
}

async function idkRoute(req, res) {
  if (req.url === '/api/idk/submit' && req.method === 'POST') {
    const order = idkOrders.get(bearer(req) || '');
    if (!order) { err(req, res, 403, 'bad_order_token', 'Недействительный order token.', null); return true; }
    if (!order.files.length) { err(req, res, 409, 'no_files', 'Нет загруженных файлов.', null); return true; }
    if (!order.submitted_at) order.submitted_at = Date.now();
    if (/credit/i.test(String(order.email || ''))) order.credit = true;   // the backend gives a free order to a client with a credit
    send(req, res, 200, { ok: true, stage: 'queued' });
    return true;
  }
  if ((req.url === '/__mock/idk/advance' || req.url === '/__mock/idk/pay') && req.method === 'POST') {
    let data = {};
    try { data = JSON.parse((await body(req)).toString('utf8') || '{}'); } catch { /* keep empty */ }
    const order = idkOrders.get(data.order_token || '');
    if (!order) { err(req, res, 404, 'not_found', 'Unknown order.', null); return true; }
    if (req.url.endsWith('/pay')) { order.forced = null; order.paid_at = Date.now(); }
    else order.forced = data.stage || null;
    send(req, res, 200, { ok: true });
    return true;
  }
  return false;
}

async function createOrder(req, res) {
  const ip = clientIp(req);
  const count = ipOrders.get(ip) || 0;
  if (count > 30) return err(req, res, 429, 'rate_limited', 'Слишком много заказов.', 60);
  let data;
  try { data = JSON.parse((await body(req)).toString('utf8') || '{}'); }
  catch { return err(req, res, 400, 'bad_json', 'Некорректный JSON.', null); }
  if (data.product === 'id-komplekt') return idkCreate(req, res, data, req.headers['idempotency-key'] || '');
  if (data.website) return send(req, res, 202, { order_id: 'accepted' });
  if (!ACCEPTED.has(data.consent_version)) return err(req, res, 403, 'bad_consent_version', 'Версия согласия не принята.', null);
  const order_id = token('ord');
  const order_token = token('order');
  const upload_token = token('upload');
  const order = { order_id, order_token, upload_token, created: Date.now(), uploaded: false, used: false };
  orders.set(order_token, order);
  uploads.set(upload_token, order);
  ipOrders.set(ip, count + 1);
  send(req, res, 200, { order_id, order_token, upload_token });
}

async function upload(req, res) {
  const rawToken = bearer(req);
  if (!rawToken) return err(req, res, 401, 'missing_bearer', 'Нужен Authorization: Bearer.', null);
  const order = uploads.get(rawToken);
  if (!order) return err(req, res, 403, 'bad_upload_token', 'Недействительный upload token.', null);
  if (!checkOrigin(req)) return err(req, res, 403, 'bad_origin', 'Origin или Referer не разрешён.', null);
  if (order.idk) return idkUpload(req, res, order);
  const key = `${clientIp(req)}:${rawToken}`;
  const hits = ipTokenHits.get(key) || 0;
  if (hits > 20) return err(req, res, 429, 'rate_limited', 'Слишком много попыток загрузки.', 30);
  ipTokenHits.set(key, hits + 1);
  if (order.used || Date.now() - order.created > 15 * 60 * 1000) return err(req, res, 403, 'upload_token_expired', 'Upload token истёк или уже использован.', null);
  const len = Number(req.headers['content-length'] || 0);
  if (len > MAX_SIZE + 4096) return err(req, res, 413, 'file_too_large', 'Файл больше 25 МБ.', null);
  const buf = await body(req);
  const files = parseMultipart(buf, req.headers['content-type']);
  if (files.length !== 1) return err(req, res, 400, 'one_file_required', 'Нужен ровно один файл.', null);
  const file = files[0].data;
  if (file.length > MAX_SIZE) return err(req, res, 413, 'file_too_large', 'Файл больше 25 МБ.', null);
  if (file.subarray(0, 5).toString() !== '%PDF-') return err(req, res, 415, 'not_pdf', 'Файл не похож на PDF.', null);
  if (order.uploaded) return err(req, res, 409, 'file_quota_exceeded', 'Для заказа уже загружен файл.', null);
  order.used = true;
  order.uploaded = true;
  order.sha256 = crypto.createHash('sha256').update(file).digest('hex');
  send(req, res, 200, { ok: true, size: file.length, sha256: order.sha256 });
}

function status(req, res) {
  const rawToken = bearer(req);
  if (!rawToken) return err(req, res, 401, 'missing_bearer', 'Нужен Authorization: Bearer.', null);
  const idkOrder = idkOrders.get(rawToken);
  if (idkOrder) return idkStatus(req, res, idkOrder);
  const order = orders.get(rawToken);
  if (!order) return err(req, res, 403, 'bad_order_token', 'Недействительный order token.', null);
  const age = Date.now() - order.created;
  const stage = age < 9000 ? 'queued' : age < 19000 ? 'parsing' : age < 29000 ? 'awaiting_payment' : 'delivered';
  const message = stage === 'delivered'
    ? 'Результат отправлен на email'
    : stage === 'awaiting_payment'
      ? 'Результат готов: перейдите к оплате'
      : stage === 'parsing'
        ? 'Файл разбирается'
        : 'Файл принят, заказ в очереди';
  const payment_url = stage === 'awaiting_payment' ? 'https://example.test/pay' : null;
  send(req, res, 200, { stage, message, payment_url });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { cors(req, res); res.writeHead(204); return res.end(); }
    if (req.url === '/healthz' && req.method === 'GET') return text(req, res, 200, 'ok');
    if (req.url === '/api/orders' && req.method === 'POST') return createOrder(req, res);
    if (req.url === '/api/upload' && req.method === 'POST') return upload(req, res);
    if (req.url === '/api/status' && req.method === 'GET') return status(req, res);
    if (await idkRoute(req, res)) return;
    err(req, res, 404, 'not_found', 'Endpoint not found.', null);
  } catch {
    err(req, res, 500, 'server_error', 'Mock API error.', null);
  }
});

runPaymentValidatorSelfCheck();
server.listen(PORT, () => console.log(`mock_api listening on http://localhost:${PORT}`));
