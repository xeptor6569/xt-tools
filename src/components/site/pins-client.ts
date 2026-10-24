// Wires every pin button, including ones the collections page renders later.

import { MAX_PINS, parsePinAttr } from '../../lib/library.ts';
import { LIBRARY_EVENT, loadPins, toggleStoredPin } from '../../lib/library-store.ts';

function syncPins(): void {
  const stored = new Set(loadPins().map((pin) => `${pin.kind}:${pin.id}`));
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-xt-pin]')) {
    const on = stored.has(button.dataset.xtPin ?? '');
    const label = button.dataset.xtPinLabel ?? 'item';
    const name = `${on ? 'Unpin' : 'Pin'} ${label}`;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.setAttribute('aria-label', name);
    button.title = name;
  }
}

function announce(text: string): void {
  const status = document.querySelector('[data-xt="pin-status"]');
  if (status) status.textContent = text;
}

export function installPins(): void {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-xt-pin]');
    if (!(button instanceof HTMLButtonElement)) return;
    const pin = parsePinAttr(button.dataset.xtPin);
    if (!pin) return;
    event.preventDefault();
    const label = button.dataset.xtPinLabel ?? 'item';
    const result = toggleStoredPin(pin);
    if (result === 'full') announce(`You can pin ${MAX_PINS} items. Unpin one first.`);
    else if (result === 'added') announce(`Pinned ${label}.`);
    else announce(`Unpinned ${label}.`);
    syncPins();
  });

  window.addEventListener(LIBRARY_EVENT, syncPins);
  syncPins();
  document.documentElement.dataset.xtPins = 'ready';
}
