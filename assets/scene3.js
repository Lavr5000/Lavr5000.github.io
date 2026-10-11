/* Home-page scene "City and bridge". A stage pinned under the header for the length of the travel. One opaque
   canvas holds everything: the "before" picture, the "after" picture through a soft mask that follows a spark,
   and the spark itself; scrolling moves the spark along a route laid over the bridge. The first screen and three
   captions take turns on the stage. The blend of the two pictures is kept in an off-screen canvas and only the
   rectangle where the mask has changed is recomposed; a repaint is cut into three steps and a slow device spreads
   them over several frames, so no single frame is long. The canvas is repainted only when the travel changes, at
   rest the frame loop is stopped. Without scripts, with reduced motion, in a window too low for the stage or after
   a failure the page is a plain static section. */
(function () {
  'use strict';
  var root = document.documentElement;
  var run = document.querySelector('section[data-scene]');
  if (!run) return;
  var stage = run.querySelector('[data-scene-stage]'), bg = run.querySelector('[data-scene-bg]');
  if (!stage || !bg) return;
  var base = bg.querySelector('[data-scene-base]'), cv = bg.querySelector('canvas[data-scene-canvas]');
  if (!base || !cv || !cv.getContext) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* routes in picture coordinates (0..1), mapped through the same "cover" fit as the pictures */
  var ROUTES = {
    pc: [[0.95, 0.16], [0.8, 0.22], [0.62, 0.38], [0.5, 0.48], [0.4, 0.58], [0.27, 0.72], [0.12, 0.85], [0.3, 0.9], [0.52, 0.83], [0.7, 0.66], [0.86, 0.5]],
    tel: [[0.86, 0.31], [0.76, 0.355], [0.66, 0.41], [0.57, 0.465], [0.47, 0.535], [0.38, 0.6], [0.29, 0.675], [0.2, 0.735], [0.14, 0.83], [0.3, 0.9], [0.5, 0.84], [0.66, 0.74], [0.8, 0.63]]
  };
  /* travel windows [fade in from, to, fade out from, to] of the first screen and the three captions */
  var WIN = [[-1, 0, 0.06, 0.13], [0.15, 0.2, 0.36, 0.41], [0.43, 0.48, 0.64, 0.69], [0.71, 0.76, 2, 3]];
  var BLOBS = 46, SETTLE = 0.075, BUDGET = 2400000, SLICE = 4, STRIP = 200000;
  var lite = bg.getAttribute('data-scene-mode') === 'lite';
  var hero = stage.querySelector('.hero');
  var caps = Array.prototype.slice.call(stage.querySelectorAll('[data-scene-cap]'));
  var blocks = (hero ? [hero] : []).concat(caps);
  var cx = cv.getContext('2d', { alpha: false });
  var mask = document.createElement('canvas'), mx = mask.getContext('2d');
  var tmp = document.createElement('canvas'), tx = tmp.getContext('2d');
  var bufB = document.createElement('canvas'), bufA = document.createElement('canvas');
  var mix = document.createElement('canvas'), mc = mix.getContext('2d', { alpha: false });   /* "before" + masked "after", no spark */
  var after = new Image(), before = null;      /* `before` is loaded only if the base picture no longer shows it */
  var W = 0, H = 0, VH = 0, D = 1, K = 5, mixP = -1, wasAll = 1, sparkBox = null, fit = null, route = ROUTES.pc, span = 1, runTop = 0;
  var P = 0, Q = 0, step = 0, dirty = null, stripY = 0, target = 0, drawnP = -1, raf = 0, ready = false, first = true, live = false, tall = null;
  var S = window.__sceneState = { p: 0, target: 0, spark: null, frames: 0, paints: 0, rebuilds: 0, ready: false, failed: false, live: false, scale: 0, lite: lite };

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { v = clamp(v); return v * v * (3 - 2 * v); }
  /* a cropped picture must not take the spark off the stage: the point is kept inside with a margin */
  function keepInside(x, y) {
    var mgx = W * 0.05, mgy = VH * 0.05;
    return [Math.min(W - mgx, Math.max(mgx, x)), Math.min(VH - mgy, Math.max(mgy, y))];
  }
  function point(u) {
    var r = route, f = clamp(u) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f)), k = f - i;
    var a = r[Math.max(0, i - 1)], b = r[i], c = r[i + 1], d = r[Math.min(r.length - 1, i + 2)];
    function cr(n) { return 0.5 * ((2 * b[n]) + (-a[n] + c[n]) * k + (2 * a[n] - 5 * b[n] + 4 * c[n] - d[n]) * k * k + (-a[n] + 3 * b[n] - 3 * c[n] + d[n]) * k * k * k); }
    return keepInside(fit.x + cr(0) * fit.w, fit.y + cr(1) * fit.h);
  }

  /* device-pixel box around the route points of travel a..b, grown by `pad` CSS px, snapped to the mask grid */
  function box(a, b, pad) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, n = Math.max(1, Math.ceil((b - a) * BLOBS * 2)), i, p;
    for (i = 0; i <= n; i++) {
      p = point(a + (b - a) * i / n);
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    x0 = Math.max(0, Math.floor((x0 - pad) * D / K) * K); y0 = Math.max(0, Math.floor((y0 - pad) * D / K) * K);
    x1 = Math.min(cv.width, Math.ceil((x1 + pad) * D / K) * K); y1 = Math.min(cv.height, Math.ceil((y1 + pad) * D / K) * K);
    return [x0, y0, x1 - x0, y1 - y0];
  }
  function plainFrame() { return lite || Q >= 0.9995; }     /* no mask is needed for this frame */
  /* step 1: the mask for the travel Q; only the blobs that have changed since the last blend are redrawn */
  function paintMask() {
    dirty = null;
    if (plainFrame()) return;
    var R = 0.2 * Math.max(W, H), r0 = mixP < 0 ? [0, 0, cv.width, cv.height]
      : box(Math.max(0, Math.min(mixP, Q) - SETTLE - 1 / BLOBS), Math.max(mixP, Q), R + 2);
    if (r0[2] <= 0 || r0[3] <= 0) return;
    var x0 = r0[0] / K - 1, y0 = r0[1] / K - 1, x1 = x0 + r0[2] / K + 2, y1 = y0 + r0[3] / K + 2, n = Math.ceil(Q * BLOBS), i;
    mx.save(); mx.beginPath(); mx.rect(x0, y0, x1 - x0, y1 - y0); mx.clip();
    mx.clearRect(x0, y0, x1 - x0, y1 - y0);
    for (i = 0; i <= n; i++) {
      var u = Math.min(Q, i / BLOBS), p = point(u), age = ease((Q - u) / 0.1 + 0.25);
      var gx = p[0] * D / K, gy = p[1] * D / K, r = R * D / K * (0.35 + 0.65 * age);
      if (gx + r < x0 || gx - r > x1 || gy + r < y0 || gy - r > y1) continue;
      var g = mx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.5 + 0.5 * age) + ')');
      g.addColorStop(0.55, 'rgba(255,255,255,' + 0.35 * age + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      mx.fillStyle = g; mx.fillRect(gx - r, gy - r, r * 2, r * 2);
    }
    mx.restore();
    dirty = r0; stripY = r0[1];
  }
  /* step 2: "after" through the mask over "before", inside the changed box, into the off-screen blend;
     a large box is done strip by strip, one call per strip; returns true when the box is finished */
  function paintBlend() {
    if (plainFrame() || !dirty) { mixP = Q; return true; }
    var x = dirty[0], w = dirty[2], end = dirty[1] + dirty[3], y = stripY;
    var h = Math.min(end - y, Math.max(8 * K, Math.floor(STRIP / w / K) * K));
    tx.save(); tx.beginPath(); tx.rect(x, y, w, h); tx.clip();
    tx.clearRect(x, y, w, h);
    tx.imageSmoothingEnabled = true;
    /* one mask cell more on every side, so that the scaled edge inside the strip does not depend on the strip */
    tx.drawImage(mask, x / K - 1, y / K - 1, w / K + 2, h / K + 2, x - K, y - K, w + 2 * K, h + 2 * K);
    tx.globalCompositeOperation = 'source-in';
    tx.drawImage(bufA, x, y, w, h, x, y, w, h);
    tx.restore();
    mc.drawImage(bufB, x, y, w, h, x, y, w, h);
    mc.drawImage(tmp, x, y, w, h, x, y, w, h);
    stripY = y + h;
    if (stripY < end) return false;
    mixP = Q;
    return true;
  }
  /* step 3: the visible canvas */
  function paintPictures() {
    var all = ease((Q - 0.86) / 0.14), r0 = dirty, q = sparkBox;
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    if (Q >= 0.9995) { cx.drawImage(bufA, 0, 0); wasAll = 1; return; }
    if (lite) { cx.drawImage(bufB, 0, 0); cx.globalAlpha = ease((Q - 0.03) / 0.9); cx.drawImage(bufA, 0, 0); cx.globalAlpha = 1; return; }
    if (all > 0 || wasAll > 0 || drawnP < 0) {          /* the final fade of the rest (and the first frame) take the whole canvas */
      cx.drawImage(mix, 0, 0);
      if (all > 0) { cx.globalAlpha = all; cx.drawImage(bufA, 0, 0); cx.globalAlpha = 1; }
    } else {
      if (r0) cx.drawImage(mix, r0[0], r0[1], r0[2], r0[3], r0[0], r0[1], r0[2], r0[3]);
      if (q) cx.drawImage(mix, q[0], q[1], q[2], q[3], q[0], q[1], q[2], q[3]);      /* wipe the previous spark */
    }
    wasAll = all;
  }

  function paintSpark() {
    var i;
    S.spark = null; sparkBox = null;
    if (Q >= 0.995) return;
    cx.setTransform(D, 0, 0, D, 0, 0);
    var sp = point(Q), hr = 170;
    cx.lineCap = 'butt'; cx.globalCompositeOperation = 'lighter';
    for (i = 90; i >= 1; i--) {
      var u1 = Q - i * 0.0016, u2 = Q - (i - 1) * 0.0016 + 0.0003; if (u1 < 0) continue;
      var p1 = point(u1), p2 = point(u2), f = 1 - i / 90;
      cx.strokeStyle = 'rgba(255,' + Math.round(196 + 44 * f) + ',' + Math.round(120 + 110 * f) + ',' + 0.7 * f * f + ')';
      cx.lineWidth = 1 + 9 * f; cx.beginPath(); cx.moveTo(p1[0], p1[1]); cx.lineTo(p2[0], p2[1]); cx.stroke();
    }
    var halo = cx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], hr);
    halo.addColorStop(0, 'rgba(255,252,240,1)'); halo.addColorStop(0.06, 'rgba(255,226,160,0.8)');
    halo.addColorStop(0.3, 'rgba(255,190,110,0.2)'); halo.addColorStop(1, 'rgba(255,190,110,0)');
    cx.fillStyle = halo; cx.beginPath(); cx.arc(sp[0], sp[1], hr, 0, 6.2832); cx.fill();
    cx.strokeStyle = 'rgba(255,250,235,0.85)'; cx.lineWidth = 1.3;
    cx.beginPath(); cx.moveTo(sp[0] - 26, sp[1]); cx.lineTo(sp[0] + 26, sp[1]);
    cx.moveTo(sp[0], sp[1] - 39); cx.lineTo(sp[0], sp[1] + 39); cx.stroke();
    for (i = 0; i < 14; i++) { /* small sparks falling behind; their phase follows the travel, so they move only with it */
      var a = (Q * 40 + i / 14) % 1, back = point(Math.max(0, Q - a * 0.05));
      cx.fillStyle = 'rgba(255,230,170,' + (1 - a) * 0.9 + ')';
      cx.beginPath(); cx.arc(back[0] + Math.sin(i * 7.3) * 26 * a, back[1] + Math.cos(i * 3.1) * 26 * a, 1.6 * (1 - a) + 0.4, 0, 6.2832); cx.fill();
    }
    cx.globalCompositeOperation = 'source-over';
    cx.setTransform(1, 0, 0, 1, 0, 0);
    sparkBox = box(Math.max(0, Q - 0.15), Q, 200);
    S.spark = [sp[0], sp[1]];
  }

  function show(el, w) {
    var o = P < w[1] ? ease((P - w[0]) / (w[1] - w[0])) : 1 - ease((P - w[2]) / (w[3] - w[2]));
    el.style.opacity = o.toFixed(3);
    el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    el.style.transform = o > 0.999 ? 'none' : 'translate3d(0,' + ((1 - o) * (P < w[1] ? 18 : -18)).toFixed(1) + 'px,0)';
  }
  function texts() { for (var i = 0; i < blocks.length && i < 4; i++) show(blocks[i], WIN[hero ? i : i + 1]); }
  function plain() { for (var i = 0; i < blocks.length; i++) blocks[i].removeAttribute('style'); }

  /* the static page: no pinning, no canvas; the picture is "after" only if that file is really loaded */
  function still() {
    live = S.live = false; ready = S.ready = false;
    root.classList.remove('scene-live');
    plain();
    base.style.visibility = '';
    if (after.complete && after.naturalWidth && (base.currentSrc || base.src) !== after.src) {
      var pic = base.parentNode;
      if (pic && pic.tagName === 'PICTURE') while (pic.firstChild !== base) pic.removeChild(pic.firstChild);
      base.removeAttribute('srcset'); base.src = after.src;
    }
  }
  function fail() {
    if (S.failed) return;
    S.failed = true; root.classList.add('scene-failed');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    still();
  }

  function frame() {
    raf = 0;
    if (!ready) return;
    try {
      S.frames++;
      target = 0.03 + 0.97 * clamp((window.scrollY - runTop) / span);
      if (first) { P = target; first = false; }         /* a page opened in the middle starts in its own state */
      P += (target - P) * 0.14;
      if (Math.abs(target - P) < 0.0004) P = target;
      texts();
      /* a repaint is a chain of short steps; a slow device does one step per frame, a fast one all of them at once */
      var t0 = performance.now();
      for (;;) {
        if (step === 0) { if (P === drawnP) break; Q = P; paintMask(); step = 1; }
        else if (step === 1) { if (paintBlend()) step = 2; }
        else {
          paintPictures(); paintSpark();
          if (drawnP < 0) { cv.style.visibility = 'visible'; base.style.visibility = 'hidden'; }   /* nothing left to blend under the opaque canvas */
          drawnP = Q; S.p = Q; S.target = target; S.paints++; step = 0;
        }
        if (performance.now() - t0 > SLICE) break;
      }
    } catch (e) { fail(); return; }
    if (P !== target || P !== drawnP || step) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && ready && !document.hidden) raf = requestAnimationFrame(frame); }

  var RESERVE = 0;     /* CSS px by which the background is taller than the stage (--scene-reserve, narrow screens) */
  function measure() {
    var rr = run.getBoundingClientRect();
    RESERVE = parseFloat(getComputedStyle(bg).getPropertyValue('--scene-reserve')) || 0;
    runTop = rr.top + window.scrollY - (parseFloat(getComputedStyle(stage).top) || 0);
    span = Math.max(1, rr.height - stage.offsetHeight);
    VH = stage.clientHeight;
  }
  /* motion is switched on only if the first screen and every caption fit into the stage */
  function fits() {
    var s = stage.getBoundingClientRect(), i, r;
    for (i = 0; i < blocks.length; i++) {
      blocks[i].style.transform = 'none';
      r = blocks[i].getBoundingClientRect();
      if (r.top < s.top - 1 || r.bottom > s.bottom + 1) return false;
    }
    return true;
  }
  function names() {
    var cur = base.currentSrc || base.src, isTall = window.matchMedia('(max-aspect-ratio: 5/6)').matches;
    var m = /^(.*gorodmost_)(before|after)_(pc|tel)(\.\w+)(\?.*)?$/.exec(cur);
    if (!m) return null;
    var tail = '_' + (isTall ? 'tel' : 'pc') + m[4] + (m[5] || '');
    return { before: m[1] + 'before' + tail, after: m[1] + 'after' + tail, tall: isTall, cur: cur };
  }
  function layout(n, srcB) {
    try {
      root.classList.add('scene-live');
      if (!fits()) { still(); return; }
      var w = bg.clientWidth, h = bg.clientHeight, nw = srcB.naturalWidth, nh = srcB.naturalHeight;
      if (!w || !h || !nw) { still(); return; }
      live = S.live = true;
      measure();
      /* a phone hides and shows its address bar: a small change of height at the same width keeps the buffers
         (the background is taller than the stage by a reserve, the canvas keeps its size in pixels) */
      if (w === W && ready && n.tall === tall && (h === H || (RESERVE && Math.abs(h - H) <= RESERVE - 10))) { drawnP = -2; texts(); kick(); return; }
      W = w; H = h; tall = n.tall; cv.style.height = RESERVE ? H + 'px' : ''; route = tall ? ROUTES.tel : ROUTES.pc;
      D = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(BUDGET / (W * H)));
      var k = Math.max(W / nw, H / nh), cw = Math.max(2, Math.round(W * D)), ch = Math.max(2, Math.round(H * D));
      fit = { w: nw * k, h: nh * k, x: (W - nw * k) / 2, y: (H - nh * k) / 2 };
      var pair = [[bufB, srcB], [bufA, after]];
      for (var i = 0; i < 2; i++) {
        var b = pair[i][0], c = b.getContext('2d', { alpha: false });
        b.width = cw; b.height = ch;
        c.imageSmoothingQuality = 'high';
        c.drawImage(pair[i][1], fit.x * D, fit.y * D, fit.w * D, fit.h * D);
      }
      tmp.width = mix.width = cw; tmp.height = mix.height = ch;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      K = Math.max(2, Math.round(5 * D));
      mask.width = Math.ceil(cw / K) + 2; mask.height = Math.ceil(ch / K) + 2;
      S.scale = cw / W; drawnP = -1; mixP = -1; wasAll = 1; sparkBox = null; step = 0; dirty = null;
      S.rebuilds++; S.ready = ready = true;
      kick();
    } catch (e) { fail(); }
  }
  function source() {
    if (S.failed) return;
    var n = names();
    if (!n || !base.naturalWidth) return;
    var pending = 2, srcB = base;
    function done() { if (--pending === 0 && !S.failed) layout(n, srcB); }
    if (n.cur !== n.before) {                       /* the base picture shows "after" (static page): take "before" apart */
      if (!before) before = new Image();
      srcB = before;
      if (before.getAttribute('data-src') === n.before && before.complete && before.naturalWidth) pending--;
      else { before.setAttribute('data-src', n.before); before.onload = done; before.onerror = fail; before.src = n.before; }
    } else pending--;
    if (after.getAttribute('data-src') === n.after && after.complete && after.naturalWidth) pending--;
    else { S.ready = ready = false; after.setAttribute('data-src', n.after); after.onload = done; after.onerror = fail; after.src = n.after; }
    if (pending === 0) layout(n, srcB);
  }

  cv.style.visibility = 'hidden';
  root.classList.add('scene-live');
  if (base.complete && base.naturalWidth) source();
  base.addEventListener('load', source);
  base.addEventListener('error', fail);
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(source, 150); });
  window.addEventListener('load', function () { if (ready) { measure(); kick(); } });
  window.addEventListener('scroll', kick, { passive: true });
  document.addEventListener('visibilitychange', kick);
})();
