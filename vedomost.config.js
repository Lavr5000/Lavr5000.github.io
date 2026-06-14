export const API_ORIGIN = 'https://__PROD_API_DOMAIN__';
export const PAYMENT_ENABLED = false;
export const PAYMENT_ALLOWED_HOSTS = ['securepay.tinkoff.ru'];
export const CONSENT_VERSION = 'v1';

export function isValidPaymentUrl(url, allowedHosts = PAYMENT_ALLOWED_HOSTS) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}
