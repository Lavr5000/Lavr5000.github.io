/* rieltor.js - draws the tiles of /rieltor/ from window.USLUGI_CATALOG (uslugi.catalog.js, a generated copy of the
 * kit catalog). Without scripts, or if the catalog is not usable, the static list generated into the page between
 * <!-- USLUGI:BEGIN --> and <!-- USLUGI:END --> stays visible.
 * Two ways to order an enabled service: pay right on the site (the button opens the e-mail + consent form, the
 * backend creates the order and the bank link; after the bank the success page hands the order to the bot) and the
 * bot link as the second way (?start=usl-<id>). No other network calls: only api.ai-vibes.ru. */
(function () {
  'use strict';
  var cat = window.USLUGI_CATALOG;
  var fmt = window.USLUGI_FORMAT_PRICE;
  var root = document.getElementById('uslugi-tiles');
  if (!root || !cat || typeof fmt !== 'function' || !cat.subscription || !Array.isArray(cat.services) || !Array.isArray(cat.backlog)) return;

  var API = 'https://api.ai-vibes.ru';
  var CONSENT_VERSION = 'uslugi-site-v2-2026-10';   // keep in sync with the backend consent text
  var SUB_NOTE = 'Рабочий помощник для сделок с недвижимостью: считает, пишет, проверяет и раскладывает по папкам.';
  var SUB_UNIT = 'за одно рабочее место';
  var PAY_NOTE = 'Оплатите на сайте и продолжите в боте либо сразу закажите в боте: бот сам проведёт по шагам и покажет согласие.';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function tile(kind, id, enabled, title) {
    var t = el('article', 'rl-tile rl-tile--' + kind);
    t.setAttribute('data-uslugi-id', id);
    t.setAttribute('data-kind', kind);
    t.setAttribute('data-enabled', enabled ? '1' : '0');
    t.appendChild(el('h3', 'rl-title', title));
    return t;
  }

  function soon(t) {
    t.classList.add('rl-tile--soon');
    t.insertBefore(el('span', 'tag tag--soon rl-soon', 'скоро'), t.firstChild);
  }

  /* ------------------------------------------------------------------ the site checkout */
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* optional */ } }
  };

  function errText(code) {
    if (code === 'rate_limited') return 'Слишком много попыток. Подождите минуту и попробуйте ещё раз.';
    if (code === 'service_disabled') return 'Услуга временно закрыта для оплаты на сайте. Можно заказать её в боте.';
    if (code === 'bad_email') return 'Проверьте адрес почты: на него придёт кассовый чек.';
    return 'Оплату не получилось открыть. Попробуйте ещё раз или напишите нам.';
  }

  function payForm(t, s) {
    var wrap = el('form', 'rl-pay');
    wrap.setAttribute('novalidate', 'novalidate');
    var emailLabel = el('label', 'rl-pay-l');
    emailLabel.appendChild(el('span', 'rl-pay-t', 'E-mail для кассового чека'));
    var email = el('input', 'rl-pay-email');
    email.type = 'email';
    email.name = 'email';
    email.required = true;
    email.autocomplete = 'email';
    emailLabel.appendChild(email);
    var checkLabel = el('label', 'rl-pay-l rl-pay-consent');
    var check = el('input', 'rl-pay-check');
    check.type = 'checkbox';
    check.required = true;
    checkLabel.appendChild(check);
    var cl = el('span', 'rl-pay-t');
    cl.appendChild(document.createTextNode('Принимаю '));
    var a = el('a', null, 'условия оферты и согласие на обработку данных');
    a.href = '/oferta.html#uslugi';
    cl.appendChild(a);
    checkLabel.appendChild(cl);
    var submit = el('button', 'btn-pay rl-btn', 'Перейти к оплате ' + fmt(s.price_kop));
    submit.type = 'submit';
    var err = el('p', 'rl-pay-err');
    err.hidden = true;
    wrap.appendChild(emailLabel);
    wrap.appendChild(checkLabel);
    wrap.appendChild(submit);
    wrap.appendChild(err);
    t.appendChild(wrap);

    wrap.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.hidden = true;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
        err.textContent = errText('bad_email'); err.hidden = false; return;
      }
      if (!check.checked) {
        err.textContent = 'Отметьте согласие — без него заказ оформить нельзя.'; err.hidden = false; return;
      }
      var key = store.get('av-uslugi-key:' + s.id);
      if (!key || !/^[0-9a-f-]{36}$/.test(key)) {
        key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '';
        if (!key) { err.textContent = errText(); err.hidden = false; return; }
        store.set('av-uslugi-key:' + s.id, key);
      }
      submit.disabled = true;
      var stop = window.AbortController ? new AbortController() : null;
      var timer = stop ? setTimeout(function () { stop.abort(); }, 15000) : null;
      fetch(API + '/api/uslugi-site/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ service: s.id, email: email.value.trim(), consent_version: CONSENT_VERSION }),
        signal: stop ? stop.signal : undefined
      }).then(function (res) {
        return res.json().then(function (j) { return { ok: res.ok, j: j }; });
      }).then(function (r) {
        if (r.ok && r.j && typeof r.j.payment_url === 'string' && /^https:\/\//.test(r.j.payment_url)) {
          store.set('av-uslugi-r:' + r.j.order, r.j.r || '');
          window.location.href = r.j.payment_url;
          return;
        }
        throw { code: r.j && r.j.error };
      }).catch(function (e) {
        if (timer) clearTimeout(timer);
        submit.disabled = false;
        err.textContent = errText(e && e.code);
        err.hidden = false;
      });
    });
    return wrap;
  }

  function row(t, s, botHref) {
    var r = el('div', 'rl-row');
    r.appendChild(el('span', 'rl-price', fmt(s.price_kop)));
    var pay = el('button', 'btn-pay rl-btn rl-btn-pay', 'Оплатить ' + fmt(s.price_kop));
    pay.type = 'button';
    var opened = false;
    pay.addEventListener('click', function () {
      if (opened) return;
      opened = true;
      payForm(t, s);
      var f = t.querySelector('.rl-pay-email');
      if (f) f.focus();
    });
    r.appendChild(pay);
    t.appendChild(r);
    var alt = el('p', 'rl-alt');
    var a = el('a', null, 'Или заказать в боте MAX');
    a.href = botHref;
    a.rel = 'noopener';
    alt.appendChild(a);
    t.appendChild(alt);
  }

  function build() {
    var frag = document.createDocumentFragment();
    var sub = cat.subscription;
    var subUrl = typeof sub.url === 'string' && sub.url.charAt(0) === '/' ? sub.url : '/services/';
    var st = tile('subscription', sub.id, true, sub.title);
    st.appendChild(el('p', 'rl-note', SUB_NOTE));
    var body = el('div', 'rl-side');
    body.appendChild(el('p', 'rl-unit', SUB_UNIT));
    st.appendChild(body);
    var sr = el('div', 'rl-row');
    sr.appendChild(el('span', 'rl-price', fmt(sub.price_kop)));
    var sa = el('a', 'btn-pay rl-btn', 'Подробнее');
    sa.setAttribute('href', subUrl);
    sr.appendChild(sa);
    body.appendChild(sr);
    frag.appendChild(st);

    function botLink(id) {
      var href = String(cat.bot_link_prefix || '') + 'usl-' + id;
      if (href.indexOf('https://max.ru/') !== 0) throw new Error('bot link');
      return href;
    }

    cat.services.forEach(function (s) {
      var t = tile('service', s.id, !!s.enabled, s.title);
      if (s.enabled) {
        if (s.disclaimer) t.appendChild(el('p', 'rl-note rl-disclaimer', s.disclaimer));
        t.appendChild(el('p', 'rl-note', PAY_NOTE));
        row(t, s, botLink(s.id));
      } else {
        soon(t);
      }
      frag.appendChild(t);
    });

    (cat.bundles || []).forEach(function (b) {
      var t = tile('bundle', b.id, !!b.enabled, b.title);
      if (b.enabled) {
        t.appendChild(el('p', 'rl-note', PAY_NOTE));
        row(t, b, botLink(b.id));
      } else {
        soon(t);
      }
      frag.appendChild(t);
    });

    cat.backlog.forEach(function (b) {
      var t = tile('backlog', b.id, false, b.title);
      soon(t);
      frag.appendChild(t);
    });
    return frag;
  }

  var frag;
  try { frag = build(); } catch (e) { return; }
  root.appendChild(frag);
  var fallback = document.querySelector('.uslugi-fallback');
  if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
})();
