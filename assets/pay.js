/* AI Vibes — кнопки тарифов: окно оплаты (AI_PAY.enabled) или окно заявки сообщением.
 * Без скриптов кнопка остаётся ссылкой на блок контактов. */
(function () {
  'use strict';
  var cfg = window.AI_PAY || { enabled: false };
  var $ = function (id) { return document.getElementById(id); };
  var MAIL = 'lavr5000xxx@gmail.com';
  var FAIL_TEXT = 'Не получилось создать оплату. Напишите нам в MAX, Telegram или на почту — оформим заказ вручную.';
  var buttons = Array.prototype.slice.call(document.querySelectorAll('a[data-pay]'));
  var requests = Array.prototype.slice.call(document.querySelectorAll('a[data-request]'));
  if (!buttons.length && !requests.length) return;

  var storeKey = function (id) { return 'av-pay:' + id; };
  var load = function (id) {
    try { return JSON.parse(sessionStorage.getItem(storeKey(id)) || 'null'); } catch (e) { return null; }
  };
  var save = function (id, v) {
    try { sessionStorage.setItem(storeKey(id), JSON.stringify(v)); } catch (e) { /* storage is optional */ }
  };
  var uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };

  buttons.forEach(function (b) {
    if (!cfg.enabled) b.textContent = 'Заказать за ' + b.dataset.priceLabel;
  });

  /* ---------- окно заявки сообщением ---------- */
  var orderDlg = $('order-dialog');
  var openOrder = function (b) {
    if (!orderDlg || !orderDlg.showModal) return false;
    $('order-service').textContent = b.dataset.order;
    $('order-price').textContent = b.dataset.priceLabel;
    $('order-mail').href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Заявка: ' + b.dataset.order) +
      '&body=' + encodeURIComponent('Здравствуйте! Хочу заказать: ' + b.dataset.order + ' (' + b.dataset.priceLabel + ').');
    orderDlg.showModal();
    return true;
  };

  /* ---------- окно оплаты ---------- */
  var payDlg = $('pay-dialog'), form = $('pay-form'), status = $('pay-status'), submit = $('pay-submit');
  var current = null, openedAt = 0, busy = false;
  var setStatus = function (state, text) { status.dataset.state = state; status.textContent = text || ''; };
  var setBusy = function (on) { busy = on; submit.disabled = on; };

  var openPay = function (b, fresh) {
    if (!payDlg || !payDlg.showModal || !form) return false;
    current = b;
    $('pay-service').textContent = b.dataset.order;
    $('pay-price').textContent = b.dataset.priceLabel;
    submit.textContent = 'Перейти к оплате ' + b.dataset.priceLabel;
    var saved = load(b.dataset.serviceId);
    if (saved) {
      if (saved.email && !$('pay-email').value) $('pay-email').value = saved.email;
      if (saved.contact && !$('pay-contact').value) $('pay-contact').value = saved.contact;
      if (fresh) { saved.key = ''; save(b.dataset.serviceId, saved); }
    }
    setStatus('idle', ''); setBusy(false);
    openedAt = Date.now();
    payDlg.showModal();
    return true;
  };

  var hostAllowed = function (url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' && (cfg.allowedPayHosts || []).indexOf(u.hostname) !== -1;
    } catch (e) { return false; }
  };

  var request = function (payload, key) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, cfg.timeoutMs || 15000);
    return fetch(cfg.api + '/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify(payload),
      signal: ctl.signal
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
    }, function (e) { clearTimeout(timer); throw e; });
  };

  var send = function (retried) {
    var id = current.dataset.serviceId;
    var email = $('pay-email').value.trim(), contact = $('pay-contact').value.trim();
    var saved = load(id) || {};
    var same = saved.email === email && saved.contact === contact && saved.key;
    var key = same ? saved.key : uuid();
    save(id, { key: key, email: email, contact: contact, ts: Date.now() });
    var payload = { product: id, email: email, contact: contact, consent_version: cfg.consentVersion, website: $('pay-site').value };
    return request(payload, key).then(function (res) {
      /* устаревшая ссылка — новый заказ; уже оплаченный заказ (order_already_paid) повторять нельзя */
      if (res.status === 409 && (res.body || {}).error_code === 'payment_link_expired' && !retried) {
        save(id, { key: '', email: email, contact: contact, ts: Date.now() });
        return send(true);
      }
      var b = res.body || {};
      if (res.status !== 200 || !b.payment_url) throw new Error('order ' + res.status);
      if (String(b.amount) !== String(current.dataset.amount)) throw new Error('amount mismatch');
      if (!hostAllowed(b.payment_url)) throw new Error('host not allowed');
      setStatus('redirect', 'Открываю страницу оплаты Т-Банка…');
      window.location.assign(b.payment_url);
    });
  };

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !current) return;
      var email = $('pay-email').value.trim(), contact = $('pay-contact').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setStatus('error', 'Укажите почту — на неё придёт кассовый чек.'); $('pay-email').focus(); return; }
      if (contact.length < 3) { setStatus('error', 'Укажите телефон или ник в мессенджере — по нему свяжусь с вами.'); $('pay-contact').focus(); return; }
      if (!$('pay-consent').checked) { setStatus('error', 'Отметьте согласие с офертой и политикой.'); $('pay-consent').focus(); return; }
      /* ловушка: заполнена сразу после открытия — тихий отказ; автозаполнение позже её не трогает */
      if ($('pay-site').value && Date.now() - openedAt < 2000) { setStatus('error', FAIL_TEXT); return; }
      setBusy(true); setStatus('busy', 'Создаю заказ…');
      send(false).catch(function () { setBusy(false); setStatus('error', FAIL_TEXT); });
    });
  }

  /* услуги, которые всегда заказывают сообщением */
  requests.forEach(function (b) {
    b.addEventListener('click', function (e) { if (openOrder(b)) e.preventDefault(); });
  });

  buttons.forEach(function (b) {
    b.addEventListener('click', function (e) {
      var opened = cfg.enabled ? openPay(b, false) : openOrder(b);
      if (opened) e.preventDefault();
    });
  });

  /* возврат кнопкой «назад» со страницы банка: снять блокировку */
  window.addEventListener('pageshow', function () { if (form) { setBusy(false); setStatus('idle', ''); } });

  /* повтор после отказа: /#tarify?… нельзя, поэтому метка в sessionStorage со страницы «Спасибо» */
  try {
    var retry = sessionStorage.getItem('av-pay:retry');
    if (retry && cfg.enabled) {
      sessionStorage.removeItem('av-pay:retry');
      var btn = document.querySelector('#tarify a[data-pay][data-service-id="' + retry.replace(/[^a-z-]/g, '') + '"]');
      if (btn) openPay(btn, true);
    }
  } catch (e) { /* storage is optional */ }
})();
