/* soft-prompt.js — offers registration AFTER a result is delivered, on the two
 * order pages only.
 *
 * Deliberately an isolated DOM observer rather than an edit to order-flow.js:
 * that file owns the money path (upload, payment, polling, delivery) and must not
 * grow a marketing concern. If this script throws, is blocked, or is deleted, the
 * order flow behaves exactly as before.
 *
 * Gated on registration_enabled, so it stays invisible until registration is
 * legally cleared to open.
 */
(function () {
  'use strict';

  var API_ORIGIN = 'https://api.ai-vibes.ru';
  var DISMISS_KEY = 'ai-vibes:soft-prompt-dismissed';

  function dismissed() {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch (err) {
      return false; // private mode / storage disabled — just show it
    }
  }

  function remember() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch (err) {
      /* nothing to do: the prompt simply reappears next time */
    }
  }

  function build() {
    var box = document.createElement('div');
    box.className = 'notice';
    box.setAttribute('data-soft-prompt', '1');
    box.setAttribute('role', 'status');

    var text = document.createElement('p');
    text.textContent = 'Хотите видеть историю своих заказов и остаток бесплатных генераций? '
      + 'Заведите личный кабинет — вход без пароля, по коду на почту. '
      + 'Для оформления и оплаты заказов кабинет не нужен.';
    box.appendChild(text);

    var open = document.createElement('a');
    open.className = 'btn btn-secondary';
    open.href = API_ORIGIN + '/login';
    open.rel = 'noopener';
    open.textContent = 'Создать кабинет';
    box.appendChild(open);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-secondary';
    close.textContent = 'Не сейчас';
    close.addEventListener('click', function () {
      remember();
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    box.appendChild(close);

    return box;
  }

  function delivered(statusBox) {
    // ponytail: structural check, not label text — order-flow renders the visible
    // stage list as `.line` rows and marks reached ones `.on`, so "the last visible
    // step is reached" means the flow finished. A failure also fills the list, hence
    // the `#message.bad` exclusion. The clean upgrade is a `data-stage` attribute on
    // #status, which would mean editing order-flow.js — out of scope for this pass.
    var lines = statusBox.querySelectorAll('.line');
    if (!lines.length) return false;
    if (!lines[lines.length - 1].classList.contains('on')) return false;
    var message = document.querySelector('#message');
    return !(message && message.classList.contains('bad'));
  }

  function watch() {
    var statusBox = document.querySelector('#status');
    if (!statusBox) return;
    var observer = new MutationObserver(function () {
      if (!delivered(statusBox)) return;
      if (document.querySelector('[data-soft-prompt]')) return;
      observer.disconnect();
      statusBox.insertAdjacentElement('afterend', build());
    });
    observer.observe(statusBox, { childList: true, subtree: true, attributes: true });
  }

  function start() {
    if (dismissed()) return;
    fetch(API_ORIGIN + '/api/feature-status', { method: 'GET', credentials: 'omit' })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        if (data && data.registration_enabled === true) watch();
      })
      .catch(function () {
        /* backend unreachable — no prompt, order flow untouched */
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
