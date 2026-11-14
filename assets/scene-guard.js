/* Shared helpers of the scroll scenes (assets/scene2.js and its drawers).
   SceneGuard.watch(name, lite) - smoothness watchdog of one scene: gaps between frames longer than GAP ms while the
     page is being scrolled are counted, a calm stretch forgives one, SLOW of them switch the scene to the plain page
     (the caller shows the poster). The tab remembers that per scene and mode: key `scene-plain:<name>:<lite|full>`.
     Leaving the scene fires the document event `scene:plain` (counted by metrika.js).
   SceneGuard.tok(name, fallback) - a design token (CSS custom property on :root) as a string, for canvas drawers. */
(function (w, d) {
  'use strict';
  var GAP = 50, SLOW = 8, CALM = 60;
  var cs = null, toks = {};

  function tok(name, fallback) {
    if (toks[name]) return toks[name];
    try { cs = cs || getComputedStyle(d.documentElement); } catch (e) { cs = null; }
    var v = cs ? cs.getPropertyValue(name).trim() : '';
    return (toks[name] = v || fallback);
  }

  function watch(name, lite) {
    var key = 'scene-plain:' + name + ':' + (lite ? 'lite' : 'full');
    var g = { slow: 0, maxGap: 0, calm: 0, lastT: 0, lastY: 0, plain: false, key: key };
    try { g.plain = w.sessionStorage.getItem(key) === '1'; } catch (e) { /* storage is closed */ }
    /* one frame: returns true when the scene must go plain now */
    g.frame = function (now, y) {
      if (g.plain) return true;
      if (g.lastT && y !== g.lastY) {
        var gap = now - g.lastT;
        if (gap > g.maxGap) g.maxGap = gap;
        if (gap > GAP) { g.slow++; g.calm = 0; }
        else if (++g.calm >= CALM) { g.calm = 0; if (g.slow) g.slow--; }
      }
      g.lastT = now; g.lastY = y;
      return g.slow >= SLOW;
    };
    g.rest = function () { g.lastT = 0; };
    g.leave = function (at) {
      if (g.plain) return;
      g.plain = true;
      try { w.sessionStorage.setItem(key, '1'); } catch (e) { /* the next page tries again */ }
      try { d.dispatchEvent(new CustomEvent('scene:plain', { detail: { scene: name, at: at, gap: Math.round(g.maxGap) } })); } catch (e) { /* no listener */ }
    };
    return g;
  }

  w.SceneGuard = { watch: watch, tok: tok };
})(window, document);
