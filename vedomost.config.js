export const API_ORIGIN = 'https://api.ai-vibes.ru';
export const PAYMENT_ENABLED = true;
export const PAYMENT_ALLOWED_HOSTS = ['pay.tbank.ru', 'securepay.tinkoff.ru'];
export const CONSENT_VERSION = 'vedomost-v2-2026-06';

export function isValidPaymentUrl(url, allowedHosts = PAYMENT_ALLOWED_HOSTS) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}
