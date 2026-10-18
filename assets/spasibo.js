/* AI Vibes — страница «Спасибо»: номер заказа из адреса показывается только как текст и только по шаблону.
 * Товары с выдачей через бота (сейчас «Старт»; механизм общий для любого товара выдачи): банк возвращает плательщика
 * с параметром r (его знает только тот, кто платил); по паре «номер + r» сайт отдаёт ссылку на бота и код
 * (GET /api/rieltor/handoff -> product, status, link, code, bot_name). Всё выводится как текст; ссылка — только на max.ru.
 * Тексты зависят от товара (TEXTS); неизвестный товар получает общие. */
(function () {
  'use strict';
  var API = 'https://api.ai-vibes.ru';
  var q = new URLSearchParams(window.location.search);
  var n = q.get('n') || '';
  var valid = /^AV-[0-9A-F]{8}$/.test(n);
  var SECTIONS = ['spasibo-plain', 'spasibo-ok', 'spasibo-fail', 'spasibo-handoff'];
  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) {
    SECTIONS.forEach(function (x) {
      var el = $(x); if (el) el.hidden = x !== id;
    });
  };

  /* параметр r: берём из адреса, прячем из строки браузера, на случай обновления страницы держим в сессии */
  var readReturnKey = function () {
    var r = q.get('r') || '';
    try {
      if (r && /^[A-Z2-9]{20}$/.test(r)) {
        sessionStorage.setItem('av-rl:' + n, r);
        if (window.history && history.replaceState) history.replaceState(null, '', window.location.pathname + '?n=' + encodeURIComponent(n));
      } else if (!r) {
        r = sessionStorage.getItem('av-rl:' + n) || '';
      }
    } catch (e) { /* storage is optional */ }
    return /^[A-Z2-9]{20}$/.test(r) ? r : '';
  };

  var setText = function (id, text) { var el = $(id); if (el) el.textContent = text; };
  var setHidden = function (id, hidden) { var el = $(id); if (el) el.hidden = hidden; };
  var SAFE_LINK = /^https:\/\/max\.ru\/[A-Za-z0-9_.\/?=&%-]+$/;

  /* тексты по товару; ключи — id услуги, как их отдаёт бэкенд (в поле product допускается и короткое имя) */
  var TEXTS = {
    'setup-start': {
      title: 'Оплата получена',
      lead: 'Нажмите кнопку ниже — откроется наш бот в MAX. Нажмите в нём «Начать»: бот сам проведёт вас по настройке «Старта» — согласие, анкета, проверка компьютера, установка.',
      fallback: function (bot) { return 'Если ссылка не открылась: найдите в MAX бот «' + bot + '», нажмите «Начать» и отправьте ему этот код:'; },
      note: 'Эти же ссылка и код придут на почту, которую вы указали при оплате, — письмо продублирует их. Код действует 14 дней и подходит для одного чата.',
      bound: function (bot) { return 'Продолжайте настройку в чате с ботом «' + bot + '» в MAX: он ведёт вас по шагам.'; }
    }
  };
  var GENERIC = {
    title: 'Оплата получена',
    lead: 'Откройте нашего бота в MAX и нажмите «Начать» — он проведёт вас по настройке.',
    fallback: function (bot) { return 'Если ссылка не открыла бота: найдите в MAX бот «' + bot + '», нажмите «Начать» и отправьте ему этот код:'; },
    note: 'Эти же ссылка и код придут на указанную вами почту. Код действует 14 дней и подходит для одного чата.',
    bound: function (bot) { return 'Продолжайте настройку в чате с ботом «' + bot + '» в MAX.'; }
  };
  var textsFor = function (product) {
    var id = typeof product === 'string' ? product.slice(0, 40) : '';
    if (id === 'start') id = 'setup-start';
    return Object.prototype.hasOwnProperty.call(TEXTS, id) ? TEXTS[id] : GENERIC;
  };

  /* ответ сайта -> экран; возвращает true, если дальше опрашивать не нужно */
  var render = function (j) {
    if (!j || typeof j.status !== 'string') return true;
    var botName = typeof j.bot_name === 'string' ? j.bot_name.slice(0, 80) : 'Помощник: подключение';
    var T = textsFor(j.product);
    setText('ho-number', n);
    setHidden('ho-link-wrap', true); setHidden('ho-code-wrap', true); setText('ho-note', '');
    if (j.status === 'ready' && typeof j.link === 'string' && SAFE_LINK.test(j.link) && typeof j.code === 'string' && /^[A-Z2-9 -]{12,20}$/.test(j.code)) {
      show('spasibo-handoff');
      setText('ho-title', T.title);
      setText('ho-lead', T.lead);
      $('ho-link').href = j.link;
      setHidden('ho-link-wrap', false);
      setText('ho-fallback', T.fallback(botName));
      setText('ho-code', j.code);
      setHidden('ho-code-wrap', false);
      setText('ho-note', T.note);
      return true;
    }
    if (j.status === 'bound') {
      show('spasibo-handoff');
      setText('ho-title', 'Бот уже подключён');
      setText('ho-lead', T.bound(botName));
      return true;
    }
    if (j.status === 'check_mail') {
      show('spasibo-handoff');
      setText('ho-title', 'Оплата получена');
      setText('ho-lead', 'Ссылка на бота и код отправлены на указанную вами почту. Письма нет? Проверьте папку «Спам» или напишите нам и назовите номер заказа.');
      return true;
    }
    if (j.status === 'expired') {
      show('spasibo-handoff');
      setText('ho-title', 'Срок кода истёк');
      setText('ho-lead', 'Напишите нам и назовите номер заказа — выдадим новый.');
      return true;
    }
    if (j.status === 'refunded') {
      show('spasibo-handoff');
      setText('ho-title', 'Оплата возвращена');
      setText('ho-lead', 'По этому заказу деньги возвращены, подключение закрыто. Вопросы — напишите нам.');
      return true;
    }
    return false; /* pending: банк ещё подтверждает */
  };

  var startHandoff = function (r) {
    var tries = 0;
    var poll = function () {
      var url = API + '/api/rieltor/handoff?n=' + encodeURIComponent(n) + '&r=' + encodeURIComponent(r);
      fetch(url, { cache: 'no-store' }).then(function (res) {
        return res.ok ? res.json() : null;
      }).then(function (j) {
        if (render(j)) return;
        if (++tries < 24) setTimeout(poll, 5000);
      }).catch(function () { /* без связи остаётся обычный текст страницы; письмо придёт отдельно */ });
    };
    poll();
  };

  if (q.get('fail') === '1') {
    show('spasibo-fail');
    var retry = $('retry-pay');
    if (retry) retry.addEventListener('click', function () {
      try {
        var id = ['setup-start', 'setup-vip', 'setup-rieltor'].filter(function (s) { return sessionStorage.getItem('av-pay:' + s); })[0];
        if (id) sessionStorage.setItem('av-pay:retry', id);
      } catch (e) { /* storage is optional */ }
    });
  } else if (valid) {
    $('order-number').textContent = n;
    show('spasibo-ok');
    var r = readReturnKey();
    if (r) startHandoff(r);
  }
})();
