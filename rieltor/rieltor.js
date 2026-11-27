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
  var CONSENT_VERSION = 'uslugi-site-v3-2026-11';   // keep in sync with the backend consent text
  /* D-1: the tile copy is fixed by the owner decision (for-linejka.md, block 1); only the price still comes from the catalog */
  var SUB_TITLE = 'Помощник риэлтора на вашем компьютере';
  var SUB_LEAD = 'Рутина по объекту за минуты: справка о цене, проверка документов, договоры.';
  var SUB_ABOUT = 'Агент работает на китайской модели GLM: ставится на ваш компьютер сам после оплаты, работает с вашими папками клиентов и понимает обычные просьбы своими словами.';
  var SUB_CAN_LABEL = 'Что уже умеет:';
  var SUB_CAN = [
    'отчёт о цене по аналогам: три цены, Excel и Word для собственника;',
    'проверка чужого договора (купля-продажа, аренда, услуги) и письмо с замечаниями;',
    'договор купли-продажи, предварительный договор, соглашение о задатке, расписка, акт и опись имущества — из карточки объекта;',
    'разбор выписки ЕГРН и список документов, которых не хватает для сделки;',
    'текст объявления для Авито и памятка, что вводить в поля Авито и ЦИАН;',
    'фото до/после и планировка с подписью «визуализация».'
  ];
  var SUB_LIMITS = 'До 30 заказов в месяц. Пробного периода нет. Помощник не заменяет юриста и оценщика.';
  var SUB_BTN = 'Подключить';
  var SUB_PER_MONTH = 'в месяц';
  var PAY_NOTE = 'Оплатите на сайте и продолжите в боте либо сразу закажите в боте: бот сам проведёт по шагам и покажет согласие.';
  /* The optional promo code: ?promo= on the page pre-fills the form field; the backend checks the code,
   * the discounted amount is confirmed by the bank page (the button keeps the catalog price). */
  var pm = /[?&]promo=([^&]*)/.exec(window.location.search || '');
  var PROMO_PRESET = pm ? decodeURIComponent(pm[1].replace(/\+/g, '%20')) : '';
  /* 2026-11-17: a personal free code must not stay in the address bar (a screenshot, a shared link, the browser
     history): it is read once above and stripped at once. Other parameters stay as they were. */
  if (pm) {
    try {
      var usp = new URLSearchParams(window.location.search);
      usp.delete('promo');
      var qs = usp.toString();
      history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
    } catch (e) { /* an old browser: the page still works, the code just stays in the URL */ }
  }

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
    var promoLabel = el('label', 'rl-pay-l');
    promoLabel.appendChild(el('span', 'rl-pay-t', 'Промокод (если есть)'));
    var promo = el('input', 'rl-pay-promo');
    promo.type = 'text';
    promo.name = 'promo';
    promo.autocomplete = 'off';
    promo.maxLength = 64;
    if (PROMO_PRESET) promo.value = PROMO_PRESET;
    promoLabel.appendChild(promo);
    var promoHint = el('p', 'rl-pay-promo-hint');
    promoHint.hidden = true;
    function syncPromoHint() {
      var on = promo.value.trim() !== '' && s.promo_price_kop;
      promoHint.hidden = !on;
      if (on) promoHint.textContent = 'Если промокод действителен — ' + fmt(s.promo_price_kop) + '; итоговую сумму покажет банк.';
    }
    function promoKey() { return promo.value.replace(/\s+/g, '').toLowerCase(); }   /* inner spaces and the case never matter (the backend compares so) */
    promo.addEventListener('input', syncPromoHint);
    syncPromoHint();
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
    wrap.appendChild(promoLabel);
    wrap.appendChild(promoHint);
    wrap.appendChild(checkLabel);
    wrap.appendChild(submit);
    wrap.appendChild(err);
    t.appendChild(wrap);

    /* 2026-11-17: the free road — the backend answered a deep link, so the order is made in the bot MAX. The form
       (e-mail, promo, consent, pay) gives way to one button: no payment page, no receipt, no bank. */
    function showFree(link) {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
      wrap.appendChild(el('p', 'rl-pay-free', 'Заказ бесплатный — оформлю его в MAX. Нажмите кнопку, дальше всё в чате.'));
      var go = el('a', 'btn-pay rl-btn', 'Продолжить в MAX');
      go.href = link;
      go.target = '_blank';
      go.rel = 'noopener';
      wrap.appendChild(go);
      var back = el('p', 'rl-pay-free-hint', 'Это персональная ссылка: в MAX заказ сделают бесплатно, без оплаты и чека.');
      wrap.appendChild(back);
    }

    wrap.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.hidden = true;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) {
        err.textContent = errText('bad_email'); err.hidden = false; return;
      }
      if (!check.checked) {
        err.textContent = 'Отметьте согласие — без него заказ оформить нельзя.'; err.hidden = false; return;
      }
      var keyName = 'av-uslugi-key:' + s.id + (promoKey() ? ':' + promoKey() : '');   /* a typed promo code is another order */
      var key = store.get(keyName);
      if (!key || !/^[0-9a-f-]{36}$/.test(key)) {
        key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '';
        if (!key) { err.textContent = errText(); err.hidden = false; return; }
        store.set(keyName, key);
      }
      submit.disabled = true;
      var body = { service: s.id, email: email.value.trim(), consent_version: CONSENT_VERSION };
      var pc = promo.value.trim();
      if (pc) body.promo = pc;
      var stop = window.AbortController ? new AbortController() : null;
      var timer = stop ? setTimeout(function () { stop.abort(); }, 15000) : null;
      fetch(API + '/api/uslugi-site/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
        signal: stop ? stop.signal : undefined
      }).then(function (res) {
        return res.json().then(function (j) { return { ok: res.ok, j: j }; });
      }).then(function (r) {
        /* 2026-11-17 (inna-free-mode, З-2): the personal code of the free road does NOT make an order here — the
           backend answers a deep link into the bot, where the free order is made by the chat itself. No bank, no
           receipt, no e-mail needed; the form gives way to the MAX button. */
        if (r.ok && r.j && r.j.free === true && typeof r.j.link === 'string' && /^https:\/\//.test(r.j.link)) {
          showFree(r.j.link);
          return;
        }
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

  /* 2026-11-24: «Демонстрация услуги» — a scripted MAX chat in a modal (rieltor/demo/demo.js, window.AVDemo).
     Only for the services that have a demo; its last button «Заказать» leads to the same bot order as the tile. */
  var DEMO_KEY = { 'spravka-cena': 'spravka', 'yurproverka': 'yur', 'foto-plan': 'foto', 'dkp': 'dkp', 'predv-dkp': 'pdkp', 'invest-podbor': 'invest' };
  function demoButton(t, id, botHref) {
    var key = DEMO_KEY[id];
    var demo = window.AVDemo;
    if (!key || !demo || typeof demo.open !== 'function' || !demo.has(key)) return;
    var b = el('button', 'btn-line rl-btn-demo', 'Демонстрация услуги');
    b.type = 'button';
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', function () { demo.open(key, botHref); });
    t.appendChild(b);
  }

  function build() {
    var frag = document.createDocumentFragment();
    var sub = cat.subscription;
    var subUrl = typeof sub.url === 'string' && sub.url.charAt(0) === '/' ? sub.url : '/#service-rieltor';
    var subOpen = sub.enabled !== false;   // a closed subscription goes last, marked «скоро», with no price and no button
    var st = tile('subscription', sub.id, subOpen, SUB_TITLE);
    var left = el('div', 'rl-sub-main');
    left.appendChild(el('p', 'rl-note rl-sub-lead', SUB_LEAD));
    left.appendChild(el('p', 'rl-note', SUB_ABOUT));
    left.appendChild(el('p', 'rl-note rl-sub-can', SUB_CAN_LABEL));
    var can = el('ul', 'rl-sub-list');
    SUB_CAN.forEach(function (item) { can.appendChild(el('li', null, item)); });
    left.appendChild(can);
    left.appendChild(el('p', 'rl-note rl-sub-limits', SUB_LIMITS));
    st.appendChild(left);
    if (subOpen) {
      var body = el('div', 'rl-side');
      var priceLine = el('p', 'rl-price-line');
      priceLine.appendChild(el('span', 'rl-price', fmt(sub.price_kop)));   // stays byte for byte the catalog label
      priceLine.appendChild(el('span', 'rl-unit', SUB_PER_MONTH));
      body.appendChild(priceLine);
      var sa = el('a', 'btn-pay rl-btn', SUB_BTN);
      sa.setAttribute('href', subUrl);
      body.appendChild(sa);
      st.appendChild(body);
      frag.appendChild(st);
    } else {
      soon(st);
    }

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
        demoButton(t, s.id, botLink(s.id));
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
    if (!subOpen) frag.appendChild(st);
    return frag;
  }

  var frag;
  try { frag = build(); } catch (e) { return; }
  root.appendChild(frag);
  var fallback = document.querySelector('.uslugi-fallback');
  if (fallback && fallback.parentNode) fallback.parentNode.removeChild(fallback);
})();
