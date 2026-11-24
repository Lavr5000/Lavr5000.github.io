/* Drawer "kvartira" of the scroll scenes (assets/scene2.js) for /rieltor/: a photoreal empty flat furnishes itself
   while the section is scrolled and, at the end, the keys land on the table. The clip is a Veo 3.1 video (Google Flow,
   8 s) cut into 96 frames by gemini-media-contour/tasks/2026-11-24-kvartira-flow/build_frames.py:
   /assets/scene2/kvartira/p/NNN.webp (1280x720, desktop) and /t/NNN.webp (a crop around the sofa and the table, phone).
   Same engine as assets/scene2/house.js: P -> frame index (a short hold at both ends), two neighbour frames blended,
   frames load coarse to fine, the one nearest P jumps the queue, too many failed frames throw (poster fallback). */
(function (g) {
  'use strict';
  var BASE = '/assets/scene2/kvartira/', V = '?v=20261124-kv', N = 96, PAR = 6;
  var HOLD0 = 0.04, HOLD1 = 0.92;
  var STAGES = [[0.1, 'Пустая квартира'], [0.45, 'Расстановка мебели'], [0.72, 'Свет и уют'],
                [0.9, 'Готово к показу'], [2, 'Ключи на столе']];
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function tok(n, f) { return g.SceneGuard ? g.SceneGuard.tok(n, f) : f; }

  var sets = {};
  function order() {
    var seen = {}, out = [], st, i;
    for (st = 32; st >= 1; st = st / 2) {
      for (i = 0; i < N; i += st) if (!seen[i]) { seen[i] = 1; out.push(i); }
      if (!seen[N - 1]) { seen[N - 1] = 1; out.push(N - 1); }
    }
    return out;
  }
  function frames(key) {
    if (sets[key]) return sets[key];
    var s = { key: key, f: [], queue: order(), busy: 0, bad: 0, want: -1, shown: -1 };
    for (var i = 0; i < N; i++) s.f.push({ im: null, ok: false, bad: false, asked: false });
    sets[key] = s;
    return s;
  }
  function ask(s, i) {
    var it = s.f[i];
    if (it.asked) return;
    it.asked = true; s.busy++;
    var im = new Image();
    im.decoding = 'async';
    function done() {
      it.ok = true; s.busy--; pump(s);
      /* repaint only when this frame beats the one on screen: a loading storm must not paint 96 times */
      if (g.Scene2Repaint && (s.shown < 0 || Math.abs(i - s.want) < Math.abs(s.shown - s.want) || i === s.want + 1)) g.Scene2Repaint();
    }
    im.onload = function () { if (im.decode) im.decode().then(done, done); else done(); };
    im.onerror = function () { it.bad = true; s.bad++; s.busy--; pump(s); if (g.Scene2Repaint) g.Scene2Repaint(); };
    im.src = BASE + s.key + '/' + (i < 10 ? '00' : i < 100 ? '0' : '') + i + '.webp' + V;
    it.im = im;
  }
  function pump(s) {
    if (s.want >= 0) { ask(s, s.want); if (s.want + 1 < N) ask(s, s.want + 1); }
    while (s.busy < PAR && s.queue.length) ask(s, s.queue.shift());
  }
  function near(s, i) {
    for (var d = 0; d < N; d++) {
      if (i - d >= 0 && s.f[i - d].ok) return i - d;
      if (i + d < N && s.f[i + d].ok) return i + d;
    }
    return -1;
  }

  var soft = null;
  function fit(ctx, im, x, y, w, h) { ctx.drawImage(im, x, y, w, h); }

  function draw(ctx, W, H, P) {
    var ink = tok('--ink', ''), brass = tok('--brass', ink), paper = tok('--on-ink', ink);
    var phone = W < 768, s = frames(phone ? 't' : 'p');
    var t = cl((P - HOLD0) / (HOLD1 - HOLD0)), fx = t * (N - 1), i0 = Math.floor(fx), fr = fx - i0;
    s.want = i0; pump(s);
    if (s.bad > N / 10) throw new Error('scene2 kvartira: frames');
    ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
    var a = s.f[i0].ok ? i0 : near(s, i0);
    if (a < 0) return;
    s.shown = a;
    var b = (fr > 0.02 && i0 + 1 < N && s.f[i0 + 1].ok && a === i0) ? i0 + 1 : -1;
    var im = s.f[a].im, iw = im.naturalWidth, ih = im.naturalHeight, sc, ox, oy;
    if (phone) {
      /* a blurred, darkened cover of frame 0 behind (built once per screen size, so every P gets the same one), the sharp frame as a band */
      if (s.f[0].ok && (!soft || soft.width !== ctx.canvas.width || soft.height !== ctx.canvas.height)) {
        var tiny = g.document.createElement('canvas'); tiny.width = 36; tiny.height = 30;
        tiny.getContext('2d').drawImage(s.f[0].im, 0, 0, 36, 30);
        soft = g.document.createElement('canvas'); soft.width = ctx.canvas.width; soft.height = ctx.canvas.height;
        var sx = soft.getContext('2d'), k2 = Math.max(soft.width / 36, soft.height / 30);
        sx.drawImage(tiny, (soft.width - 36 * k2) / 2, (soft.height - 30 * k2) / 2, 36 * k2, 30 * k2);
        sx.globalAlpha = 0.35; sx.fillStyle = ink; sx.fillRect(0, 0, soft.width, soft.height); sx.globalAlpha = 1;
      }
      if (soft) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(soft, 0, 0); ctx.restore(); }
      b = -1;
      sc = W * 1.24 / iw; ox = (W - iw * sc) / 2 - W * 0.02; oy = H * 0.56 - ih * sc / 2;
    } else {
      sc = Math.max(W / iw, H / ih); ox = (W - iw * sc) / 2; oy = (H - ih * sc) / 2;
    }
    fit(ctx, im, ox, oy, iw * sc, ih * sc);
    if (b >= 0) { ctx.globalAlpha = fr; fit(ctx, s.f[b].im, ox, oy, iw * sc, ih * sc); ctx.globalAlpha = 1; }
    if (phone) { /* soften the band edges: stacked strips of ink, fading inwards */
      var top = oy, bot = oy + ih * sc, st;
      ctx.fillStyle = ink;
      for (st = 0; st < 9; st++) {
        ctx.globalAlpha = 0.05 * (9 - st);
        ctx.fillRect(0, top + st * 4, W, 4); ctx.fillRect(0, bot - st * 4 - 4, W, 4);
      }
      ctx.globalAlpha = 1;
    }
    var label = '', k;
    for (k = 0; k < STAGES.length; k++) if (t < STAGES[k][0]) { label = STAGES[k][1]; break; }
    ctx.font = (phone ? '12px' : '13px') + ' "JetBrains Mono",ui-monospace,monospace';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
    var lx = W - (phone ? 12 : 28), ly = H - (phone ? 14 : 24), lw = ctx.measureText(label).width + 20;
    ctx.globalAlpha = 0.6; ctx.fillStyle = ink; ctx.fillRect(lx - lw + 10, ly - 16, lw, 24);
    ctx.globalAlpha = 0.92; ctx.fillStyle = paper; ctx.fillText(label, lx, ly); ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.fillStyle = brass; ctx.fillRect(0, H - 3, W * cl(P), 3);
  }

  g.Scene2Draw = g.Scene2Draw || {};
  g.Scene2Draw.kvartira = draw;
})(window);
