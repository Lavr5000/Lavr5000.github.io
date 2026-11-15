/* AI Vibes — клиентское перенаправление со страницы-заглушки на новый адрес.
   До перенаправления запоминает referrer для метрики. ES5, без зависимостей. */
(function () {
  'use strict';
  var ref = document.referrer;
  if (ref) {
    try { sessionStorage.setItem('av-ref', ref); } catch (e) {}
  }
  var to = window.AVRedirect && window.AVRedirect.map ? window.AVRedirect.map(location.href) : '';
  if (to) { location.replace(to); }
})();
