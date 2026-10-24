// Registers the service worker from a bundled module (not an inline script).
import { Workbox } from 'workbox-window';

function show(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  if (element) element.hidden = false;
}

/** Banner, registration and the "Update available, reload" prompt. */
export function startShell(): void {
  const secure = globalThis.isSecureContext && 'serviceWorker' in navigator;
  if (!secure) {
    show('[data-xt="offline-banner"]');
    return;
  }

  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  // generateSW writes dist/sw.js. The scope cannot be wider than that script's directory,
  // which is the site root, so the base path is a valid scope.
  const registration: { scope: string } = { scope: base };
  const worker = new Workbox(`${base}sw.js`, registration);
  worker.addEventListener('waiting', () => show('[data-xt="update"]'));
  document.querySelector<HTMLButtonElement>('[data-xt="update-reload"]')?.addEventListener('click', () => {
    worker.addEventListener('controlling', () => location.reload());
    void worker.messageSkipWaiting();
  });
  void worker.register({ immediate: true }).catch(() => {
    // The regular end-to-end suite blocks service workers so it can see every request.
    // Offline tests allow them. A failed registration leaves the site working online.
  });
}
