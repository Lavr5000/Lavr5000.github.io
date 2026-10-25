/* rieltor.js - draws the tiles of /rieltor/ from window.USLUGI_CATALOG (uslugi.catalog.js, a generated copy of the
 * kit catalog). Without scripts, or if the catalog is not usable, the static list generated into the page between
 * <!-- USLUGI:BEGIN --> and <!-- USLUGI:END --> stays visible. No network, no payments: the order button is a link to the
 * bot in MAX (?start=usl-<id>), the subscription button is a link to its card on /services/. */
(function () {
  'use strict';
  var cat = window.USLUGI_CATALOG;
  var fmt = window.USLUGI_FORMAT_PRICE;
  var root = document.getElementById('uslugi-tiles');
  if (!root || !cat || typeof fmt !== 'function' || !cat.subscription || !Array.isArray(cat.services) || !Array.isArray(cat.backlog)) return;

  var SUB_NOTE = 'Рабочий помощник для сделок с недвижимостью: считает, пишет, проверяет и раскладывает по папкам.';
  var SUB_UNIT = 'за одно рабочее место';
  var PAY_NOTE = 'Оплата и выдача результата — в боте MAX.';

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

  function row(t, kop, linkText, href, external) {
    var r = el('div', 'rl-row');
    r.appendChild(el('span', 'rl-price', fmt(kop)));
    var a = el('a', 'btn-pay rl-btn', linkText);
    a.setAttribute('href', href);
    if (external) a.setAttribute('rel', 'noopener');
    r.appendChild(a);
    t.appendChild(r);
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
    row(body, sub.price_kop, 'Подробнее', subUrl, false);
    frag.appendChild(st);

    cat.services.forEach(function (s) {
      var t = tile('service', s.id, !!s.enabled, s.title);
      if (s.enabled) {
        t.appendChild(el('p', 'rl-note', PAY_NOTE));
        var href = String(cat.bot_link_prefix || '') + 'usl-' + s.id;
        if (href.indexOf('https://max.ru/') !== 0) throw new Error('bot link');
        row(t, s.price_kop, 'Заказать в боте', href, true);
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
