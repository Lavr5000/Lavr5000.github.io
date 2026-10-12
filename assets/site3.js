/* AI Vibes — site3: мелкое движение страниц. Без зависимостей. */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduce || !hover) return;

  /* карточки тарифов слегка наклоняются за курсором */
  Array.prototype.forEach.call(document.querySelectorAll('.tariff'), function (card) {
    var raf = 0;
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        card.style.transform = 'perspective(1100px) rotateY(' + (px * 4).toFixed(2) + 'deg) rotateX(' + (-py * 3).toFixed(2) + 'deg)';
      });
    });
    card.addEventListener('pointerleave', function () { cancelAnimationFrame(raf); card.style.transform = ''; });
  });
})();
