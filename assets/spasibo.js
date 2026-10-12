/* AI Vibes — страница «Спасибо»: номер заказа из адреса показывается только как текст и только по шаблону.
 * Набор для риэлторов: банк возвращает плательщика с параметром r (его знает только тот, кто платил); по паре
 * «номер + r» сайт отдаёт ссылку на бота и код. Всё выводится как текст; ссылка — только на max.ru. */
(function () {
  'use strict';
  var API = 'https://api.ai-vibes.ru';
  var q = new URLSearchParams(window.location.search);
  var n = q.get('n') || '';
  var valid = /^AV-[0-9A-F]{8}$/.test(n);
  var SECTIONS = ['spasibo-plain', 'spasibo-ok', 'spasibo-fail', 'spasibo-rieltor'];
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

  /* ответ сайта -> экран; возвращает true, если дальше опрашивать не нужно */
  var render = function (j) {
    if (!j || typeof j.status !== 'string') return true;
    var botName = typeof j.bot_name === 'string' ? j.bot_name.slice(0, 80) : 'Помощник: подключение';
    setText('rl-number', n);
    setHidden('rl-link-wrap', true); setHidden('rl-code-wrap', true); setText('rl-note', '');
    if (j.status === 'ready' && typeof j.link === 'string' && SAFE_LINK.test(j.link) && typeof j.code === 'string' && /^[A-Z2-9 -]{12,20}$/.test(j.code)) {
      show('spasibo-rieltor');
      setText('rl-title', 'Оплата получена');
      setText('rl-lead', 'Откройте нашего бота в MAX и нажмите «Начать» — он проведёт вас по настройке.');
      $('rl-link').href = j.link;
      setHidden('rl-link-wrap', false);
      setText('rl-fallback', 'Если ссылка не открыла бота: найдите в MAX бот «' + botName + '», нажмите «Начать» и отправьте ему этот код:');
      setText('rl-code', j.code);
      setHidden('rl-code-wrap', false);
      setText('rl-note', 'Эти же ссылка и код придут на указанную вами почту. Код действует 14 дней и подходит для одного чата.');
      return true;
    }
    if (j.status === 'bound') {
      show('spasibo-rieltor');
      setText('rl-title', 'Бот уже подключён');
      setText('rl-lead', 'Продолжайте настройку в чате с ботом «' + botName + '» в MAX.');
      return true;
    }
    if (j.status === 'check_mail') {
      show('spasibo-rieltor');
      setText('rl-title', 'Оплата получена');
      setText('rl-lead', 'Ссылка на бота и код отправлены на указанную вами почту. Письма нет? Проверьте папку «Спам» или напишите нам и назовите номер заказа.');
      return true;
    }
    if (j.status === 'expired') {
      show('spasibo-rieltor');
      setText('rl-title', 'Срок кода истёк');
      setText('rl-lead', 'Напишите нам и назовите номер заказа — выдадим новый.');
      return true;
    }
    if (j.status === 'refunded') {
      show('spasibo-rieltor');
      setText('rl-title', 'Оплата возвращена');
      setText('rl-lead', 'По этому заказу деньги возвращены, подключение закрыто. Вопросы — напишите нам.');
      return true;
    }
    return false; /* pending: банк ещё подтверждает */
  };

  var startRieltor = function (r) {
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
    if (r) startRieltor(r);
  }
})();
