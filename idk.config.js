// idk.config.js — settings of the «Комплект исполнительной документации» (id-komplekt) order page.
// The API origin and the bank host list come from the single shared config; only the product values live here.
import { API_ORIGIN, PAYMENT_ALLOWED_HOSTS, isValidPaymentUrl } from './vedomost.config.js?v=vedomost-v3-2026-10';

export { API_ORIGIN, PAYMENT_ALLOWED_HOSTS, isValidPaymentUrl };

export const PRODUCT = 'id-komplekt';
// must equal the version registered by the backend (webintake/consent_registry.py IDK_V1); the text of the
// checkbox is compared with the registry by tests/idk_page_check.py
export const CONSENT_VERSION = 'idk-v1-2026-11';

// the limits the backend announces in the answer of POST /api/orders; used before the order exists
export const MAX_FILES = 20;
export const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
// extension allow-list of POST /api/upload (the server also checks the magic bytes)
export const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'pdf', 'docx', 'jpg', 'jpeg', 'png', 'zip'];

// the download page of the delivered kit lives on the API host: /k/<32 chars>
export const DOWNLOAD_PATH_RE = /^\/k\/[A-Za-z0-9_-]{32}$/;

export function isValidDownloadUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === API_ORIGIN && DOWNLOAD_PATH_RE.test(parsed.pathname);
  } catch {
    return false;
  }
}
