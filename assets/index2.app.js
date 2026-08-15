/* AI Vibes — главная и страница услуг. Без сети, без зависимостей. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---- 1. Появление блоков ---- */
  var hero = $('#hero');
  if (reduce || !('IntersectionObserver' in window)) {
    $$('[data-reveal]').forEach(function (el) { el.classList.add('in'); });
    $$('.step').forEach(function (el) { el.classList.add('in'); });
    if (hero) hero.classList.add('ready');
  } else {
    if (hero) requestAnimationFrame(function () { hero.classList.add('ready'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    $$('[data-reveal]').forEach(function (el, i) {
      el.style.transitionDelay = (Math.min(i, 3) * 70) + 'ms';
      io.observe(el);
    });
    $$('.step').forEach(function (el) { io.observe(el); });
  }

  /* ---- 2. Навигация: фон при скролле + активный раздел ---- */
  var nav = $('#nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var links = $$('.nav-link');
  if ('IntersectionObserver' in window && links.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) {
          l.classList.toggle('is-active', l.getAttribute('href') === '#' + e.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['services', 'process', 'author'].forEach(function (id) {
      var s = document.getElementById(id); if (s) spy.observe(s);
    });
  }

  /* ---- 3. Мобильное меню ---- */
  var drawer = $('#drawer'), burger = $('#burger');
  var setDrawer = function (open) {
    if (!drawer || !burger) return;
    drawer.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) { var f = drawer.querySelector('a'); if (f) f.focus(); }
    else burger.focus();
  };
  if (drawer && burger) {
    burger.addEventListener('click', function () { setDrawer(!drawer.classList.contains('is-open')); });
    var drawerClose = $('#drawer-close');
    if (drawerClose) drawerClose.addEventListener('click', function () { setDrawer(false); });
    $$('#drawer a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
  }

  /* ---- 4. Блик за курсором на плашках ---- */
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    $$('.plate').forEach(function (p) {
      p.addEventListener('pointermove', function (e) {
        var r = p.getBoundingClientRect();
        p.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        p.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ---- 5. Модалка заявки: реальные каналы, без платёжной формы и без сети ---- */
  var modal = $('#order-modal'), lastFocus = null;
  /* Цена приходит с кнопки (data-price-label) — услуги стоят по-разному, и хардкод здесь
     означал бы «15 000 ₽» в письме про услугу за 3 500 ₽. Соответствие ярлыка кнопки реестру
     services.js проверяет scripts/validate_services.mjs. */
  var openModal = function (service, priceLabel) {
    if (!modal) return;
    lastFocus = document.activeElement;
    $('#order-service').textContent = service;
    var priceNode = $('#order-price');
    if (priceNode) priceNode.textContent = priceLabel || '';
    var msg = 'Здравствуйте! Интересует услуга «' + service + '»' +
      (priceLabel ? ' за ' + priceLabel : '') + '.\n' +
      'Условия по этой услуге: https://ai-vibes.ru/oferta.html';
    $('#order-tg').href = 'https://t.me/lavr5000';
    $('#order-mail').href = 'mailto:lavr5000xxx@gmail.com?subject=' +
      encodeURIComponent('Заявка: ' + service) + '&body=' + encodeURIComponent(msg);
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('.modal-close', modal).focus();
  };
  var closeModal = function () {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  $$('[data-order]').forEach(function (b) {
    b.addEventListener('click', function () {
      openModal(b.getAttribute('data-order'), b.getAttribute('data-price-label'));
    });
  });
  if (modal) $$('[data-close]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });

  /* ---- 6. Живой терминал в герое: кадры из assets/hero-demo.js ----
     Плеер не стартует при prefers-reduced-motion и на узких экранах:
     там сразу показывается финальное состояние, без таймеров. */
  var term = document.getElementById('hero-term');
  var demo = window.HERO_DEMO;
  if (term && demo && demo.length) {
    var addLine = function (frame, text) {
      var el = document.createElement('div');
      el.className = 'term-line term-' + frame.t;
      if (frame.t === 'cmd') {
        var prompt = document.createElement('span');
        prompt.className = 'term-p';
        prompt.textContent = '$';
        el.appendChild(prompt);
      }
      var body = document.createElement('span');
      body.textContent = text;
      el.appendChild(body);
      term.appendChild(el);
      term.scrollTop = term.scrollHeight;
      return body;
    };

    var narrow = window.matchMedia('(max-width: 719px)').matches;
    if (reduce || narrow) {
      demo.forEach(function (f) { addLine(f, f.s); });
      term.scrollTop = term.scrollHeight;
    } else {
      var i = 0;
      var step = function () {
        if (i >= demo.length) return;
        var f = demo[i++];
        if (f.t !== 'cmd') { addLine(f, f.s); setTimeout(step, 110); return; }
        var span = addLine(f, ''), j = 0;
        var type = function () {
          span.textContent = f.s.slice(0, ++j);
          term.scrollTop = term.scrollHeight;
          if (j < f.s.length) setTimeout(type, 26);
          else setTimeout(step, 280);
        };
        type();
      };
      setTimeout(step, 550);
    }
  }

  /* ---- 7. Клавиатура: Esc закрывает, Tab не убегает из модалки ---- */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (modal && modal.classList.contains('is-open')) closeModal();
      else if (drawer && drawer.classList.contains('is-open')) setDrawer(false);
      return;
    }
    if (e.key !== 'Tab' || !modal || !modal.classList.contains('is-open')) return;
    var f = $$('a[href], button:not([disabled])', modal).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();
