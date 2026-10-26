/* products.render.js — gated catalog tiles on products.html.
 *
 * Since the layout-v2 rebuild the catalog of products.html is static markup: every
 * product WITHOUT a `gate` is rendered by the page itself and never waits for the
 * network. This file handles only records that carry `gate` (a backend switch key,
 * e.g. "pdf_tables"): they ship `visible: false` in products.js and are added to the
 * catalog only after `GET <API_ORIGIN>/api/products/status` answers "public" for
 * that gate. A network error, a non-200 answer or the 4 s timeout leaves the tile
 * hidden — a hidden product must never break or delay the rest of the page.
 *
 * API_ORIGIN comes from vedomost.config.js, the same single source the order forms
 * import, so the catalog and the forms can never drift apart. The CSP meta of
 * products.html allows this origin in connect-src.
 *
 * Data contract stays products.js, validated by scripts/validate_products.mjs.
 */
import { API_ORIGIN } from './vedomost.config.js?v=vedomost-v3-2026-10';

(function (window, document) {
  'use strict';

  var STATUS_URL = API_ORIGIN + '/api/products/status';
  var STATUS_TIMEOUT_MS = 4000;

  function fetchStatus() {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, STATUS_TIMEOUT_MS);
    return fetch(STATUS_URL, { signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function formatPrice(value) {
    // "1490" -> "1 490 ₽"; the registry stores digits without a currency symbol
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  // The same .card markup as the static tiles of products.html (site3.css)
  function card(product) {
    var el = document.createElement('article');
    el.className = 'card';
    el.setAttribute('data-product', product.id);

    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'доступен';
    el.appendChild(tag);

    var name = document.createElement('h3');
    name.textContent = product.title.ru;
    el.appendChild(name);

    if (product.tagline && product.tagline.ru) {
      var lead = document.createElement('p');
      lead.textContent = product.tagline.ru;
      el.appendChild(lead);
    }

    var bullets = document.createElement('ul');
    bullets.className = 'bullets';
    if (product.input && product.input.ru) {
      var li = document.createElement('li');
      li.textContent = 'Вход: ' + product.input.ru;
      bullets.appendChild(li);
    }
    if (product.output && product.output.ru) {
      var li2 = document.createElement('li');
      li2.textContent = 'Выход: ' + product.output.ru;
      bullets.appendChild(li2);
    }
    if (product.audience && product.audience.ru) {
      var li3 = document.createElement('li');
      li3.textContent = 'Кому: ' + product.audience.ru;
      bullets.appendChild(li3);
    }
    el.appendChild(bullets);

    var row = document.createElement('div');
    row.className = 'card-row';
    var price = document.createElement('span');
    price.className = 'card-price';
    price.textContent = formatPrice(product.price.ru);
    row.appendChild(price);

    var cta = document.createElement('a');
    cta.className = 'btn-pay';
    cta.href = product.cta && product.cta.url ? product.cta.url : '#';
    cta.textContent = 'Загрузить PDF';
    // the order dialog on this page (pdf-tables-dialog.js) opens instead; href stays as the no-JS path
    if (product.gate === 'pdf_tables') cta.setAttribute('data-pt-open', '');
    row.appendChild(cta);

    el.appendChild(row);
    return el;
  }

  function orderIn(registry, id) {
    for (var i = 0; i < registry.length; i++) {
      if (registry[i] && registry[i].id === id) return registry[i].order || 999;
    }
    return 999;
  }

  // Insert by registry order among the static [data-product] tiles: before the first
  // tile whose product has a higher order, else at the end of the grid.
  function insertByOrder(host, el, registry, order) {
    var tiles = host.querySelectorAll('[data-product]');
    for (var i = 0; i < tiles.length; i++) {
      var id = tiles[i].getAttribute('data-product');
      if (orderIn(registry, id) > order) {
        host.insertBefore(el, tiles[i]);
        return;
      }
    }
    host.appendChild(el);
  }

  function activate() {
    var registry = window.AI_PRODUCTS;
    var host = document.querySelector('#catalog-section .cards');
    if (!Array.isArray(registry) || !host) return;

    var gated = registry.filter(function (p) {
      return p && p.gate && p.id && p.title && p.title.ru
        && p.price && p.price.ru && p.cta && p.cta.url;
    });
    if (!gated.length) return;

    fetchStatus()
      .then(function (status) {
        gated.forEach(function (p) {
          if (status && status[p.gate] === 'public') {
            insertByOrder(host, card(p), registry, p.order || 999);
          }
        });
      })
      .catch(function () { /* offline / non-200 / timeout — the tile stays hidden */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate);
  } else {
    activate();
  }
})(window, document);
