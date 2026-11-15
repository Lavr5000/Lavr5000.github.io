/* First script of a page with a scroll scene: marks that scripts run, so the scene poster stays hidden (and, being
   lazy, is not fetched) and the canvas draws the first frame instead. Synchronous on purpose. */
document.documentElement.classList.add('js');
