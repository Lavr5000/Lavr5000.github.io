// idk-page.js — starts the order flow of id-komplekt.html (the page is noindex until the launch is decided).
import { mountIdkOrder } from './idk-order.js?v=20261122-idk2';

const root = document.querySelector('[data-idk-root]');
if (root) {
  const order = mountIdkOrder(root);
  order.resume(); // a stored order token (closed tab, return from the bank) brings the status back
}
