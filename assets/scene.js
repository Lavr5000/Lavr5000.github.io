/* AI Vibes — сцена главной «из разбросанного — в порядок».
 * Листы летят в объёме по ходу прокрутки: разбросаны → слетаются к ноутбуку и телефону → ложатся в стопку.
 * Без GSAP, без скриптов и при «меньше движения» страница показывает итоговый кадр из CSS — здесь ничего не делается. */
(function () {
  'use strict';
  var scene = document.querySelector('[data-scene]');
  if (!scene || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  var space = scene.querySelector('.scene-space');
  var world = scene.querySelector('[data-scene-world]');
  var screen = scene.querySelector('.laptop-screen');
  var caps = Array.prototype.slice.call(scene.querySelectorAll('[data-scene-cap]'));
  var asks = Array.prototype.slice.call(scene.querySelectorAll('[data-ask]'));
  var all = Array.prototype.slice.call(scene.querySelectorAll('[data-sheet]'));
  var sheets = all.filter(function (el) { return getComputedStyle(el).display !== 'none'; });
  if (!space || !world || !sheets.length) return;

  /* разбросанное состояние: доли ширины/высоты пространства, глубина, повороты (по исходному номеру листа) */
  var SCATTER = [
    [-0.36, -0.30, -260, 18, -28, -14], [0.30, -0.34, -120, -14, 22, 9], [-0.06, -0.12, 60, 8, 14, -6],
    [0.38, 0.06, -320, -20, -18, 16], [-0.40, 0.14, -60, 12, 30, 7], [0.12, 0.26, 120, -10, -24, -11],
    [-0.20, 0.34, -200, 22, 12, 13], [0.26, -0.08, -40, -6, 26, -18], [0.02, -0.36, -380, 16, -10, 5]
  ];
  /* стопка: те же смещения, что в assets/site3.css для итогового кадра */
  var STACK = [
    [-28, 34, -80, -7], [-20, 28, -70, 5], [-14, 22, -60, -4], [-9, 16, -50, 3], [-5, 11, -40, -2],
    [-2, 7, -30, 2], [0, 4, -20, -1], [1, 2, -10, 1], [2, 0, 0, 0]
  ];
  var sx = function () { return parseFloat(getComputedStyle(space).getPropertyValue('--sx')) || 0; };
  var gather = function () {
    var s = space.getBoundingClientRect(), l = screen.getBoundingClientRect();
    return { x: l.left + l.width / 2 - (s.left + s.width / 2), y: l.top + l.height / 2 - (s.top + s.height / 2) };
  };

  document.documentElement.classList.add('scene-live');
  var headH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--c-head-h')) || 68;

  var setCap = function (n) { caps.forEach(function (c, i) { c.classList.toggle('is-on', i === n); }); };
  setCap(0);

  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: scene, start: 'top ' + headH + 'px', end: 'bottom bottom', scrub: 0.5, invalidateOnRefresh: true,
      onUpdate: function (st) { setCap(st.progress < 0.34 ? 0 : st.progress < 0.62 ? 1 : 2); }
    }
  });

  sheets.forEach(function (el) {
    var i = all.indexOf(el), sc = SCATTER[i], stt = STACK[i];
    if (el.classList.contains('sheet--done')) {
      /* готовый документ не лежит среди разбросанных: появляется из ноутбука в конце */
      tl.fromTo(el,
        { x: function () { return gather().x; }, y: function () { return gather().y; }, z: -140, rotationZ: 0, scale: 0.3, opacity: 0 },
        { x: function () { return sx() + stt[0]; }, y: stt[1], z: stt[2], rotationZ: stt[3], scale: 1, opacity: 1,
          duration: 0.36, ease: 'power2.out', immediateRender: true }, 0.6);
      return;
    }
    tl.fromTo(el,
      { x: function () { return sc[0] * space.clientWidth; }, y: function () { return sc[1] * space.clientHeight; }, z: sc[2],
        rotationX: sc[3], rotationY: sc[4], rotationZ: sc[5], scale: 1, opacity: 1 },
      { x: function () { return gather().x; }, y: function () { return gather().y; }, z: -140,
        rotationX: 0, rotationY: 0, rotationZ: sc[5] / 4, scale: 0.3, opacity: 0.85,
        duration: 0.42, ease: 'power1.inOut', immediateRender: true }, i * 0.006);
    tl.to(el,
      { x: function () { return sx() + stt[0]; }, y: stt[1], z: stt[2], rotationZ: stt[3], scale: 1, opacity: 1,
        duration: 0.38, ease: 'power2.out' }, 0.56 + i * 0.008);
  });
  asks.forEach(function (el, n) {
    tl.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.14, immediateRender: true }, 0.34 + n * 0.1);
  });
  tl.to({}, { duration: 0.04 });

  /* лёгкое покачивание всего пространства, чтобы сцена жила и без прокрутки */
  gsap.to(world, { y: 10, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 });
})();
