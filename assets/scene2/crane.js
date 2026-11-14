/* Scroll scene of /products.html "The crane builds the building" (drawer for assets/scene2.js).
   P 0..0.14 - brass dashed outline of the building with levels; 0.14..0.86 - the hook cycle (pick, lift, carry,
   lower) floor by floor, windows light up on the floors already set; 0.86..1 - the building is done, lights on.
   Scene2Draw.crane(ctx, W, H, P, dpr): W, H in CSS px, the context is already scaled by dpr. Deterministic (fixed
   seeds, no clock), so the test mode and the posters get the same frame for the same P. */
(function (g) {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sm(v) { v = cl(v); return v * v * (3 - 2 * v); }
  function seg(P, a, b) { return cl((P - a) / (b - a)); }
  function mixc(a, b, k) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')'; }
  var WARM = [255, 196, 120];
  var cache = { key: '' };
  var FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  function layout(W, H) {
    var tall = H > W * 1.1;
    var ground = H * (tall ? 0.86 : 0.84);
    var floors = tall ? 12 : 11;
    var bx0 = W * (tall ? 0.42 : 0.53), bx1 = W * (tall ? 0.90 : 0.77);
    var top = H * (tall ? 0.30 : 0.22);
    var fh = (ground - top) / floors;
    var mast = W * (tall ? 0.22 : 0.42);
    var jibY = top - fh * 2.4;
    return { tall: tall, ground: ground, floors: floors, bx0: bx0, bx1: bx1, top: top, fh: fh, mast: mast, jibY: jibY,
      jibEnd: Math.min(W * 0.97, bx1 + W * 0.04), cjEnd: mast - W * (tall ? 0.16 : 0.11), stackX: mast + W * (tall ? 0.07 : 0.045) };
  }

  function buildStatic(W, H, L, D) {
    var r = rng(7), sky = document.createElement('canvas'); sky.width = Math.round(W * D); sky.height = Math.round(H * D);
    var c = sky.getContext('2d'); c.scale(D, D);
    var gr = c.createLinearGradient(0, 0, 0, L.ground);
    gr.addColorStop(0, '#070C16'); gr.addColorStop(0.55, '#111C30'); gr.addColorStop(0.85, '#2A2A3C'); gr.addColorStop(1, '#4A3836');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    var hg = c.createRadialGradient(W * 0.2, L.ground, 0, W * 0.2, L.ground, W * 0.7);
    hg.addColorStop(0, 'rgba(240,160,100,0.22)'); hg.addColorStop(1, 'rgba(240,160,100,0)');
    c.fillStyle = hg; c.fillRect(0, 0, W, H);
    for (var i = 0; i < 70; i++) { c.fillStyle = 'rgba(220,230,255,' + (0.15 + r() * 0.5) + ')'; var s = r() < 0.9 ? 1 : 1.6; c.fillRect(r() * W, r() * L.ground * 0.55, s, s); }
    [[0.16, '#0C1424', 0.10], [0.09, '#0F1A2D', 0.18]].forEach(function (ly) {
      var x = -10; c.fillStyle = ly[1];
      while (x < W) {
        var w = 18 + r() * 46, h = L.ground * (0.04 + r() * ly[0]);
        c.fillRect(x, L.ground - h, w, h);
        for (var wy = L.ground - h + 6; wy < L.ground - 6; wy += 9) for (var wx = x + 4; wx < x + w - 4; wx += 8)
          if (r() < ly[2]) { c.fillStyle = 'rgba(255,200,130,' + (0.25 + r() * 0.35) + ')'; c.fillRect(wx, wy, 2.5, 3); c.fillStyle = ly[1]; }
        x += w + r() * 6;
      }
    });
    var gg = c.createLinearGradient(0, L.ground, 0, H); gg.addColorStop(0, '#141B26'); gg.addColorStop(1, '#090D14');
    c.fillStyle = gg; c.fillRect(0, L.ground, W, H - L.ground);
    c.strokeStyle = 'rgba(217,169,97,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, L.ground + 0.5); c.lineTo(W, L.ground + 0.5); c.stroke();
    c.strokeStyle = 'rgba(160,180,210,0.18)';
    for (var fx = 0; fx < W; fx += 14) { c.beginPath(); c.moveTo(fx, L.ground + 4); c.lineTo(fx, L.ground + 18); c.stroke(); }
    c.beginPath(); c.moveTo(0, L.ground + 6); c.lineTo(W, L.ground + 6); c.stroke();
    return sky;
  }

  function windows(L) {
    var r = rng(42), out = [], cols = L.tall ? 6 : 8;
    for (var f = 0; f < L.floors; f++) for (var k = 0; k < cols; k++) out.push({ f: f, k: k, d: r(), on: r() < 0.82 });
    return { list: out, cols: cols };
  }

  function draw(c, W, H, P, D) {
    D = D || 1;
    var L = layout(W, H), key = W + 'x' + H + 'x' + D;
    if (cache.key !== key) { cache.key = key; cache.sky = buildStatic(W, H, L, D); cache.win = windows(L); }
    c.drawImage(cache.sky, 0, 0, W, H);
    var bw = L.bx1 - L.bx0;
    var bp = sm(seg(P, 0.0, 0.14));
    var built = seg(P, 0.14, 0.86) * L.floors;
    var nDone = Math.floor(built), ph = built - nDone;
    if (P >= 0.86) { nDone = L.floors; ph = 0; }
    var fin = sm(seg(P, 0.86, 1));
    c.save(); c.setLineDash([6, 5]); c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(217,169,97,' + (0.15 + 0.55 * bp * (1 - 0.6 * fin)) + ')';
    c.beginPath(); c.rect(L.bx0, L.top, bw, L.ground - L.top); c.stroke();
    var sd0 = bw * (L.tall ? 0.16 : 0.13), lf0 = L.fh * 0.35;
    c.beginPath(); c.moveTo(L.bx1, L.top); c.lineTo(L.bx1 + sd0, L.top - lf0); c.lineTo(L.bx1 + sd0, L.ground - lf0); c.lineTo(L.bx1, L.ground); c.moveTo(L.bx0, L.top); c.lineTo(L.bx0 + sd0, L.top - lf0); c.lineTo(L.bx1 + sd0, L.top - lf0); c.stroke();
    c.setLineDash([]); c.lineWidth = 0.6; c.strokeStyle = 'rgba(217,169,97,' + (0.18 * bp) + ')';
    for (var f = 1; f < L.floors; f++) { var y = L.ground - f * L.fh; c.beginPath(); c.moveTo(L.bx0, y); c.lineTo(L.bx1, y); c.stroke(); }
    c.fillStyle = 'rgba(217,169,97,' + (0.6 * bp) + ')'; c.font = '600 ' + Math.max(10, W * 0.008) + 'px ' + FONT;
    var sd = bw * (L.tall ? 0.16 : 0.13), lf = L.fh * 0.35;
    c.fillText('+' + (L.floors * 3.0).toFixed(1).replace('.', ',') + ' м', L.bx1 + sd + 8, L.top - lf + 4);
    c.fillText('±0,000', L.bx1 + sd + 8, L.ground - lf - 4);
    c.restore();
    var side = bw * (L.tall ? 0.16 : 0.13), lift = L.fh * 0.35;   // side facade in light perspective
    for (f = 0; f < nDone; f++) {
      var y0 = L.ground - (f + 1) * L.fh;
      var g2 = c.createLinearGradient(L.bx0, 0, L.bx1, 0);
      g2.addColorStop(0, '#1C2739'); g2.addColorStop(1, '#2C3B55');
      c.fillStyle = g2; c.fillRect(L.bx0, y0, bw, L.fh);
      c.fillStyle = '#121A29';
      c.beginPath(); c.moveTo(L.bx1, y0); c.lineTo(L.bx1 + side, y0 - lift); c.lineTo(L.bx1 + side, y0 + L.fh - lift); c.lineTo(L.bx1, y0 + L.fh); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(L.bx0, y0 + L.fh - 2, bw, 2);
      c.fillStyle = 'rgba(150,170,200,0.10)'; c.fillRect(L.bx0, y0, bw, 1);
    }
    if (nDone > 0) {   // pilasters every two window bays
      c.fillStyle = 'rgba(255,255,255,0.035)';
      for (var pk = 0; pk <= cache.win.cols; pk += 2) c.fillRect(L.bx0 + pk * bw / cache.win.cols - 2, L.ground - nDone * L.fh, 4, nDone * L.fh);
    }
    var cols = cache.win.cols, cw = bw / cols, wlist = cache.win.list;
    for (var i = 0; i < wlist.length; i++) {
      var w = wlist[i]; if (w.f >= nDone) continue;
      var age = (built - (w.f + 1)) / 3;
      var lit = w.on ? cl((age - w.d * 0.8) * 2) : 0;
      if (P >= 0.86) lit = Math.max(lit, w.on ? fin : 0);
      var wx = L.bx0 + w.k * cw + cw * 0.2, wy = L.ground - (w.f + 1) * L.fh + L.fh * 0.18, ww = cw * 0.6, wh = L.fh * 0.6;
      var tone = w.d > 0.85 ? [205, 225, 255] : WARM;
      c.fillStyle = lit > 0.02 ? mixc([20, 28, 42], tone, lit * (0.62 + 0.38 * w.d)) : '#111827';
      c.fillRect(wx, wy, ww, wh);
      if (lit > 0.02) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(wx + ww / 2 - 0.5, wy, 1, wh); c.fillRect(wx, wy + wh * 0.62, ww, 1); }
    }
    // side windows (narrow)
    for (f = 0; f < nDone; f++) {
      var sy = L.ground - (f + 1) * L.fh + L.fh * 0.18;
      for (var sk = 0; sk < 2; sk++) {
        var sx0 = L.bx1 + side * (0.2 + sk * 0.42), sx1 = sx0 + side * 0.24, dy0 = lift * (sx0 - L.bx1) / side, dy1 = lift * (sx1 - L.bx1) / side;
        var on = ((f * 3 + sk) % 4) !== 0 && (built - f - 1) > 1.2 || fin > 0.5;
        c.fillStyle = on ? 'rgba(240,180,110,0.55)' : '#0E1522';
        c.beginPath(); c.moveTo(sx0, sy - dy0); c.lineTo(sx1, sy - dy1); c.lineTo(sx1, sy - dy1 + L.fh * 0.6); c.lineTo(sx0, sy - dy0 + L.fh * 0.6); c.closePath(); c.fill();
      }
    }
    // a slab that has just been set flashes once along its edge
    if (nDone > 0 && nDone < L.floors && ph < 0.25) {
      var fy = L.ground - nDone * L.fh, fl = 1 - ph / 0.25;
      c.strokeStyle = 'rgba(255,214,150,' + 0.9 * fl + ')'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(L.bx0, fy); c.lineTo(L.bx1, fy); c.lineTo(L.bx1 + side, fy - lift); c.stroke();
    }
    if (fin > 0) {
      var gx = (L.bx0 + L.bx1) / 2, gy = (L.top + L.ground) / 2;
      var gl = c.createRadialGradient(gx, gy, 0, gx, gy, bw * 1.2);
      gl.addColorStop(0, 'rgba(255,190,120,' + 0.12 * fin + ')'); gl.addColorStop(1, 'rgba(255,190,120,0)');
      c.fillStyle = gl; c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(240,200,136,' + 0.8 * fin + ')'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(L.bx0, L.top); c.lineTo(L.bx1, L.top); c.stroke();
    }
    // floodlights: two masts throw light up the facade, stronger as work goes on
    var on = sm(seg(P, 0.1, 0.3)) * (1 - 0.5 * fin);
    if (on > 0) {
      [[L.bx0 - bw * 0.12, -1], [L.bx1 + bw * 0.35, 1]].forEach(function (fl) {
        var lx = fl[0], ly = L.ground - L.fh * 1.4;
        c.strokeStyle = 'rgba(160,180,210,0.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(lx, L.ground); c.lineTo(lx, ly); c.stroke();
        // soft elliptical wash on the facade instead of a hard cone
        var tx = (L.bx0 + L.bx1) / 2 + fl[1] * bw * 0.15, ty = L.ground - L.fh * 3.2;
        c.save(); c.translate(tx, ty); c.rotate(fl[1] * 0.35); c.scale(1, 1.9);
        var cg = c.createRadialGradient(0, 0, 0, 0, 0, bw * 0.55);
        cg.addColorStop(0, 'rgba(255,236,200,' + 0.11 * on + ')'); cg.addColorStop(0.6, 'rgba(255,236,200,' + 0.04 * on + ')'); cg.addColorStop(1, 'rgba(255,236,200,0)');
        c.fillStyle = cg; c.fillRect(-bw * 0.6, -bw * 0.6, bw * 1.2, bw * 1.2); c.restore();
        var hg = c.createRadialGradient(lx, ly, 0, lx, ly, 14);
        hg.addColorStop(0, 'rgba(255,240,210,' + 0.5 * on + ')'); hg.addColorStop(1, 'rgba(255,240,210,0)');
        c.fillStyle = hg; c.fillRect(lx - 14, ly - 14, 28, 28);
        c.fillStyle = 'rgba(255,240,210,' + on + ')'; c.fillRect(lx - 3, ly - 2, 6, 3);
      });
    }
    drawCrane(c, W, H, L, nDone, ph, bw);
  }

  function lattice(c, x0, y0, x1, y1, n, vert) {
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(vert ? x0 : x1, vert ? y1 : y0); c.moveTo(vert ? x1 : x0, vert ? y0 : y1); c.lineTo(x1, y1);
    for (var i = 0; i < n; i++) {
      var a = i / n, b = (i + 1) / n;
      if (vert) { c.moveTo(i % 2 ? x1 : x0, y0 + (y1 - y0) * a); c.lineTo(i % 2 ? x0 : x1, y0 + (y1 - y0) * b); }
      else { c.moveTo(x0 + (x1 - x0) * a, i % 2 ? y1 : y0); c.lineTo(x0 + (x1 - x0) * b, i % 2 ? y0 : y1); }
    }
    c.stroke();
  }

  function drawCrane(c, W, H, L, nDone, ph, bw) {
    var mw = Math.max(8, W * 0.009), jt = L.jibY, jh = Math.max(7, H * 0.012);
    c.save(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(217,169,97,0.9)';
    lattice(c, L.mast - mw / 2, jt, L.mast + mw / 2, L.ground, 40, true);
    lattice(c, L.cjEnd, jt, L.jibEnd, jt + jh, 46, false);
    c.fillStyle = '#D9A961'; c.fillRect(L.mast - mw * 0.9, jt + jh, mw * 1.8, jh * 1.4);
    c.beginPath(); c.moveTo(L.mast - mw / 2, jt); c.lineTo(L.mast, jt - jh * 3.2); c.lineTo(L.mast + mw / 2, jt); c.stroke();
    c.lineWidth = 0.8; c.beginPath(); c.moveTo(L.mast, jt - jh * 3.2); c.lineTo(L.jibEnd * 0.98, jt); c.moveTo(L.mast, jt - jh * 3.2); c.lineTo(L.cjEnd + 4, jt); c.stroke();
    c.fillStyle = '#2A3448'; c.fillRect(L.cjEnd + 2, jt + jh, (L.mast - L.cjEnd) * 0.32, jh * 2.2);
    c.strokeStyle = 'rgba(217,169,97,0.6)'; c.strokeRect(L.cjEnd + 2, jt + jh, (L.mast - L.cjEnd) * 0.32, jh * 2.2);
    var cx = (L.bx0 + L.bx1) / 2, pickX = L.stackX, dropY = L.ground - nDone * L.fh, pickY = L.ground - L.fh * 0.35;
    var tx, hy, carry = false, done = nDone >= L.floors, up = jt + jh * 4;
    if (done) { tx = L.mast + (L.jibEnd - L.mast) * 0.35; hy = jt + jh + H * 0.08; }
    else if (ph < 0.22) { tx = cx + (pickX - cx) * sm(ph / 0.22); hy = jt + jh + (pickY - jt - jh) * sm(seg(ph, 0.08, 0.22)); }
    else if (ph < 0.42) { tx = pickX; carry = true; hy = pickY + (up - pickY) * sm((ph - 0.22) / 0.2); }
    else if (ph < 0.7) { carry = true; tx = pickX + (cx - pickX) * sm((ph - 0.42) / 0.28); hy = up; }
    else { carry = true; tx = cx; hy = up + (dropY - L.fh * 1.9 - up) * sm((ph - 0.7) / 0.3); }
    c.fillStyle = '#D9A961'; c.fillRect(tx - mw * 0.7, jt + jh, mw * 1.4, jh * 0.6);
    c.strokeStyle = 'rgba(230,220,200,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx - 2, jt + jh * 1.6); c.lineTo(tx - 2, hy); c.moveTo(tx + 2, jt + jh * 1.6); c.lineTo(tx + 2, hy); c.stroke();
    c.fillStyle = '#F0C888'; c.beginPath(); c.arc(tx, hy + 3, 3.5, 0, 6.3); c.fill();
    var pw = bw, phh = L.fh;
    if (carry) {
      var px = tx - pw / 2, py = hy + phh * 0.9;
      c.strokeStyle = 'rgba(230,220,200,0.55)'; c.beginPath(); c.moveTo(tx, hy + 4); c.lineTo(px + 6, py); c.moveTo(tx, hy + 4); c.lineTo(px + pw - 6, py); c.stroke();
      var g3 = c.createLinearGradient(px, 0, px + pw, 0); g3.addColorStop(0, '#2A3850'); g3.addColorStop(1, '#3A4A66');
      c.fillStyle = g3; c.fillRect(px, py, pw, phh);
      c.strokeStyle = 'rgba(240,200,136,0.9)'; c.lineWidth = 1.2; c.strokeRect(px + 0.5, py + 0.5, pw - 1, phh - 1);
    }
    if (!done) { c.fillStyle = '#273248'; for (var s = 0; s < 3; s++) c.fillRect(pickX - W * 0.03, L.ground - (s + 1) * 6, W * 0.06, 5); }
    c.fillStyle = '#FF6A4A'; c.beginPath(); c.arc(L.jibEnd, jt, 2.5, 0, 6.3); c.fill(); c.beginPath(); c.arc(L.mast, jt - jh * 3.2, 2.5, 0, 6.3); c.fill();
    c.restore();
  }
  (g.Scene2Draw = g.Scene2Draw || {}).crane = draw;
})(window);
