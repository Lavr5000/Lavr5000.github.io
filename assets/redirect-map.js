/* AI Vibes — карта перенаправлений упраздненных адресов (/services/, /about.html).
   Таблица между map:begin/map:end — строгий JSON, синхронен с tests/fixtures/redirects.json. */
(function (w) {
  'use strict';
  var TABLE =
/* map:begin */
{
 "/services/": {
  "default": "/#tarify",
  "anchors": {
   "#services": "/#tarify",
   "#service-1": "/#tarify",
   "#service-2": "/#tarify",
   "#pokaz": "/#tarify",
   "#documents": "/products.html#documents",
   "#service-3": "/products.html#documents",
   "#service-4": "/products.html#documents",
   "#service-5": "/#service-5",
   "#setup-start": "/#service-5",
   "#vip": "/#vip",
   "#setup-vip": "/#vip",
   "#rieltor": "/#service-rieltor",
   "#service-rieltor": "/#service-rieltor",
   "#setup-rieltor": "/#service-rieltor",
   "#compare": "/#compare",
   "#support": "/#support",
   "#process": "/#process",
   "#contact": "/#contact"
  }
 },
 "/about.html": {
  "default": "/",
  "anchors": {
   "#p-02": "/"
  }
 }
}
/* map:end */
  ;

  /* /services, /services/, /services/index.html -> '/services/'; '/about.html' as is */
  function norm(p) {
    if (p.length > 11 && p.substring(p.length - 11) === '/index.html') { p = p.substring(0, p.length - 10); }
    if (p.indexOf('.') === -1 && p.charAt(p.length - 1) !== '/') { p += '/'; }
    return p;
  }

  function map(url) {
    var base = '';
    try { base = (w.location && w.location.href) || location.href; } catch (e) { base = ''; }
    var u;
    try { u = new URL(url, base); } catch (e) { return url; }
    var spec = TABLE[norm(u.pathname)];
    if (!spec) { return url; }
    var t = (spec.anchors && spec.anchors[u.hash]) ? spec.anchors[u.hash] : spec.default;
    var i = t.indexOf('#');
    var path = i === -1 ? t : t.substring(0, i);
    var hash = i === -1 ? '' : t.substring(i + 1);
    return path + u.search + (hash ? '#' + hash : '');
  }

  w.AVRedirect = { table: TABLE, map: map };
}(typeof window !== 'undefined' ? window : this));
