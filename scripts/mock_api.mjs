import http from 'node:http';
import crypto from 'node:crypto';

const PORT = 8787;
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

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOW.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
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
  return (origin && ALLOW.has(origin)) || (referer && ALLOW.has(referer));
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

async function createOrder(req, res) {
  const ip = clientIp(req);
  const count = ipOrders.get(ip) || 0;
  if (count > 30) return err(req, res, 429, 'rate_limited', 'Слишком много заказов.', 60);
  let data;
  try { data = JSON.parse((await body(req)).toString('utf8') || '{}'); }
  catch { return err(req, res, 400, 'bad_json', 'Некорректный JSON.', null); }
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
    err(req, res, 404, 'not_found', 'Endpoint not found.', null);
  } catch {
    err(req, res, 500, 'server_error', 'Mock API error.', null);
  }
});

runPaymentValidatorSelfCheck();
server.listen(PORT, () => console.log(`mock_api listening on http://localhost:${PORT}`));
