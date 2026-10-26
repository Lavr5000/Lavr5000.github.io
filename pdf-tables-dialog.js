// pdf-tables-dialog.js — opens the «Таблицы из PDF» order dialog on the catalog (PLAN-7 Э7c, PO 26.10 Р-3).
// The tile button (a[data-pt-open], added by products.render.js) opens the dialog instead of going to a page;
// its href stays as the no-JS fallback. The dialog also opens by itself for #pdf-tables in the address and
// after the return from the bank (a stored order token). While the browser goes to the bank the dialog is
// locked: Esc, the backdrop and the close button do nothing.
import { mountPdfTablesOrder, hasStoredOrder } from './pdf-tables-order.js?v=20261026-dlg';

const dialog = document.getElementById('pt-dialog');

if (dialog && typeof dialog.showModal === 'function') {
  const order = mountPdfTablesOrder(dialog);
  let opener = null;

  const open = trigger => {
    opener = trigger || null;
    if (!dialog.open) dialog.showModal();
    order.resume();
  };

  dialog.addEventListener('cancel', event => {
    if (dialog.dataset.locked) event.preventDefault();
  });
  // runs before the document-level handler of chrome.js (backdrop click / [data-dlg-close])
  dialog.addEventListener('click', event => {
    if (dialog.dataset.locked) event.stopPropagation();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('pt-modal-open');
    if (location.hash === '#pdf-tables') {
      history.replaceState(null, '', location.pathname + location.search);
    }
    const back = opener && opener.isConnected ? opener : document.querySelector('a[data-pt-open]');
    if (back) back.focus();
  });
  dialog.addEventListener('toggle', () => {
    document.documentElement.classList.toggle('pt-modal-open', dialog.open);
  });

  document.addEventListener('click', event => {
    const trigger = event.target.closest && event.target.closest('a[data-pt-open]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });

  const fromAddress = () => location.hash === '#pdf-tables';
  if (fromAddress() || hasStoredOrder()) open(null);
  window.addEventListener('hashchange', () => { if (fromAddress()) open(null); });
}
