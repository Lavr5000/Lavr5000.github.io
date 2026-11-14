/* Scroll scenes of the section pages (/products.html "crane", /rieltor/ "deal").
   Markup: section.scene2[data-scene2="<name>"] > .scene2-stage[data-scene2-stage] (sticky, one screen high) holding
   canvas[data-scene2-canvas] and picture > img[data-scene2-poster] (the final frame); the first screen and the
   captions [data-scene2-cap] scroll over the stage in the normal flow. The drawer is Scene2Draw[<name>](ctx, W, H,
   P, dpr). P = the share of the section scrolled; the canvas is repainted only while the section is on screen and P
   changes. Without scripts, with reduced motion, after a failure or on a device that cannot keep up
   (SceneGuard.watch) the scene shows the poster. `?scene-test=1`: no frame loop, window.__scene2.go(P) paints P
   at once (gate and posters). A drawer that loads pictures calls window.Scene2Repaint() when they arrive. */
(function (w, d) {
  'use strict';
  var root = d.documentElement;
  var test = /[?&]scene-test=1(?:&|$)/.test(location.search);
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes = [];

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function Scene(sec) {
    var name = sec.getAttribute('data-scene2'), draw = (w.Scene2Draw || {})[name];
    var stage = sec.querySelector('[data-scene2-stage]'), cv = sec.querySelector('canvas[data-scene2-canvas]');
    if (!draw || !stage || !cv || !cv.getContext) { sec.classList.add('is-plain'); return null; }
    var cx = cv.getContext('2d', { alpha: false });
    var guard = w.SceneGuard ? w.SceneGuard.watch(name, false) : null;
    var s = { name: name, sec: sec, P: 0, target: 0, drawn: -1, W: 0, H: 0, D: 1, raf: 0, on: false, dead: false };

    function size() {
      var Wc = stage.clientWidth, Hc = stage.clientHeight;
      if (!Wc || !Hc) return false;
      /* a phone hides and shows its address bar: a change of height alone keeps the buffer */
      if (Wc === s.W && Math.abs(Hc - s.H) < 140) return true;
      s.W = Wc; s.H = Hc; s.D = Math.min(w.devicePixelRatio || 1, 2);
      cv.width = Math.round(Wc * s.D); cv.height = Math.round(Hc * s.D);
      s.drawn = -1;
      return true;
    }
    function paint(P) {
      cx.setTransform(s.D, 0, 0, s.D, 0, 0);
      draw(cx, s.W, s.H, P, s.D);
      s.drawn = P;
    }
    function travel() {
      var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - stage.clientHeight);
      return clamp(-r.top / span);
    }
    function stop(why) {
      if (s.dead) return;
      s.dead = true;
      if (s.raf) { cancelAnimationFrame(s.raf); s.raf = 0; }
      sec.classList.add('is-plain');
      if (why === 'slow' && guard) guard.leave(s.P);
      if (!scenes.some(function (x) { return !x.dead; })) root.classList.remove('scene2-live');
    }
    function frame(now) {
      s.raf = 0;
      if (s.dead || !s.on) return;
      try {
        if (guard && guard.frame(now, w.scrollY)) { stop('slow'); return; }
        s.target = travel();
        s.P += (s.target - s.P) * 0.14;
        if (Math.abs(s.target - s.P) < 0.0005) s.P = s.target;
        if (s.P !== s.drawn) paint(s.P);
      } catch (e) { stop('fail'); return; }
      if (s.P !== s.target) s.raf = requestAnimationFrame(frame);
      else if (guard) guard.rest();
    }
    s.kick = function () { if (!s.dead && s.on && !s.raf && !d.hidden) s.raf = requestAnimationFrame(frame); };
    /* test mode: the page stays at the top, the flow is shifted by the share P - the frame a visitor sees at P */
    s.go = function (P) {
      P = clamp(+P || 0);
      var flow = sec.querySelector('.scene2-flow');
      if (flow) flow.style.setProperty('--scene2-shift', -Math.round(P * Math.max(0, sec.offsetHeight - stage.clientHeight)) + 'px');
      s.at = P; size(); paint(P); return s.drawn;
    };
    /* a drawer whose pictures arrive later (photo chapters) asks for the current frame again */
    s.repaint = function () {
      if (s.dead) return;
      if (test) { if (s.at != null) paint(s.at); return; }
      s.drawn = -1; if (s.on) { if (s.W) { try { paint(s.P); } catch (e) { stop('fail'); } } s.kick(); }
    };
    s.start = function () {
      if (guard && guard.plain) { stop('remembered'); return false; }
      if (!size()) { stop('fail'); return false; }
      try { s.P = s.target = travel(); paint(s.P); } catch (e) { stop('fail'); return false; }
      if (w.IntersectionObserver) {
        new IntersectionObserver(function (es) { s.on = es[es.length - 1].isIntersecting; if (s.on) s.kick(); else if (guard) guard.rest(); }).observe(sec);
      } else s.on = true;
      return true;
    };
    s.resize = function () { if (!s.dead && size()) { paint(s.P); s.kick(); } };
    return s;
  }

  w.Scene2Repaint = function () { for (var i = 0; i < scenes.length; i++) scenes[i].repaint(); };

  function init() {
    var list = d.querySelectorAll('section[data-scene2]');
    for (var i = 0; i < list.length; i++) {
      if (reduce && !test) { list[i].classList.add('is-plain'); continue; }
      var s = Scene(list[i]);
      if (s) scenes.push(s);
    }
    if (!scenes.length) return;
    if (test) {
      root.classList.add('scene2-test');
      w.__scene2 = { go: function (P, name) {
        var s = scenes.filter(function (x) { return !name || x.name === name; })[0];
        return s ? s.go(P) : -1;
      } };
      scenes[0].go(0);
      return;
    }
    scenes = scenes.filter(function (s) { return s.start(); });
    if (!scenes.length) return;
    root.classList.add('scene2-live');
    w.addEventListener('scroll', function () { for (var i = 0; i < scenes.length; i++) scenes[i].kick(); }, { passive: true });
    var rt = 0;
    w.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { scenes.forEach(function (s) { s.resize(); }); }, 120); });
    d.addEventListener('visibilitychange', function () { scenes.forEach(function (s) { s.kick(); }); });
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init); else init();
})(window, document);
