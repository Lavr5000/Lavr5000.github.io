/* AI Vibes — страница «Спасибо»: номер заказа из адреса показывается только как текст и только по шаблону. */
(function () {
  'use strict';
  var q = new URLSearchParams(window.location.search);
  var n = q.get('n') || '';
  var valid = /^AV-[0-9A-F]{8}$/.test(n);
  var show = function (id) {
    ['spasibo-plain', 'spasibo-ok', 'spasibo-fail'].forEach(function (x) {
      var el = document.getElementById(x); if (el) el.hidden = x !== id;
    });
  };
  if (q.get('fail') === '1') {
    show('spasibo-fail');
    var retry = document.getElementById('retry-pay');
    if (retry) retry.addEventListener('click', function () {
      try {
        var id = ['setup-start', 'setup-vip'].filter(function (s) { return sessionStorage.getItem('av-pay:' + s); })[0];
        if (id) sessionStorage.setItem('av-pay:retry', id);
      } catch (e) { /* storage is optional */ }
    });
  } else if (valid) {
    document.getElementById('order-number').textContent = n;
    show('spasibo-ok');
  }
})();
