/* Yandex Metrika for ai-vibes.ru (counter 113177190, added 2026-09-29).
 * Self-hosted loader because the pages' CSP forbids inline scripts; it pulls tag.js from
 * mc.yandex.ru. No Webvisor, no click map: visits, pages, sources, outbound links only.
 * Goals (JS events, configured in Metrika):
 *   download_transkribator     - click on a Transkribator GitHub releases link
 *   download_apartment_auditor - click on the Apartment Auditor RuStore link
 *   order_click                - click on an order button [data-order]; params service, place
 *   contact_max                - click on the MAX profile link; param place
 *   contact_telegram           - click on the personal t.me/lavr5000 link (not the channel); param place
 *   contact_email              - click on a mailto: link; param place
 * place = id of the nearest section or dialog (contact, order-modal, ...).
 * The /services/ goal is a page-visit goal and needs no code.
 * Disclosed in privacy.html, section "Яндекс Метрика".
 */
(function (w, d) {
  "use strict";
  var ID = 113177190;
  var TAG = "https://mc.yandex.ru/metrika/tag.js?id=" + ID;

  w.ym = w.ym || function () { (w.ym.a = w.ym.a || []).push(arguments); };
  w.ym.l = 1 * new Date();
  for (var i = 0; i < d.scripts.length; i++) {
    if (d.scripts[i].src === TAG) return;
  }
  var s = d.createElement("script");
  s.async = true;
  s.src = TAG;
  (d.head || d.documentElement).appendChild(s);

  w.ym(ID, "init", {
    webvisor: false,
    clickmap: false,
    trackLinks: true,
    accurateTrackBounce: true
  });

  var GOALS = [
    [/github\.com\/Lavr5000\/Transkribator\/releases/i, "download_transkribator"],
    [/rustore\.ru\/catalog\/app\/com\.lavr5000xxx\.apartmentauditor/i, "download_apartment_auditor"]
  ];

  var CONTACTS = [
    [/^https:\/\/max\.ru\//i, "contact_max"],
    [/^https:\/\/t\.me\/lavr5000(?:[\/?#]|$)/i, "contact_telegram"],   // personal, not the channel
    [/^mailto:/i, "contact_email"]
  ];

  function place(el) {
    var s = el.closest("section[id], [role='dialog'][id]");
    return s ? s.id : "";
  }

  d.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var b = t.closest("[data-order]");
    if (b) {
      w.ym(ID, "reachGoal", "order_click", { service: b.getAttribute("data-service-id") || "", place: place(b) });
      return;
    }
    var a = t.closest("a[href]");
    if (!a) return;
    for (var j = 0; j < GOALS.length; j++) {
      if (GOALS[j][0].test(a.href)) {
        w.ym(ID, "reachGoal", GOALS[j][1]);
        return;
      }
    }
    for (var k = 0; k < CONTACTS.length; k++) {
      if (CONTACTS[k][0].test(a.href)) {
        w.ym(ID, "reachGoal", CONTACTS[k][1], { place: place(a) });
        return;
      }
    }
  }, true);
})(window, document);
