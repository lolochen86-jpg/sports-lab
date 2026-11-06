(() => {
  const panel = document.querySelector('#mobile-menu-panel');
  const toggle = document.querySelector('#mobile-menu-toggle');
  const close = document.querySelector('#mobile-menu-close');
  const scrim = document.querySelector('#mobile-menu-scrim');
  if (!panel || !toggle || !close || !scrim) return;
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    scrim.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) close.focus();
    else if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  close.addEventListener('click', () => setOpen(false, true));
  scrim.addEventListener('click', () => setOpen(false, true));
  panel.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false, true); });
  window.addEventListener('hashchange', () => setOpen(false));
})();
