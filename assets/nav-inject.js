/* nav-inject.js — adds the "Кабинет" link to the site nav, but ONLY when the
 * backend says the accounts layer is live.
 *
 * The cabinet is served by the backend (https://api.ai-vibes.ru/account), not by
 * GitHub Pages, so there is no page here to link to unconditionally. Asking the
 * API keeps a single source of truth for the feature flag: flipping it on the
 * server is the whole rollout, with no Pages deploy needed.
 *
 * Fails silent and does nothing on error — a nav link is never worth breaking a
 * page over, and while the layer is dark the correct outcome is "no link".
 *
 * CSP: same-origin script; the fetch target is already covered by the existing
 * `connect-src 'self' https://api.ai-vibes.ru` on the pages that declare a policy.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://api.ai-vibes.ru';

  /* about.html and products.html render their nav with React AFTER
   * DOMContentLoaded, so a one-shot querySelector finds nothing there and the link
   * would silently never appear on those pages. Wait for the container, bounded:
   * give up after WAIT_MS rather than observing the document forever. */
  var WAIT_MS = 10000;

  function whenNavReady(callback) {
    if (document.querySelector('.nav-links')) {
      callback();
      return;
    }
    var observer = new MutationObserver(function () {
      if (!document.querySelector('.nav-links')) return;
      observer.disconnect();
      callback();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () {
      observer.disconnect();
    }, WAIT_MS);
  }

  function addLink() {
    var container = document.querySelector('.nav-links');
    if (!container || container.querySelector('[data-account-link]')) return;
    var link = document.createElement('a');
    link.className = 'nav-link';
    link.href = API_ORIGIN + '/account';
    link.textContent = 'Кабинет';
    link.setAttribute('data-account-link', '1');
    // rel=noopener: the cabinet is a different origin and must not get a handle
    // back to this window.
    link.rel = 'noopener';
    container.appendChild(link);
  }

  function check() {
    fetch(API_ORIGIN + '/api/feature-status', {
      method: 'GET',
      // No cookies: this is a public, personal-data-free status probe, and sending
      // credentials cross-origin would need a CORS policy we deliberately do not have.
      credentials: 'omit'
    })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (data && data.accounts_enabled === true) whenNavReady(addLink);
      })
      .catch(function () {
        /* offline, blocked, or backend down — leave the nav exactly as it was */
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();
