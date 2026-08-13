/* products.render.js — renders the catalog of products.html from window.AI_PRODUCTS.
 *
 * Replaces the React app (products.app.js + assets/catalog.js): five rows of a static
 * page do not need a framework, and the page has to run under `default-src 'self'`
 * without inline scripts.
 *
 * Data contract stays products.js, validated by scripts/validate_products.mjs — this
 * file only reads it. A record is shown when visible !== false; price and CTA appear
 * only for status "available", because everything else is not on sale yet and a price
 * next to it would read as a public offer.
 */
(function (window, document) {
  'use strict';

  var STATE_LABEL = {
    available: 'Доступен',
    soon: 'Скоро',
    planned: 'В планах',
    dev: 'В разработке'
  };

  function formatPrice(value) {
    // "1490" -> "1 490 ₽"; the registry stores digits without a currency symbol
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  function row(product) {
    var available = product.status === 'available';
    var url = available && product.cta && product.cta.url;
    var el = document.createElement(url ? 'a' : 'div');
    el.className = 'tool';
    if (url) el.href = url;

    var name = document.createElement('span');
    name.className = 'tool-name';
    name.appendChild(document.createTextNode(product.title.ru));
    if (product.tagline && product.tagline.ru) {
      var sub = document.createElement('small');
      sub.textContent = product.tagline.ru;
      name.appendChild(sub);
    }
    el.appendChild(name);

    var price = document.createElement('span');
    price.className = 'price';
    // не продаётся — цена не показывается (иначе читается как публичная оферта)
    price.textContent = available ? formatPrice(product.price.ru) : '';
    el.appendChild(price);

    var state = document.createElement('span');
    state.className = 'tool-state' + (available ? ' on' : '');
    state.textContent = STATE_LABEL[product.status] || product.status;
    el.appendChild(state);

    var arrow = document.createElement('i');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = url ? '→' : '';
    el.appendChild(arrow);

    return el;
  }

  function render() {
    var host = document.querySelector('#catalog');
    var products = window.AI_PRODUCTS;
    if (!host || !Array.isArray(products)) return;

    products
      .filter(function (p) {
        return p && p.visible !== false && p.id && p.title && p.title.ru && p.price && p.price.ru;
      })
      .sort(function (a, b) { return (a.order || 999) - (b.order || 999); })
      .forEach(function (p) { host.appendChild(row(p)); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})(window, document);
