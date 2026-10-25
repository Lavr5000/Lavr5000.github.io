/* AI Vibes — общая шапка: меню телефона и полоса хода чтения. Без зависимостей. */
(function () {
  'use strict';
  var toggle = document.querySelector('[data-menu-toggle]');
  var panel = document.querySelector('[data-menu-panel]');
  if (toggle && panel) {
    var setOpen = function (open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    };
    toggle.addEventListener('click', function () { setOpen(panel.hidden); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) { setOpen(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1000 && !panel.hidden) setOpen(false); });
  }

  var bar = document.querySelector('[data-progress]');
  if (bar) {
    var ticking = false;
    var draw = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(draw); }
    }, { passive: true });
    draw();
  }

  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-dlg-close]');
    if (close) { var d = close.closest('dialog'); if (d) d.close(); return; }
    if (e.target instanceof HTMLDialogElement && e.target.classList.contains('dlg')) {
      var r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
    }
  });
})();
