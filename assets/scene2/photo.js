/* Photo chapters of the scroll scenes (drawer for assets/scene2.js): /products.html "crane" (pit -> frame ->
   facade -> the building handed over) and /rieltor/ "deal" (hundreds of lights -> one window -> keys on the sill).
   P is split into equal chapters; inside a chapter the photo slowly pulls back (zoom ZOOM -> 1), and the next
   chapter cross-fades in over FADE of P. Files: /assets/scene2/<frame>_pc.webp (1440x900) for wide screens and
   <frame>_tel.webp (600x1300, cropped around the subject) below 768 px, the same switch as the poster <picture>.
   The last chapter at P = 1 is what scripts/build_scene_posters.py saves as the poster <name>_{pc,tel}.webp. Deterministic: the same P gives the same frame (test mode, posters).
   An image that fails to load throws, so the engine falls back to the poster. */
(function (g, d) {
  'use strict';
  var BASE = '/assets/scene2/';
  var V = '?v=20261114-ph';
  /* the chapters run over the first END of P, so the last photo is in place while its caption is on screen */
  var ZOOM = 1.07, FADE = 0.1, END = 0.85;
  var SCENES = {
    crane: ['crane_1', 'crane_2', 'crane_3', 'crane_4'],
    deal: ['deal_1', 'deal_2', 'deal_3']
  };
  var cache = {};

  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sm(v) { v = cl(v); return v * v * (3 - 2 * v); }

  function images(name, tel) {
    var key = name + (tel ? ':tel' : ':pc');
    if (cache[key]) return cache[key];
    var set = SCENES[name].map(function (f) {
      var im = new Image();
      im.decoding = 'async';
      var it = { im: im, ok: false, bad: false };
      im.onload = function () { it.ok = true; if (g.Scene2Repaint) g.Scene2Repaint(); };
      im.onerror = function () { it.bad = true; if (g.Scene2Repaint) g.Scene2Repaint(); };
      im.src = BASE + f + (tel ? '_tel' : '_pc') + '.webp' + V;
      return it;
    });
    cache[key] = set;
    return set;
  }

  function cover(ctx, im, W, H, z, a) {
    var iw = im.naturalWidth, ih = im.naturalHeight;
    var s = Math.max(W / iw, H / ih) * z, dw = iw * s, dh = ih * s;
    ctx.globalAlpha = a;
    ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.globalAlpha = 1;
  }

  var ink = '';
  function make(name) {
    return function (ctx, W, H, P) {
      var set = images(name, W < 768), n = set.length;
      if (!ink) ink = getComputedStyle(d.documentElement).getPropertyValue('--ink').trim() || ctx.fillStyle;
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, W, H);
      for (var j = 0; j < n; j++) if (set[j].bad) throw new Error('scene2 photo: ' + SCENES[name][j]);
      var x = cl(P / END) * n, i = Math.min(n - 1, Math.floor(x)), local = x - i;
      if (P >= END) { i = n - 1; local = 1; }
      var cur = set[i];
      if (cur.ok) cover(ctx, cur.im, W, H, 1 + (ZOOM - 1) * (1 - sm(local)), 1);
      /* the next chapter fades in over the last FADE*n of this one */
      var k = n * FADE, nx = set[i + 1];
      if (nx && nx.ok && local > 1 - k) cover(ctx, nx.im, W, H, ZOOM, sm((local - (1 - k)) / k));
    };
  }

  g.Scene2Draw = g.Scene2Draw || {};
  for (var nm in SCENES) if (Object.prototype.hasOwnProperty.call(SCENES, nm)) g.Scene2Draw[nm] = make(nm);
})(window, document);
