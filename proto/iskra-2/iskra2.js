/* Sketch 2: two generated pictures of one composition ("before" under, "after" over). Scroll moves a spark;
   the "after" picture shows through a soft mask that follows the spark's path. Scenario: ?s=<slug>. */
(function () {
  'use strict';
  var cv = document.querySelector('[data-iskra]');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var slug = (/[?&]s=([a-z]+)/.exec(location.search) || [0, 'gorod'])[1];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, D = 1, P = 0, raf = 0, t0 = performance.now(), ready = 0;
  var before = new Image(), after = new Image();
  var mask = document.createElement('canvas'), mx = mask.getContext('2d');
  var top = document.createElement('canvas'), tx = top.getContext('2d');
  var MS = 0.2; /* mask resolution relative to the screen */

  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function ease(v) { v = clamp(v); return v * v * (3 - 2 * v); }
  /* per-scenario route in picture coordinates (0..1), mapped through the same "cover" fit as the pictures */
  var ROUTES = { gorodmost: [[0.97, 0.15], [0.8, 0.22], [0.62, 0.38], [0.5, 0.48], [0.4, 0.58], [0.27, 0.72], [0.12, 0.86], [0.3, 0.93], [0.52, 0.83], [0.7, 0.66], [0.86, 0.5]] };
  function path(u) {
    var r = ROUTES[slug];
    if (r && before.naturalWidth) {
      var f = clamp(u) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f)), k = f - i;
      var a = r[Math.max(0, i - 1)], b = r[i], c = r[i + 1], d = r[Math.min(r.length - 1, i + 2)];
      var cr = function (n) { return 0.5 * ((2 * b[n]) + (-a[n] + c[n]) * k + (2 * a[n] - 5 * b[n] + 4 * c[n] - d[n]) * k * k + (-a[n] + 3 * b[n] - 3 * c[n] + d[n]) * k * k * k); };
      var sc = Math.max(W / before.naturalWidth, H / before.naturalHeight), iw = before.naturalWidth * sc, ih = before.naturalHeight * sc;
      return [(W - iw) / 2 + cr(0) * iw, (H - ih) / 2 + cr(1) * ih];
    }
    var wide = W > H;
    var x = wide ? 0.86 - 0.5 * u + 0.2 * Math.sin(u * Math.PI * 2.6) : 0.5 + 0.34 * Math.sin(u * Math.PI * 2.8 + 1.2);
    return [W * x, H * (0.1 + 0.86 * u)];
  }
  function cover(c, img, w, h) {
    var k = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    c.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  }
  function draw(now) {
    var time = (now - t0) / 1000, i;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    cover(ctx, before, cv.width, cv.height);
    /* mask: soft blobs along the travelled path, plus a full fade at the very end */
    var mw = mask.width, mh = mask.height, R = Math.max(mw, mh) * (ROUTES[slug] ? 0.2 : 0.3), n = Math.ceil(P * 46);
    mx.clearRect(0, 0, mw, mh);
    for (i = 0; i <= n; i++) {
      var u = Math.min(P, i / 46), p = path(u), age = ease((P - u) / 0.1 + 0.25);
      var x = p[0] / W * mw, y = p[1] / H * mh, r = R * (0.35 + 0.65 * age);
      var g = mx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,' + (0.5 + 0.5 * age) + ')'); g.addColorStop(0.55, 'rgba(255,255,255,' + 0.35 * age + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
      mx.fillStyle = g; mx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var all = ease((P - 0.86) / 0.14);
    if (all > 0) { mx.fillStyle = 'rgba(255,255,255,' + all + ')'; mx.fillRect(0, 0, mw, mh); }
    tx.globalCompositeOperation = 'source-over';
    tx.clearRect(0, 0, top.width, top.height);
    cover(tx, after, top.width, top.height);
    tx.globalCompositeOperation = 'destination-in';
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(mask, 0, 0, top.width, top.height);
    ctx.drawImage(top, 0, 0);
    /* a light scrim keeps the text readable in both states */
    ctx.setTransform(D, 0, 0, D, 0, 0);
    var sc = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sc.addColorStop(0, 'rgba(6,8,14,0.5)'); sc.addColorStop(1, 'rgba(6,8,14,0)');
    ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H * 0.5);
    /* the spark and its trail */
    if (P < 0.995) {
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'lighter';
      for (i = 90; i >= 1; i--) {
        var u1 = P - i * 0.0016, u2 = P - (i - 1) * 0.0016 + 0.0003; if (u1 < 0) continue;
        var p1 = path(u1), p2 = path(u2), f = 1 - i / 90;
        ctx.strokeStyle = 'rgba(255,' + Math.round(196 + 44 * f) + ',' + Math.round(120 + 110 * f) + ',' + 0.7 * f * f + ')';
        ctx.lineWidth = 1 + 9 * f; ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
      var sp = path(P), pulse = reduce ? 1 : 1 + 0.08 * Math.sin(time * 7), hr = 170 * pulse;
      var halo = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], hr);
      halo.addColorStop(0, 'rgba(255,252,240,1)'); halo.addColorStop(0.06, 'rgba(255,226,160,0.8)');
      halo.addColorStop(0.3, 'rgba(255,190,110,0.2)'); halo.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sp[0], sp[1], hr, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,235,0.85)'; ctx.lineWidth = 1.3;
      var ray = 26 * pulse;
      ctx.beginPath(); ctx.moveTo(sp[0] - ray, sp[1]); ctx.lineTo(sp[0] + ray, sp[1]); ctx.moveTo(sp[0], sp[1] - ray * 1.5); ctx.lineTo(sp[0], sp[1] + ray * 1.5); ctx.stroke();
      if (!reduce) for (i = 0; i < 14; i++) { /* small sparks falling behind */
        var a = (time * 0.9 + i / 14) % 1, back = path(Math.max(0, P - a * 0.05));
        ctx.fillStyle = 'rgba(255,230,170,' + (1 - a) * 0.9 + ')';
        ctx.beginPath(); ctx.arc(back[0] + Math.sin(i * 7.3) * 26 * a, back[1] + Math.cos(i * 3.1) * 26 * a, 1.6 * (1 - a) + 0.4, 0, 6.28); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function progress() {
    var end = document.querySelector('[data-iskra-end]');
    var span = end ? end.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35 : document.documentElement.scrollHeight - window.innerHeight;
    return clamp(window.scrollY / Math.max(1, span));
  }
  function frame(now) {
    raf = 0;
    if (ready < 2) return;
    var target = reduce ? 1 : 0.03 + 0.97 * progress();
    P += (target - P) * (reduce ? 1 : 0.14);
    if (Math.abs(target - P) < 0.0004) P = target;
    draw(now);
    document.documentElement.setAttribute('data-iskra-p', P.toFixed(3));
    if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function resize() {
    D = Math.min(window.devicePixelRatio || 1, 1.5); W = window.innerWidth; H = window.innerHeight;
    cv.width = top.width = Math.round(W * D); cv.height = top.height = Math.round(H * D);
    mask.width = Math.round(W * MS); mask.height = Math.round(H * MS);
    kick();
  }
  var tall = window.innerHeight > window.innerWidth * 1.2, sfx = tall ? '_tel' : '';
  function load(img, name) {
    img.onload = function () { ready++; kick(); };
    img.onerror = function () { if (sfx && img.src.indexOf('_tel') > 0) img.src = 'img/' + slug + '_' + name + '.jpg'; };
    img.src = 'img/' + slug + '_' + name + sfx + '.jpg';
  }
  load(before, 'before'); load(after, 'after');
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  window.addEventListener('scroll', kick, { passive: true });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  resize();
})();
