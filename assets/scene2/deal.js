/* Scroll scene of /rieltor/ "Hundreds of lights -> one window" (drawer for assets/scene2.js).
   P 0..0.18 - search: offers light up one after another over the night city; 0.22..0.42 - selection: most go out,
   three remain in rings; 0.42..0.66 - the camera flies to the chosen window; 0.56..0.82 - its floor plan and the
   checks (documents, debts, encumbrances, price); 0.8..1 - the window becomes a warm room with keys on the sill.
   Scene2Draw.deal(ctx, W, H, P, dpr): W, H in CSS px, the context is already scaled by dpr. Deterministic (fixed
   seeds, no clock). The city without the offers is painted once into an offscreen canvas; while the camera is far
   it is copied, close up the visible part is drawn as vectors so the windows stay sharp. */
(function (g) {
  'use strict';
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cl(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sm(v) { v = cl(v); return v * v * (3 - 2 * v); }
  function seg(P, a, b) { return cl((P - a) / (b - a)); }
  var cache = { key: '' };
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var VECTOR_Z = 2.2;   /* closer than this the city is drawn as vectors */

  /* world: a city in 3 depth layers, world units = CSS px of the frame at zoom 1 */
  function buildWorld(W, H) {
    var r = rng(11), tall = H > W * 1.1, ground = H * 0.9, layers = [], wins = [];
    var spec = [[0.30, 0.55, '#0B1322'], [0.22, 0.42, '#0F192B'], [0.14, 0.30, '#142036']];
    spec.forEach(function (sp, li) {
      var x = -20, bl = [];
      while (x < W + 20) {
        var w = (tall ? 34 : 46) + r() * (tall ? 40 : 70), h = H * (sp[0] + r() * (sp[1] - sp[0]));
        if (li === 2) h *= 0.75;
        var b = { x: x, y: ground - h, w: w, h: h, c: sp[2], li: li, wins: [] };
        bl.push(b);
        var cw = li === 2 ? 11 : 9, chh = li === 2 ? 14 : 12;
        for (var wy = b.y + 8; wy < ground - 10; wy += chh) for (var wx = b.x + 5; wx < b.x + w - 8; wx += cw) {
          var win = { x: wx, y: wy, w: cw * 0.5, h: chh * 0.55, li: li, base: r() < 0.22 ? 0.3 + r() * 0.3 : 0, list: false };
          wins.push(win); b.wins.push(win);
        }
        x += w + 2 + r() * 8;
      }
      layers.push(bl);
    });
    /* a window hidden by a nearer building never becomes an offer (the offers are drawn above the city) */
    function covered(w) {
      for (var li = w.li + 1; li < layers.length; li++) for (var i = 0; i < layers[li].length; i++) {
        var b = layers[li][i];
        if (w.x + w.w > b.x && w.x < b.x + b.w && w.y + w.h > b.y) return true;
      }
      return false;
    }
    var cand = wins.filter(function (w) { return w.li > 0 && w.y < ground - 30 && !covered(w); });
    for (var i = 0; i < Math.min(220, cand.length); i++) { var k = Math.floor(r() * cand.length); cand[k].list = true; cand[k].ld = r(); }
    var listed = wins.filter(function (w) { return w.list; });
    var mid = listed.filter(function (w) { return w.li === 2 && w.x > W * 0.45 && w.x < W * 0.7 && w.y > H * 0.55 && w.y < H * 0.72; });
    var chosen = mid[0] || listed[0];
    var others = listed.filter(function (w) { return w !== chosen && w.li >= 1 && Math.abs(w.x - chosen.x) > W * 0.12 && w.y < H * 0.7; });
    var fin = [chosen, others[Math.floor(others.length * 0.2)], others[Math.floor(others.length * 0.75)]];
    fin.forEach(function (w) { w.fin = true; });
    var stars = []; for (i = 0; i < 80; i++) stars.push([r() * W, r() * H * 0.45, 0.2 + r() * 0.5]);
    return { tall: tall, ground: ground, layers: layers, wins: wins, listed: listed, chosen: chosen, fin: fin, stars: stars };
  }

  function sky(c, W, H) {
    var gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#060A13'); gr.addColorStop(0.6, '#0E1828'); gr.addColorStop(1, '#1D1F2E');
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
  }
  /* the city without offers: stars, moon glow, buildings, ordinary lit windows; view = world rect to cull, or null */
  function city(c, Wd, W, H, starA, view, lift) {
    Wd.stars.forEach(function (s) { c.fillStyle = 'rgba(220,230,255,' + s[2] * starA + ')'; c.fillRect(s[0], s[1], 1, 1); });
    if (!view) {
      var moon = c.createRadialGradient(W * 0.8, H * 0.18, 0, W * 0.8, H * 0.18, H * 0.25);
      moon.addColorStop(0, 'rgba(180,200,240,0.10)'); moon.addColorStop(1, 'rgba(180,200,240,0)'); c.fillStyle = moon; c.fillRect(0, 0, W, H);
    }
    Wd.layers.forEach(function (bl) {
      bl.forEach(function (b) {
        if (view && (b.x > view[2] || b.x + b.w < view[0] || b.y > view[3])) return;
        c.fillStyle = b.c; c.fillRect(b.x, b.y, b.w, Wd.ground - b.y + 2);
        c.fillStyle = 'rgba(160,190,230,0.06)'; c.fillRect(b.x, b.y, b.w, 1);
        c.fillStyle = 'rgb(255,190,120)';
        for (var i = 0; i < b.wins.length; i++) {
          var w = b.wins[i];
          if (!w.base || w.list) continue;
          if (view && (w.x > view[2] || w.x + w.w < view[0] || w.y > view[3] || w.y + w.h < view[1])) continue;
          c.globalAlpha = lift ? Math.min(1, w.base + lift) : w.base; c.fillRect(w.x, w.y, w.w, w.h);
        }
        c.globalAlpha = 1;
      });
    });
  }
  function halo(D) {
    var s = document.createElement('canvas'), n = Math.round(64 * D);
    s.width = s.height = n;
    var c = s.getContext('2d'), gr = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    gr.addColorStop(0, 'rgba(240,200,136,0.35)'); gr.addColorStop(1, 'rgba(240,200,136,0)');
    c.fillStyle = gr; c.fillRect(0, 0, n, n);
    return s;
  }

  function draw(c, W, H, P, D) {
    D = D || 1;
    var key = W + 'x' + H + 'x' + D;
    if (cache.key !== key) {
      cache.key = key; cache.w = buildWorld(W, H); cache.halo = halo(D);
      var st = document.createElement('canvas'); st.width = Math.round(W * D); st.height = Math.round(H * D);
      var sc = st.getContext('2d'); sc.scale(D, D); sky(sc, W, H); city(sc, cache.w, W, H, 1, null); vignette(sc, W, H);
      cache.st = st; cache.home = null;
    }
    var Wd = cache.w, ch = Wd.chosen;
    var pSearch = sm(seg(P, 0.0, 0.18)), pSelect = sm(seg(P, 0.22, 0.42)), pZoom = sm(seg(P, 0.42, 0.66)), pCheck = seg(P, 0.58, 0.82), pHome = sm(seg(P, 0.8, 0.97));
    if (pHome >= 1) { home(c, W, H, D, 1); return; }
    var z = 1 + pZoom * (Wd.tall ? 5 : 7);
    var tx = ch.x + ch.w / 2, ty = ch.y + ch.h / 2;
    var sx = W / 2 + (tx - W / 2) * (1 - pZoom), sy = H / 2 + (ty - H / 2) * (1 - pZoom);
    c.save();
    c.translate(sx, sy); c.scale(z, z); c.translate(-tx, -ty);
    if (z < VECTOR_Z) {
      c.drawImage(cache.st, 0, 0, W, H);
    } else {
      var v = [tx - sx / z - 2, ty - sy / z - 2, tx + (W - sx) / z + 2, ty + (H - sy) / z + 2];
      c.fillStyle = '#0E1828'; c.fillRect(v[0], v[1], v[2] - v[0], v[3] - v[1]); city(c, Wd, W, H, 1 - pZoom, v, 0.45 * pZoom);
    }
    /* selection: the city steps back (but not once the camera is close: the chosen window must stay bright) */
    var dim = 0.38 * pSelect * (1 - pZoom);
    if (dim > 0) { c.fillStyle = 'rgba(4,7,14,' + dim + ')'; c.fillRect(-W, -H, W * 3, H * 3); }
    var hs = cache.halo;
    for (var i = 0; i < Wd.listed.length; i++) {
      var w = Wd.listed[i];
      var on = cl((pSearch - w.ld * 0.7) * 3.3);
      var keep = w.fin ? 1 : 1 - cl((pSelect - w.ld * 0.5) * 2);
      var a = Math.max(w.base * (1 - dim), on * keep);
      if (a <= 0.05) continue;
      var R = 9 + (w.fin ? 10 * pSelect : 0), mx = w.x + w.w / 2, my = w.y + w.h / 2;
      c.globalAlpha = a; c.drawImage(hs, mx - R * 2, my - R * 2, R * 4, R * 4);
      c.globalAlpha = 1;
      c.fillStyle = w.fin && pSelect > 0.5 ? 'rgba(255,214,150,' + a + ')' : 'rgba(240,200,136,' + a * 0.95 + ')';
      c.fillRect(w.x, w.y, w.w, w.h);
    }
    if (pSelect > 0) {
      Wd.fin.forEach(function (w, k) {
        var rr = 14 + 4 * k, al = pSelect * (1 - pZoom * (w === ch ? 0 : 1));
        c.strokeStyle = 'rgba(217,169,97,' + al + ')'; c.lineWidth = 1.2 / z;
        c.beginPath(); c.arc(w.x + w.w / 2, w.y + w.h / 2, rr * (0.6 + 0.4 * pSelect), 0, 6.3); c.stroke();
      });
    }
    c.restore();
    var ps = Wd.tall ? W * 0.78 : Math.min(W * 0.4, H * 0.62);
    var planA = sm(seg(P, 0.56, 0.64)) * (1 - pHome);
    if (planA > 0) drawPlan(c, W / 2, H / 2 - (Wd.tall ? H * 0.04 : 0), ps, planA, pCheck);
    if (pHome > 0) home(c, W, H, D, pHome);
  }

  function vignette(c, W, H) {
    var vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  /* the final room is painted once into its own canvas and faded in as a picture */
  function home(c, W, H, D, k) {
    if (!cache.home) {
      var hc = document.createElement('canvas'); hc.width = Math.round(W * D); hc.height = Math.round(H * D);
      var x = hc.getContext('2d'); x.scale(D, D); drawHome(x, W, H, 1, cache.w.tall); cache.home = hc;
    }
    c.save(); c.globalAlpha = k; c.drawImage(cache.home, 0, 0, W, H); c.restore();
  }

  function drawPlan(c, x, y, s, a, pc) {
    var ph = s * 0.76, list = s * 0.09;
    c.save(); c.translate(x - s / 2, y - (ph + 4.6 * list) / 2); c.globalAlpha = a;
    c.fillStyle = 'rgba(8,13,24,0.8)'; c.fillRect(-16, -16, s + 32, ph + 4.6 * list + 32);
    c.strokeStyle = 'rgba(240,200,136,0.95)'; c.lineWidth = 2.4;
    c.strokeRect(0, 0, s, ph);
    c.lineWidth = 1.3; c.beginPath();
    c.moveTo(s * 0.42, 0); c.lineTo(s * 0.42, s * 0.30); c.moveTo(s * 0.42, s * 0.42); c.lineTo(s * 0.42, ph);
    c.moveTo(0, s * 0.46); c.lineTo(s * 0.3, s * 0.46); c.moveTo(s * 0.42, s * 0.36); c.lineTo(s, s * 0.36);
    c.moveTo(s * 0.72, s * 0.36); c.lineTo(s * 0.72, ph); c.stroke();
    c.font = '500 ' + Math.max(11, s * 0.036) + 'px ' + MONO; c.fillStyle = 'rgba(240,200,136,0.9)';
    c.fillText('комната 18,4', s * 0.05, s * 0.2); c.fillText('кухня 11,2', s * 0.52, s * 0.2); c.fillText('спальня 14,0', s * 0.05, s * 0.62); c.fillText('с/у', s * 0.78, s * 0.58);
    var items = ['документы', 'долги', 'обременения', 'цена'];
    c.font = '500 ' + Math.max(13, s * 0.046) + 'px ' + SANS;
    items.forEach(function (t, i) {
      var k = cl(pc * 4 - i), yy = ph + list * (i + 1) + 2;
      if (k <= 0) return;
      c.globalAlpha = a * Math.min(1, k * 2);
      c.strokeStyle = 'rgb(120,200,150)'; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(0, yy - 5); c.lineTo(6 * Math.min(1, k * 2), yy - 5 + 5 * Math.min(1, k * 2));
      if (k > 0.5) c.lineTo(6 + 10 * (k - 0.5) * 2, yy - 12 * (k - 0.5) * 2); c.stroke();
      c.fillStyle = '#E8ECF3'; c.fillText(t + ' — проверено', 26, yy);
    });
    c.restore();
  }

  function drawHome(c, W, H, k, tall) {
    /* the chosen window becomes the frame: warm room, lamp, string lights, two people, keys on the sill. The window
       has a transom and one mullion on the right, so the people stand in one clear pane */
    c.save(); c.globalAlpha = k;
    var fw = tall ? W * 0.82 : Math.min(W * 0.5, H * 0.95), fh = fw * (tall ? 1.15 : 0.74), fx = (W - fw) / 2, fy = (H - fh) / 2 - H * 0.02;
    c.fillStyle = '#0B1220'; c.fillRect(0, 0, W, H);
    var room = c.createRadialGradient(fx + fw * 0.7, fy + fh * 0.35, 0, fx + fw * 0.6, fy + fh * 0.5, fw * 0.9);
    room.addColorStop(0, '#FFDDA6'); room.addColorStop(0.45, '#D0915A'); room.addColorStop(1, '#4A2E1F');
    c.fillStyle = room; c.fillRect(fx, fy, fw, fh);
    c.fillStyle = 'rgba(255,240,210,0.95)'; c.beginPath(); c.arc(fx + fw * 0.66, fy + fh * 0.36, fw * 0.035, 0, 6.3); c.fill();
    c.strokeStyle = 'rgba(80,50,30,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(fx + fw * 0.66, fy + fh * 0.2); c.lineTo(fx + fw * 0.66, fy + fh * 0.33); c.stroke();
    c.fillStyle = 'rgba(120,60,40,0.5)'; c.fillRect(fx, fy, fw * 0.1, fh); c.fillRect(fx + fw * 0.9, fy, fw * 0.1, fh);
    for (var i = 0; i <= 14; i++) {
      var u = i / 14, lx = fx + fw * (0.12 + 0.76 * u), ly = fy + fh * 0.26 + Math.sin(u * Math.PI) * fh * 0.07;
      c.fillStyle = 'rgba(255,230,170,0.95)'; c.beginPath(); c.arc(lx, ly, Math.max(2.4, fw * 0.005), 0, 6.3); c.fill();
    }
    c.fillStyle = 'rgba(40,24,18,0.85)';
    [[0.28, 1], [0.48, 0.92]].forEach(function (p) {
      var hx = fx + fw * p[0], hb = fy + fh * 0.97, hs = Math.min(fh, fw * 0.74) * 0.5 * p[1];
      c.beginPath(); c.arc(hx, hb - hs, hs * 0.13, 0, 6.3); c.fill();
      c.beginPath(); c.moveTo(hx - hs * 0.2, hb); c.quadraticCurveTo(hx - hs * 0.22, hb - hs * 0.8, hx, hb - hs * 0.84); c.quadraticCurveTo(hx + hs * 0.22, hb - hs * 0.8, hx + hs * 0.2, hb); c.fill();
    });
    c.fillStyle = 'rgba(70,45,30,0.9)'; c.fillRect(fx + fw * 0.56, fy + fh * 0.76, fw * 0.14, fh * 0.21);
    var bar = Math.max(6, fw * 0.02);
    c.strokeStyle = '#1A2436'; c.lineWidth = bar; c.strokeRect(fx, fy, fw, fh);
    c.beginPath(); c.moveTo(fx, fy + fh * 0.18); c.lineTo(fx + fw, fy + fh * 0.18); c.moveTo(fx + fw * 0.78, fy + fh * 0.18); c.lineTo(fx + fw * 0.78, fy + fh); c.stroke();
    c.fillStyle = '#2A3448'; c.fillRect(fx - fw * 0.04, fy + fh, fw * 1.08, fh * 0.05);
    var kx = fx + fw * 0.14, ky = fy + fh + fh * 0.005;
    c.strokeStyle = '#F0C888'; c.lineWidth = Math.max(2.2, fw * 0.004); c.beginPath(); c.arc(kx, ky - fh * 0.03, fh * 0.022, 0, 6.3); c.stroke();
    c.beginPath(); c.moveTo(kx + fh * 0.022, ky - fh * 0.03); c.lineTo(kx + fh * 0.09, ky - fh * 0.03); c.lineTo(kx + fh * 0.09, ky - fh * 0.015); c.moveTo(kx + fh * 0.07, ky - fh * 0.03); c.lineTo(kx + fh * 0.07, ky - fh * 0.018); c.stroke();
    var gl = c.createRadialGradient(kx + fh * 0.04, ky - fh * 0.03, 0, kx + fh * 0.04, ky - fh * 0.03, fh * 0.08);
    gl.addColorStop(0, 'rgba(255,220,150,0.5)'); gl.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = gl; c.fillRect(kx - fh * 0.1, ky - fh * 0.15, fh * 0.3, fh * 0.2);
    c.restore();
  }
  (g.Scene2Draw = g.Scene2Draw || {}).deal = draw;
})(window);
