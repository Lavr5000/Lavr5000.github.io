// vedomost-dialog.js — opens the «Ведомость материалов из РД» order dialog on the catalog (PO 26.10 Р-4).
// The tile button (a[data-vd-open] in products.html) opens the dialog instead of going to a page;
// its href stays as the no-JS fallback. The dialog also opens by itself for #vedomost in the address and
// after the return from the bank (a stored order token). While the browser goes to the bank the dialog is
// locked: Esc, the backdrop and the close button do nothing. Same pattern as pdf-tables-dialog.js.
import { mountVedomostOrder } from './vedomost.js?v=20261026-vd';

const STORE_KEY = 'av-vd:order-token';   // survives the round-trip through the bank page
const HASH = '#vedomost';
const dialog = document.getElementById('vd-dialog');

function readToken() {
  try { return sessionStorage.getItem(STORE_KEY); } catch (_) { return null; }
}

if (dialog && typeof dialog.showModal === 'function') {
  let opener = null;
  const setLocked = on => { if (on) dialog.dataset.locked = '1'; else delete dialog.dataset.locked; };

  const flow = mountVedomostOrder(dialog, {
    onPayClick(orderToken) {
      setLocked(true);
      try { if (orderToken) sessionStorage.setItem(STORE_KEY, orderToken); } catch (_) { /* storage is optional */ }
    },
    onStage(stage) {
      if (stage === 'delivered' || stage === 'failed') {
        try { sessionStorage.removeItem(STORE_KEY); } catch (_) { /* storage is optional */ }
      }
    }
  });

  // the dialog scrolls inside itself: keep the newest status line or the pay link in view
  const statusBox = dialog.querySelector('#status');
  const messageEl = dialog.querySelector('#message');
  if (statusBox && typeof MutationObserver === 'function') {
    new MutationObserver(() => {
      if (!dialog.open) return;
      const target = statusBox.querySelector('a.pay') || statusBox.lastElementChild || messageEl;
      try { if (target) target.scrollIntoView({ block: 'nearest' }); } catch (_) { /* old browsers */ }
    }).observe(statusBox, { childList: true });
  }

  const open = trigger => {
    opener = trigger || null;
    if (!dialog.open) dialog.showModal();
    const token = readToken();
    if (flow && token) flow.resume(token);
  };

  dialog.addEventListener('cancel', event => {
    if (dialog.dataset.locked) event.preventDefault();
  });
  // runs before the document-level handler of chrome.js (backdrop click / [data-dlg-close])
  dialog.addEventListener('click', event => {
    if (dialog.dataset.locked) event.stopPropagation();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('vd-modal-open');
    if (location.hash === HASH) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    const back = opener && opener.isConnected ? opener : document.querySelector('a[data-vd-open]');
    if (back) back.focus();
  });
  dialog.addEventListener('toggle', () => {
    document.documentElement.classList.toggle('vd-modal-open', dialog.open);
  });
  // «Back» from the bank page may restore this page from the cache with the dialog still locked
  window.addEventListener('pageshow', event => {
    if (event.persisted) setLocked(false);
  });

  document.addEventListener('click', event => {
    const trigger = event.target.closest && event.target.closest('a[data-vd-open]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });

  const fromAddress = () => location.hash === HASH;
  if (fromAddress() || readToken()) open(null);
  window.addEventListener('hashchange', () => { if (fromAddress()) open(null); });
}
