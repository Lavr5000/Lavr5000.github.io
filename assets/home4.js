/* Главная: закреплённая кнопка «Выбрать тариф» на телефоне прячется, пока на экране тарифы,
   плитки первого экрана или контакты; мягкое появление блоков при прокрутке.
   Без скрипта кнопка не показывается (класс is-off снимается только здесь); содержимое страницы видно всегда:
   анимация запускается у блока, который ещё ниже экрана, и только доводит его до обычного вида. */
(function () {
  'use strict';
  if (!('IntersectionObserver' in window)) return;
  var bar = document.querySelector('[data-mcta]');
  if (bar) {
    var seen = new Set();
    var watch = ['#tarify', '#contact', '[data-hero-tariffs]']
      .map(function (s) { return document.querySelector(s); })
      .filter(Boolean);
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
      bar.classList.toggle('is-off', seen.size > 0);
    });
    watch.forEach(function (el) { io.observe(el); });
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items = document.querySelectorAll('main > .band .head, main .tariff, main .step, main .note-card, main .cmp-wrap');
  var vh = window.innerHeight;
  var ro = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      ro.unobserve(e.target);
      e.target.classList.add('h4-rise');
    });
  }, { rootMargin: '0px 0px 12% 0px' });
  Array.prototype.forEach.call(items, function (el) {
    if (el.getBoundingClientRect().top > vh * 1.12) ro.observe(el);
  });
})();
