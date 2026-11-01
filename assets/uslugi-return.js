/* AI Vibes — страница возврата из банка в бот (/uslugi/return/).
 * Заказ начат в боте MAX и оплачен; банк вернул плательщика на сайт с параметром o=pay_<hex8>.
 * Переход автоматический только при строгом o (ровно один параметр, ^pay_[0-9a-f]{8}$) и валидном
 * bot_link_prefix из каталога услуг (window.USLUGI_CATALOG, файл /uslugi.catalog.js — никогда из адреса
 * страницы). Любой другой адрес (нет o, лишние символы, URL, javascript:, двойной параметр) — без
 * автоперехода, только кнопка «Открыть бота» на голую ссылку бота. Страница никуда не ходит (нет fetch);
 * ссылка собирается только через href, текст — только через разметку. */
(function () {
  'use strict';
  var ORDER_RE = /^pay_[0-9a-f]{8}$/;
  var PREFIX_RE = /^https:\/\/max\.ru\/[A-Za-z0-9_.\/?=&%-]+$/;
  var START_TAIL = '?start=';
  var DELAY_MS = 1200;
  var $ = function (id) { return document.getElementById(id); };

  var catalog = window.USLUGI_CATALOG;
  var prefix = catalog && typeof catalog.bot_link_prefix === 'string' ? catalog.bot_link_prefix : '';
  var prefixOk = PREFIX_RE.test(prefix) && prefix.slice(-START_TAIL.length) === START_TAIL;
  var bare = prefixOk ? prefix.slice(0, prefix.length - START_TAIL.length) : '';

  var q = new URLSearchParams(window.location.search);
  var all = q.getAll('o');
  var order = all.length === 1 && ORDER_RE.test(all[0]) ? all[0] : '';

  var show = function (id) {
    ['return-plain', 'return-auto'].forEach(function (x) {
      var el = $(x); if (el) el.hidden = x !== id;
    });
  };

  /* каталог не загрузился или битый: остаётся текст страницы, без переходов и ссылок */
  if (!prefixOk) return;

  if (order) {
    var url = prefix + order;
    show('return-auto');
    var orderBtn = $('open-order');
    if (orderBtn) orderBtn.href = url;
    var orderWrap = $('open-order-wrap');
    if (orderWrap) orderWrap.hidden = false;
    setTimeout(function () {
      window.location.replace(url);
    }, DELAY_MS);
  } else {
    show('return-plain');
    var botBtn = $('open-bot');
    if (botBtn) botBtn.href = bare;
    var botWrap = $('open-bot-wrap');
    if (botWrap) botWrap.hidden = false;
  }
})();
