/* Sketch 1 "spark over the city": a fixed canvas behind the page. Scroll moves a spark along a path;
   every element of the scene switches from "before" to "after" once the spark has passed near it. */
(function () {
  'use strict';
  var cv = document.querySelector('[data-iskra]');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, D = 1, S = null, P = 0, shown = -1, raf = 0, t0 = performance.now();

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { v = clamp(v); return v * v * (3 - 2 * v); }
  function mix(a, b, k) { return a + (b - a) * k; }
  function rgb(a, b, k, al) {
    return 'rgba(' + Math.round(mix(a[0], b[0], k)) + ',' + Math.round(mix(a[1], b[1], k)) + ',' + Math.round(mix(a[2], b[2], k)) + ',' + al + ')';
  }
  /* spark position for path parameter u, in pixels */
  function path(u) { return [W * (0.5 + 0.36 * Math.sin(u * Math.PI * 3.2 + 0.7)), H * (0.05 + 0.93 * u)]; }

  function build() {
    var r = rng(20261011), i, j;
    var s = { stars: [], links: [], b: [], scr: [], arcs: [], cars: [] };
    var horizon = H * 0.56;
    for (i = 0; i < Math.round(W / 11); i++) s.stars.push({ x: r() * W, y: r() * horizon * 0.95, m: 0.4 + r() * 1.3, tw: r() * 6.28 });
    /* three rows of buildings, far to near */
    for (var L = 0; L < 3; L++) {
      var x = -20, base = H * (0.78 + L * 0.085), scale = 0.62 + L * 0.24;
      while (x < W + 20) {
        var bw = (34 + r() * 62) * scale * Math.max(1, W / 1500), bh = (H * (0.16 + r() * 0.36)) * (0.75 + L * 0.12);
        var b = { x: x, w: bw, h: bh, base: base, L: L, tilt: (r() - 0.5) * 0.09, dy: r() * 18 * scale, win: [], top: r() < 0.3 };
        var cols = Math.max(2, Math.floor(bw / (9 * scale + 3))), rows = Math.max(3, Math.floor(bh / (13 * scale + 4)));
        for (i = 0; i < cols; i++) for (j = 0; j < rows; j++) b.win.push({ c: i, r: j, a: r(), bad: r() < 0.05, on: r() < 0.14 });
        b.cols = cols; b.rows = rows;
        s.b.push(b);
        x += bw + (2 + r() * 12) * scale;
      }
    }
    /* tangled wires before, tidy arcs between roofs after */
    for (i = 0; i < 16; i++) {
      var pts = [], px = r() * W, py = horizon * (0.5 + r() * 0.6);
      for (j = 0; j < 7; j++) { pts.push([px, py]); px += (r() - 0.5) * W * 0.3; py += (r() - 0.5) * H * 0.16; }
      s.scr.push({ p: pts, x: pts[3][0], y: pts[3][1] });
    }
    var near = s.b.filter(function (q) { return q.L > 0; });
    for (i = 0; i < near.length - 2; i += 2) {
      var a = near[i], c = near[i + 2];
      s.arcs.push({ x1: a.x + a.w / 2, y1: a.base - a.h, x2: c.x + c.w / 2, y2: c.base - c.h, ph: r() });
    }
    for (i = 0; i < s.stars.length; i++) {
      var best = -1, bd = 1e9;
      for (j = 0; j < s.stars.length; j++) if (j !== i) {
        var d = Math.abs(s.stars[i].x - s.stars[j].x) + Math.abs(s.stars[i].y - s.stars[j].y);
        if (d < bd && s.stars[j].x > s.stars[i].x) { bd = d; best = j; }
      }
      if (best >= 0 && bd < 170) s.links.push([i, best]);
    }
    for (i = 0; i < Math.round(W / 26); i++) s.cars.push({ x: r() * W, lane: i % 2, v: 0.6 + r() * 0.8 });
    /* when does the spark reach each element: first path parameter within radius */
    var R = Math.max(W, H) * 0.3, samples = [];
    for (i = 0; i <= 160; i++) samples.push(path(i / 160));
    function reach(x, y) {
      for (var k = 0; k < samples.length; k++) {
        var dx = samples[k][0] - x, dy = samples[k][1] - y;
        if (dx * dx + dy * dy < R * R) return Math.min(0.9, k / 160);
      }
      return 0.9;
    }
    s.stars.forEach(function (q) { q.t = reach(q.x, q.y); });
    s.b.forEach(function (q) { q.t = reach(q.x + q.w / 2, q.base - q.h * 0.6); });
    s.scr.forEach(function (q) { q.t = reach(q.x, q.y); });
    s.arcs.forEach(function (q) { q.t = reach((q.x1 + q.x2) / 2, Math.min(q.y1, q.y2)); });
    s.roadT = reach(W / 2, H * 0.97);
    return s;
  }
  function act(t) { return ease((P - t) / 0.07); }

  function draw(now) {
    var time = (now - t0) / 1000, i, k, q;
    ctx.setTransform(D, 0, 0, D, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, H), all = ease(P / 0.9);
    g.addColorStop(0, rgb([20, 18, 22], [6, 14, 34], all, 1));
    g.addColorStop(0.6, rgb([38, 30, 30], [14, 34, 66], all, 1));
    g.addColorStop(1, rgb([24, 20, 20], [8, 18, 36], all, 1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* sky: loose dim dots become a connected network */
    ctx.lineWidth = 1;
    for (i = 0; i < S.links.length; i++) {
      var a = S.stars[S.links[i][0]], b = S.stars[S.links[i][1]]; k = Math.min(act(a.t), act(b.t));
      if (k <= 0) continue;
      ctx.strokeStyle = 'rgba(120,200,255,' + 0.22 * k + ')';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k); ctx.stroke();
    }
    for (i = 0; i < S.stars.length; i++) {
      q = S.stars[i]; k = act(q.t);
      var tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(time * 1.3 + q.tw);
      ctx.fillStyle = rgb([150, 140, 130], [190, 230, 255], k, (0.25 + 0.6 * k) * tw);
      ctx.beginPath(); ctx.arc(q.x, q.y, q.m * (0.8 + 0.5 * k), 0, 6.28); ctx.fill();
    }
    /* tangled wires fade out */
    for (i = 0; i < S.scr.length; i++) {
      q = S.scr[i]; k = 1 - act(q.t); if (k <= 0) continue;
      ctx.strokeStyle = 'rgba(196,120,84,' + 0.3 * k + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q.p[0][0], q.p[0][1]);
      for (var j = 1; j < q.p.length - 1; j++) ctx.quadraticCurveTo(q.p[j][0], q.p[j][1], (q.p[j][0] + q.p[j + 1][0]) / 2, (q.p[j][1] + q.p[j + 1][1]) / 2);
      ctx.stroke();
    }
    /* buildings: crooked and dark, then straight and lit */
    for (i = 0; i < S.b.length; i++) {
      q = S.b[i]; k = act(q.t);
      var depth = q.L / 2;
      ctx.save();
      ctx.translate(q.x + q.w / 2, q.base + q.dy * (1 - k));
      ctx.rotate(q.tilt * (1 - k));
      ctx.fillStyle = rgb([46 - depth * 16, 38 - depth * 14, 36 - depth * 12], [16 + depth * 6, 36 + depth * 8, 70 + depth * 14], k, 1);
      ctx.fillRect(-q.w / 2, -q.h, q.w, q.h + 40);
      if (k > 0) { ctx.fillStyle = 'rgba(110,210,255,' + 0.55 * k + ')'; ctx.fillRect(-q.w / 2, -q.h, q.w, 1.5); }
      if (q.top && k > 0.5) { ctx.fillStyle = 'rgba(255,214,140,' + (k - 0.5) * 2 + ')'; ctx.fillRect(-1, -q.h - 12, 2, 12); }
      var cw = q.w / q.cols, ch = q.h / q.rows, n = q.win.length;
      for (var w = 0; w < n; w++) {
        var v = q.win[w], lit = k > v.a * 0.9 ? 1 : 0, flick = reduce ? 1 : (Math.sin(time * 5 + v.a * 40) > 0.2 ? 1 : 0.3);
        if (lit && v.a > 0.16) ctx.fillStyle = 'rgba(255,' + Math.round(205 + v.a * 40) + ',' + Math.round(140 + v.a * 60) + ',' + (0.55 + depth * 0.35) + ')';
        else if (!lit && v.bad) ctx.fillStyle = 'rgba(226,84,60,' + 0.8 * flick + ')';
        else if (!lit && v.on) ctx.fillStyle = 'rgba(190,150,90,0.35)';
        else continue;
        ctx.fillRect(-q.w / 2 + v.c * cw + cw * 0.22, -q.h + v.r * ch + ch * 0.25, cw * 0.56, ch * 0.45);
      }
      ctx.restore();
    }
    /* tidy arcs between roofs with running lights */
    for (i = 0; i < S.arcs.length; i++) {
      q = S.arcs[i]; k = act(q.t); if (k <= 0) continue;
      var mx = (q.x1 + q.x2) / 2, my = Math.min(q.y1, q.y2) - 46;
      ctx.strokeStyle = 'rgba(110,210,255,' + 0.38 * k + ')'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(q.x1, q.y1); ctx.quadraticCurveTo(mx, my, q.x2, q.y2); ctx.stroke();
      var u = reduce ? 0.5 : (time * 0.25 + q.ph) % 1, iu = 1 - u;
      ctx.fillStyle = 'rgba(255,240,200,' + k + ')';
      ctx.beginPath(); ctx.arc(iu * iu * q.x1 + 2 * iu * u * mx + u * u * q.x2, iu * iu * q.y1 + 2 * iu * u * my + u * u * q.y2, 2.2, 0, 6.28); ctx.fill();
    }
    /* road: a jam, then a steady flow */
    k = act(S.roadT);
    ctx.fillStyle = 'rgba(6,8,14,0.85)'; ctx.fillRect(0, H * 0.955, W, H * 0.045);
    for (i = 0; i < S.cars.length; i++) {
      q = S.cars[i];
      var cx = (q.x + (reduce ? 0 : time * 70 * q.v * k * (q.lane ? 1 : -1))) % W; if (cx < 0) cx += W;
      ctx.fillStyle = k > 0.5 ? (q.lane ? 'rgba(255,244,214,0.95)' : 'rgba(110,210,255,0.9)') : 'rgba(226,84,60,0.85)';
      ctx.fillRect(cx, H * (0.966 + q.lane * 0.014), 9 + 9 * k, 2.4);
    }
    /* the spark and its trail */
    if (P > 0.002 && P < 0.995) {
      ctx.lineCap = 'round';
      for (i = 28; i >= 1; i--) {
        var u1 = P - i * 0.0045, u2 = P - (i - 1) * 0.0045; if (u1 < 0) continue;
        var p1 = path(u1), p2 = path(u2), f = 1 - i / 28;
        ctx.strokeStyle = 'rgba(255,' + Math.round(200 + 40 * f) + ',' + Math.round(120 + 100 * f) + ',' + 0.75 * f * f + ')';
        ctx.lineWidth = 1 + 7 * f; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
      var sp = path(P), halo = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 130);
      halo.addColorStop(0, 'rgba(255,250,235,0.95)'); halo.addColorStop(0.08, 'rgba(255,224,150,0.7)');
      halo.addColorStop(0.35, 'rgba(120,200,255,0.16)'); halo.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sp[0], sp[1], 130, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 1.4;
      var rays = 18 + (reduce ? 0 : 5 * Math.sin(time * 9));
      ctx.beginPath(); ctx.moveTo(sp[0] - rays, sp[1]); ctx.lineTo(sp[0] + rays, sp[1]); ctx.moveTo(sp[0], sp[1] - rays); ctx.lineTo(sp[0], sp[1] + rays); ctx.stroke();
    }
  }

  function progress() {
    var end = document.querySelector('[data-iskra-end]');
    var span = end ? end.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35 : document.documentElement.scrollHeight - window.innerHeight;
    return clamp(window.scrollY / Math.max(1, span));
  }
  function frame(now) {
    raf = 0;
    P += (progress() - P) * (reduce ? 1 : 0.14);
    if (Math.abs(progress() - P) < 0.0004) P = progress();
    draw(now); shown = P;
    document.documentElement.setAttribute('data-iskra-p', P.toFixed(3));
    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function resize() {
    D = Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * D); cv.height = Math.round(H * D);
    S = build();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !raf) raf = requestAnimationFrame(frame); });
  if (reduce) P = 1;
  resize();
})();
