/* Yandex Metrika for ai-vibes.ru (counter 113177190, added 2026-09-29).
 * Self-hosted loader because the pages' CSP forbids inline scripts; it pulls tag.js from
 * mc.yandex.ru. No Webvisor, no click map: visits, pages, sources, outbound links only.
 * Goals (JS events, configured in Metrika):
 *   download_transkribator     - click on a Transkribator GitHub releases link
 *   download_apartment_auditor - click on the Apartment Auditor RuStore link
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

  d.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    for (var j = 0; j < GOALS.length; j++) {
      if (GOALS[j][0].test(a.href)) {
        w.ym(ID, "reachGoal", GOALS[j][1]);
        return;
      }
    }
  }, true);
})(window, document);
